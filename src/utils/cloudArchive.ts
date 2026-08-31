const CLOUD_CONFIG_PREFIX = 'babycare_cloud_archive_';
const SYNC_META_KEY = 'babycare_sync_meta';
export const CLOUD_ARCHIVE_MUTATION_EVENT = 'xixicare:archive-mutation';
const ARCHIVE_API_URL = (import.meta.env.VITE_CLOUD_ARCHIVE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface CloudArchiveEnvelope {
  version: 1 | 2;
  updatedAt: string;
  digest?: string;
  baseRevision?: number;
  compression?: 'gzip';
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface ArchiveSnapshot {
  version: 1;
  updatedAt: string;
  values: Record<string, string>;
}

interface SyncMeta {
  keys: Record<string, string>;
  records: Record<string, Record<string, string>>;
  tombstones: Record<string, Record<string, string>>;
}

const emptySyncMeta = (): SyncMeta => ({ keys: {}, records: {}, tombstones: {} });
const readSyncMeta = (values?: Record<string, string>): SyncMeta => {
  try { return JSON.parse(values?.[SYNC_META_KEY] ?? localStorage.getItem(SYNC_META_KEY) ?? '') as SyncMeta; }
  catch { return emptySyncMeta(); }
};

export const recordArchiveMutation = (key: string, previousValue: unknown, nextValue: unknown) => {
  if (!key.startsWith('babycare_') || key.startsWith(CLOUD_CONFIG_PREFIX) || key === SYNC_META_KEY) return;
  const now = new Date().toISOString();
  const meta = readSyncMeta();
  meta.keys[key] = now;
  if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
    const before = new Map(previousValue.filter(item => item && typeof item === 'object' && 'id' in item).map(item => [String(item.id), item]));
    const after = new Map(nextValue.filter(item => item && typeof item === 'object' && 'id' in item).map(item => [String(item.id), item]));
    meta.records[key] ||= {};
    meta.tombstones[key] ||= {};
    after.forEach((item, id) => {
      if (JSON.stringify(before.get(id)) !== JSON.stringify(item)) meta.records[key][id] = now;
      delete meta.tombstones[key][id];
    });
    before.forEach((_item, id) => {
      if (!after.has(id)) {
        meta.tombstones[key][id] = now;
        delete meta.records[key][id];
      }
    });
  }
  localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
  window.dispatchEvent(new CustomEvent(CLOUD_ARCHIVE_MUTATION_EVENT, { detail: { key } }));
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));

const sha256 = async (value: Uint8Array) => bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', value as BufferSource)));

const compressBytes = async (bytes: Uint8Array) => {
  if (typeof CompressionStream === 'undefined') return { bytes, compression: undefined } as const;
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), compression: 'gzip' as const };
};

const decompressBytes = async (bytes: Uint8Array, compression?: 'gzip') => {
  if (compression !== 'gzip') return bytes;
  if (typeof DecompressionStream === 'undefined') throw new Error('当前系统不支持解压云存档');
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const deriveKey = async (code: string, birthday: string, salt: Uint8Array) => {
  const source = await crypto.subtle.importKey('raw', encoder.encode(`${code}:${birthday}`), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 310_000 },
    source,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const createArchiveCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');

export const validateArchiveIdentity = (code: string, birthday: string) => {
  if (!/^\d{6}$/.test(code)) throw new Error('请输入6位数字存档码');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || Number.isNaN(new Date(`${birthday}T00:00:00`).getTime())) throw new Error('请选择正确的宝宝生日');
};

export const getArchiveId = (code: string, birthday: string) => {
  validateArchiveIdentity(code, birthday);
  return `${code}-${birthday.replaceAll('-', '')}`;
};

export const captureArchiveSnapshot = (): ArchiveSnapshot => {
  const values: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith('babycare_') || key.startsWith(CLOUD_CONFIG_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return { version: 1, updatedAt: new Date().toISOString(), values };
};

const mergeJsonArrayById = (key: string, remoteValue: string, localValue: string, remoteMeta: SyncMeta, localMeta: SyncMeta) => {
  try {
    const remote = JSON.parse(remoteValue) as Array<{ id?: string }>;
    const local = JSON.parse(localValue) as Array<{ id?: string }>;
    if (!Array.isArray(remote) || !Array.isArray(local)) return localValue;
    const remoteItems = new Map(remote.map((item, index) => [item.id || `remote-${index}`, item]));
    const localItems = new Map(local.map((item, index) => [item.id || `local-${index}`, item]));
    const ids = new Set([...remoteItems.keys(), ...localItems.keys(), ...Object.keys(remoteMeta.tombstones[key] || {}), ...Object.keys(localMeta.tombstones[key] || {})]);
    const merged = new Map<string, { id?: string }>();
    ids.forEach(id => {
      const remoteTime = remoteMeta.records[key]?.[id] || remoteMeta.keys[key] || '';
      const localTime = localMeta.records[key]?.[id] || localMeta.keys[key] || '';
      const remoteDeleted = remoteMeta.tombstones[key]?.[id] || '';
      const localDeleted = localMeta.tombstones[key]?.[id] || '';
      const newestDelete = remoteDeleted > localDeleted ? remoteDeleted : localDeleted;
      const newestEdit = remoteTime > localTime ? remoteTime : localTime;
      if (newestDelete && newestDelete >= newestEdit) return;
      const item = remoteTime > localTime ? remoteItems.get(id) : localItems.get(id) ?? remoteItems.get(id);
      if (item) merged.set(id, item);
    });
    return JSON.stringify(Array.from(merged.values()));
  } catch { return localValue; }
};

const mergeJsonObjects = (remoteValue: string, localValue: string) => {
  try {
    const remote = JSON.parse(remoteValue);
    const local = JSON.parse(localValue);
    if (!remote || !local || Array.isArray(remote) || Array.isArray(local) || typeof remote !== 'object' || typeof local !== 'object') return localValue;
    return JSON.stringify({ ...remote, ...local });
  } catch { return localValue; }
};

export const mergeArchiveSnapshots = (remote: ArchiveSnapshot, local: ArchiveSnapshot): ArchiveSnapshot => {
  const values = { ...remote.values, ...local.values };
  const remoteMeta = readSyncMeta(remote.values);
  const localMeta = readSyncMeta(local.values);
  ['babycare_babies', 'babycare_logs'].forEach(key => {
    if (remote.values[key] && local.values[key]) values[key] = mergeJsonArrayById(key, remote.values[key], local.values[key], remoteMeta, localMeta);
  });
  Object.keys(values).forEach(key => {
    if (!remote.values[key] || !local.values[key]) return;
    if (/^babycare_(vaccines|vaccine_selections|allergens)_/.test(key)) values[key] = mergeJsonObjects(remote.values[key], local.values[key]);
  });
  const mergedMeta = emptySyncMeta();
  for (const source of [remoteMeta, localMeta]) {
    Object.entries(source.keys || {}).forEach(([key, time]) => { if (time > (mergedMeta.keys[key] || '')) mergedMeta.keys[key] = time; });
    for (const bucket of ['records', 'tombstones'] as const) Object.entries(source[bucket] || {}).forEach(([key, entries]) => {
      mergedMeta[bucket][key] ||= {};
      Object.entries(entries).forEach(([id, time]) => { if (time > (mergedMeta[bucket][key][id] || '')) mergedMeta[bucket][key][id] = time; });
    });
  }
  values[SYNC_META_KEY] = JSON.stringify(mergedMeta);
  return { version: 1, updatedAt: new Date().toISOString(), values };
};

export const applyArchiveSnapshot = (snapshot: ArchiveSnapshot) => {
  const preserved = new Map<string, string>();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(CLOUD_CONFIG_PREFIX)) preserved.set(key, localStorage.getItem(key) ?? '');
  }
  Object.keys(localStorage).filter(key => key.startsWith('babycare_')).forEach(key => localStorage.removeItem(key));
  Object.entries(snapshot.values).forEach(([key, value]) => localStorage.setItem(key, value));
  preserved.forEach((value, key) => localStorage.setItem(key, value));
};

