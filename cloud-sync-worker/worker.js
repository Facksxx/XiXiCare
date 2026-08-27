const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  }
});

const archivePath = id => `cloud-archives/${id}/archive.json`;
const apiUrl = (env, path) => `https://gitee.com/api/v5/repos/${env.GITEE_OWNER}/${env.GITEE_REPO}/contents/${path}`;
const authHeaders = env => ({ Authorization: `token ${env.GITEE_ACCESS_TOKEN}`, Accept: 'application/json' });
const decodeBase64Json = value => {
  const bytes = Uint8Array.from(atob(String(value).replace(/\s/g, '')), character => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};
const encodeBase64Json = value => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
};

const readArchive = async (env, id) => {
  const response = await fetch(`${apiUrl(env, archivePath(id))}?ref=${encodeURIComponent(env.GITEE_BRANCH || 'main')}`, { headers: authHeaders(env) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Gitee read failed: ${response.status}`);
  const file = await response.json();
  if (Array.isArray(file) || !file?.content) return null;
  return { sha: file.sha, envelope: decodeBase64Json(file.content) };
};

const writeArchive = async (env, id, envelope) => {
  const existing = await readArchive(env, id);
  const body = {
    access_token: env.GITEE_ACCESS_TOKEN,
    content: encodeBase64Json(envelope),
    message: `sync archive ${id}`,
    branch: env.GITEE_BRANCH || 'main',
    ...(existing?.sha ? { sha: existing.sha } : {})
  };
  const response = await fetch(apiUrl(env, archivePath(id)), {
    method: existing ? 'PUT' : 'POST',
    headers: { ...authHeaders(env), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Gitee write failed: ${response.status} ${await response.text()}`);
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return json({ ok: true });
    const url = new URL(request.url);
    const match = url.pathname.match(/^\/archive\/(\d{6}-\d{8})$/);
    if (!match) return json({ error: 'Not found' }, 404);
    if (!env.GITEE_ACCESS_TOKEN || !env.GITEE_OWNER || !env.GITEE_REPO) return json({ error: 'Service is not configured' }, 503);
    const id = match[1];
    try {
      if (request.method === 'GET') {
        const archive = await readArchive(env, id);
        return archive ? json(archive.envelope) : json({ error: 'Archive not found' }, 404);
      }
      if (request.method === 'PUT') {
        const raw = await request.text();
        if (raw.length > 6_000_000) return json({ error: 'Archive is too large' }, 413);
        const envelope = JSON.parse(raw);
        if (envelope?.version !== 1 || typeof envelope.ciphertext !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.salt !== 'string') return json({ error: 'Invalid archive' }, 400);
        await writeArchive(env, id, envelope);
        return json({ ok: true, updatedAt: envelope.updatedAt });
      }
      return json({ error: 'Method not allowed' }, 405);
    } catch (error) {
      console.error(error);
      return json({ error: 'Archive service failed' }, 502);
    }
  }
};
