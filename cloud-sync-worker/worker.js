const json = (body, status = 200, cacheControl = 'no-store') => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': cacheControl
  }
});

const archivePath = id => `cloud-archives/${id}/archive.json`;
const archivePartPath = (id, index) => `cloud-archives/${id}/part-${String(index).padStart(3, '0')}.txt`;
const apiUrl = (env, path) => `https://gitee.com/api/v5/repos/${env.GITEE_OWNER}/${env.GITEE_REPO}/contents/${path}`;
const publicApiUrl = (env, path) => `https://gitee.com/api/v5/repos/${env.GITEE_OWNER}/${env.GITEE_PUBLIC_REPO}/contents/${path}`;
const authHeaders = env => ({ Authorization: `token ${env.GITEE_ACCESS_TOKEN}`, Accept: 'application/json' });
const decodeBase64Json = value => {
  const bytes = Uint8Array.from(atob(String(value).replace(/\s/g, '')), character => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};
const decodeBase64Text = value => {
  const bytes = Uint8Array.from(atob(String(value).replace(/\s/g, '')), character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};
const encodeBase64Text = value => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};
const readArchiveFile = async (env, path) => {
  const response = await fetch(`${apiUrl(env, path)}?ref=${encodeURIComponent(env.GITEE_BRANCH || 'main')}`, { headers: authHeaders(env) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Gitee read failed: ${response.status}`);
  const file = await response.json();
  if (Array.isArray(file) || !file?.content) return null;
  return { sha: file.sha, content: decodeBase64Text(file.content) };
};

const readArchive = async (env, id) => {
  const file = await readArchiveFile(env, archivePath(id));
  if (!file) return null;
  const index = JSON.parse(file.content);
  if (index.storageVersion !== 2) return { sha: file.sha, envelope: index };
  const parts = [];
  for (let part = 0; part < index.parts; part += 1) {
    const chunk = await readArchiveFile(env, archivePartPath(id, part));
    if (!chunk) throw new Error(`Gitee archive part ${part} is missing`);
    parts.push(chunk.content);
  }
  return {
    sha: file.sha,
    envelope: {
      version: index.version,
      updatedAt: index.updatedAt,
      compression: index.compression,
      salt: index.salt,
      iv: index.iv,
      ciphertext: parts.join('')
    }
  };
};

const readRepoJson = async (env, path) => {
  const response = await fetch(`${publicApiUrl(env, path)}?ref=${encodeURIComponent(env.GITEE_PUBLIC_BRANCH || 'main')}`, { headers: authHeaders(env) });
  if (!response.ok) throw new Error(`Gitee public data read failed: ${response.status}`);
  const file = await response.json();
  if (Array.isArray(file) || !file?.content) throw new Error('Gitee public data file is missing');
  return decodeBase64Json(file.content);
};

const writeArchiveFile = async (env, path, content, message) => {
  const existing = await readArchiveFile(env, path);
  const body = {
    access_token: env.GITEE_ACCESS_TOKEN,
    content: encodeBase64Text(content),
    message,
    branch: env.GITEE_BRANCH || 'main',
    ...(existing?.sha ? { sha: existing.sha } : {})
  };
  const response = await fetch(apiUrl(env, path), {
    method: existing ? 'PUT' : 'POST',
    headers: { ...authHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Gitee write failed: ${response.status} ${await response.text()}`);
};

const writeArchive = async (env, id, envelope) => {
  const chunkSize = 400_000;
  const parts = Math.max(1, Math.ceil(envelope.ciphertext.length / chunkSize));
  for (let part = 0; part < parts; part += 1) {
    await writeArchiveFile(
      env,
      archivePartPath(id, part),
      envelope.ciphertext.slice(part * chunkSize, (part + 1) * chunkSize),
      `sync archive ${id} part ${part + 1}/${parts}`
    );
  }
  const index = {
    storageVersion: 2,
    version: envelope.version,
    updatedAt: envelope.updatedAt,
    compression: envelope.compression,
    salt: envelope.salt,
    iv: envelope.iv,
    parts,
    ciphertextLength: envelope.ciphertext.length
  };
  await writeArchiveFile(env, archivePath(id), JSON.stringify(index), `sync archive ${id} index`);
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return json({ ok: true });
    const url = new URL(request.url);
    const publicMatch = url.pathname.match(/^\/public\/(update-manifest\.json|vaccine-prices\.json)$/);
    if (publicMatch) {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      try {
        const cache = caches.default;
        const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
        const cached = await cache.match(cacheKey);
        if (cached) return cached;
        const maxAge = publicMatch[1] === 'update-manifest.json' ? 60 : 1800;
        const response = json(await readRepoJson(env, publicMatch[1]), 200, `public, max-age=${maxAge}`);
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (error) {
        console.error(error);
        return json({ error: 'Public data service failed' }, 502);
      }
    }
    const match = url.pathname.match(/^\/archive\/(\d{6}-\d{8})$/);
    if (!match) return json({ error: 'Not found' }, 404);
    if (!env.GITEE_ACCESS_TOKEN || !env.GITEE_OWNER || !env.GITEE_REPO || !env.GITEE_PUBLIC_REPO || !env.ARCHIVES) return json({ error: 'Service is not configured' }, 503);
    const id = match[1];
    try {
      if (request.method === 'GET') {
        const cachedArchive = await env.ARCHIVES.get(id, 'json');
        if (cachedArchive) return json(cachedArchive);
        const archive = await readArchive(env, id);
        if (!archive) return json({ error: 'Archive not found' }, 404);
        ctx.waitUntil(env.ARCHIVES.put(id, JSON.stringify(archive.envelope)));
        return json(archive.envelope);
      }
      if (request.method === 'PUT') {
        const raw = await request.text();
        if (raw.length > 15_000_000) return json({ error: '存档超过15MB，请缩小宝宝头像后重试' }, 413);
        const envelope = JSON.parse(raw);
        if (envelope?.version !== 1 || typeof envelope.ciphertext !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.salt !== 'string') return json({ error: 'Invalid archive' }, 400);
        await env.ARCHIVES.put(id, JSON.stringify(envelope));
        ctx.waitUntil(writeArchive(env, id, envelope).catch(error => console.error('Gitee archive mirror failed', error)));
        return json({ ok: true, updatedAt: envelope.updatedAt });
      }
      return json({ error: 'Method not allowed' }, 405);
    } catch (error) {
      console.error(error);
      return json({ error: request.method === 'PUT' ? '云端写入失败，请稍后重试' : '云端读取失败，请稍后重试' }, 502);
    }
  }
};