export const encryptArchiveSnapshot = async (snapshot: ArchiveSnapshot, code: string, birthday: string): Promise<CloudArchiveEnvelope> => {
  validateArchiveIdentity(code, birthday);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, birthday, salt);
  const plaintext = encoder.encode(JSON.stringify(snapshot));
  const compressed = await compressBytes(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, compressed.bytes as BufferSource);
  const contentDigest = await sha256(encoder.encode(JSON.stringify(snapshot.values)));
  return { version: 2, updatedAt: snapshot.updatedAt, digest: contentDigest, compression: compressed.compression, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
};

export const decryptArchiveSnapshot = async (envelope: CloudArchiveEnvelope, code: string, birthday: string): Promise<ArchiveSnapshot> => {
  validateArchiveIdentity(code, birthday);
  try {
    const key = await deriveKey(code, birthday, base64ToBytes(envelope.salt));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext));
    const bytes = await decompressBytes(new Uint8Array(plaintext), envelope.compression);
    const snapshot = JSON.parse(decoder.decode(bytes)) as ArchiveSnapshot;
    if (snapshot.version !== 1 || !snapshot.values) throw new Error('存档格式错误');
    return snapshot;
  } catch { throw new Error('存档码或宝宝生日不正确'); }
};

const requireApiUrl = () => {
  if (!ARCHIVE_API_URL) throw new Error('云存档服务尚未配置');
  return ARCHIVE_API_URL;
};

export interface CloudArchiveMeta {
  revision: number;
  digest: string;
  updatedAt: string;
}

export const fetchCloudArchiveMeta = async (code: string, birthday: string): Promise<CloudArchiveMeta | null> => {
  const response = await fetch(`${requireApiUrl()}/archive/${getArchiveId(code, birthday)}/meta`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`校验云存档失败（${response.status}）`);
  return response.json() as Promise<CloudArchiveMeta>;
};

export const fetchCloudArchive = async (code: string, birthday: string): Promise<CloudArchiveEnvelope | null> => {
  const response = await fetch(`${requireApiUrl()}/archive/${getArchiveId(code, birthday)}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `读取云存档失败（${response.status}）`);
  }
  return response.json() as Promise<CloudArchiveEnvelope>;
};

export const saveCloudArchive = async (code: string, birthday: string, envelope: CloudArchiveEnvelope, baseRevision?: number) => {
  if (baseRevision !== undefined) envelope.baseRevision = baseRevision;
  const response = await fetch(`${requireApiUrl()}/archive/${getArchiveId(code, birthday)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope)
  });
  if (response.status === 409) throw new Error('CLOUD_ARCHIVE_CONFLICT');
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `上传云存档失败（${response.status}）`);
  }
};

export const CLOUD_ARCHIVE_CODE_KEY = `${CLOUD_CONFIG_PREFIX}code`;
export const CLOUD_ARCHIVE_BIRTHDAY_KEY = `${CLOUD_CONFIG_PREFIX}birthday`;
export const CLOUD_ARCHIVE_SYNCED_AT_KEY = `${CLOUD_CONFIG_PREFIX}synced_at`;
