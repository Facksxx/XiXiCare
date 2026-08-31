'use strict';

const COLLECTION = 'xixi_archive_meta';
const MAX_BODY_BYTES = 5_500_000;

const response = (statusCode, body) => ({
  mpserverlessComposedResponse: true,
  isBase64Encoded: false,
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  },
  body: JSON.stringify(body)
});

const parseRequest = event => {
  const method = String(event.httpMethod || event.requestContext?.http?.method || 'GET').toUpperCase();
  const path = String(event.path || event.rawPath || '/');
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : String(event.body || '');
  return { method, path, rawBody };
};

const archiveIdFromPath = path => {
  const match = path.match(/\/archive\/(\d{6}-\d{8})(?:\/meta)?\/?$/);
  return match?.[1] || '';
};

const isMetaPath = path => /\/meta\/?$/.test(path);

const validateEnvelope = envelope => (
  (envelope?.version === 1 || envelope?.version === 2)
  && typeof envelope.updatedAt === 'string'
  && typeof envelope.salt === 'string'
  && typeof envelope.iv === 'string'
  && typeof envelope.ciphertext === 'string'
);

const readArchive = async id => {
  const result = await uniCloud.database().collection(COLLECTION).doc(id).get();
  const meta = result.data?.[0];
  if (!meta?.fileId) return null;
  const file = await uniCloud.downloadFile({ fileID: meta.fileId });
  if (!file?.fileContent) throw new Error('Archive content is missing');
  return JSON.parse(Buffer.from(file.fileContent).toString('utf8'));
};

const writeArchive = async (id, rawBody, envelope) => {
  const collection = uniCloud.database().collection(COLLECTION);
  const previous = await collection.doc(id).get();
  const previousFileId = previous.data?.[0]?.fileId;
  const previousRevision = Number(previous.data?.[0]?.revision || 0);
  if (Number.isInteger(envelope.baseRevision) && envelope.baseRevision !== previousRevision) {
    const error = new Error('Archive revision conflict');
    error.code = 'REVISION_CONFLICT';
    throw error;
  }
  if (envelope.digest && envelope.digest === previous.data?.[0]?.digest) {
    return { unchanged: true, revision: previousRevision };
  }
  const cloudPath = `xixi-archives/${id}/archive-${Date.now()}.json`;
  const uploaded = await uniCloud.uploadFile({
    cloudPath,
    fileContent: Buffer.from(rawBody, 'utf8')
  });
  if (!uploaded?.fileID) throw new Error('Archive upload failed');
  await collection.doc(id).set({
    fileId: uploaded.fileID,
    updatedAt: envelope.updatedAt,
    serverUpdatedAt: new Date().toISOString(),
    byteLength: Buffer.byteLength(rawBody),
    digest: envelope.digest || '',
    revision: previousRevision + 1
  });

  if (previousFileId && previousFileId !== uploaded.fileID) {
    try { await uniCloud.deleteFile({ fileList: [previousFileId] }); }
    catch (error) { console.warn('Unable to remove previous archive', error); }
  }
  return { unchanged: false, revision: previousRevision + 1 };
};

exports.main = async event => {
  const { method, path, rawBody } = parseRequest(event);
  if (method === 'OPTIONS') return response(204, {});
  if (/\/health\/?$/.test(path)) return response(200, { ok: true, provider: 'unicloud-alipay' });

  const id = archiveIdFromPath(path);
  if (!id) return response(404, { error: 'Not found' });

  try {
    if (method === 'GET') {
      if (isMetaPath(path)) {
        const result = await uniCloud.database().collection(COLLECTION).doc(id).get();
        const meta = result.data?.[0];
        return meta ? response(200, { revision: Number(meta.revision || 0), digest: meta.digest || '', updatedAt: meta.updatedAt }) : response(404, { error: 'Archive not found' });
      }
      const archive = await readArchive(id);
      return archive ? response(200, archive) : response(404, { error: 'Archive not found' });
    }

    if (method === 'PUT') {
      if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
        return response(413, { error: '存档超过5MB，请缩小宝宝头像后重试' });
      }
      const envelope = JSON.parse(rawBody);
      if (!validateEnvelope(envelope)) return response(400, { error: 'Invalid archive' });
      const result = await writeArchive(id, rawBody, envelope);
      return response(200, { ok: true, updatedAt: envelope.updatedAt, ...result });
    }

    return response(405, { error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    if (error?.code === 'REVISION_CONFLICT') return response(409, { error: 'Archive revision conflict' });
    return response(502, { error: method === 'PUT' ? '云端写入失败，请稍后重试' : '云端读取失败，请稍后重试' });
  }
};
