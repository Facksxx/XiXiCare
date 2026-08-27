const CLOUD_CONFIG_PREFIX = 'babycare_cloud_archive_';
const ARCHIVE_API_URL = (import.meta.env.VITE_CLOUD_ARCHIVE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface CloudArchiveEnvelope {
  version: 1;
  updatedAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
}

interface ArchiveSnapshot {
  version: 1;
  updatedAt: string;
  values: Record<string, string>;
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
};

const base64ToBytes = (value: string) => Uint8Array.from(atob(value), character => character.charCodeAt(0));

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

const mergeJsonArrayById = (remoteValue: string, localValue: string) => {
  try {
    const remote = JSON.parse(remoteValue) as Array<{ id?: string }>;
    const local = JSON.parse(localValue) as Array<{ id?: string }>;
    if (!Array.isArray(remote) || !Array.isArray(local)) return localValue;
    const merged = new Map<string, { id?: string }>();
    remote.forEach((item, index) => merged.set(item.id || `remote-${index}`, item));
    local.forEach((item, index) => merged.set(item.id || `local-${index}`, item));
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
  ['babycare_babies', 'babycare_logs'].forEach(key => {
    if (remote.values[key] && local.values[key]) values[key] = mergeJsonArrayById(remote.values[key], local.values[key]);
  });
  Object.keys(values).forEach(key => {
    if (!remote.values[key] || !local.values[key]) return;
    if (/^babycare_(vaccines|vaccine_selections|allergens)_/.test(key)) values[key] = mergeJsonObjects(remote.values[key], local.values[key]);
  });
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
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(snapshot)));
  return { version: 1, updatedAt: snapshot.updatedAt, salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
};

export const decryptArchiveSnapshot = async (envelope: CloudArchiveEnvelope, code: string, birthday: string): Promise<ArchiveSnapshot> => {
  validateArchiveIdentity(code, birthday);
  try {
    const key = await deriveKey(code, birthday, base64ToBytes(envelope.salt));
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext));
    const snapshot = JSON.parse(decoder.decode(plaintext)) as ArchiveSnapshot;
    if (snapshot.version !== 1 || !snapshot.values) throw new Error('存档格式错误');
    return snapshot;
  } catch { throw new Error('存档码或宝宝生日不正确'); }
};

const requireApiUrl = () => {
  if (!ARCHIVE_API_URL) throw new Error('云存档服务尚未配置');
  return ARCHIVE_API_URL;
};

export const fetchCloudArchive = async (code: string, birthday: string): Promise<CloudArchiveEnvelope | null> => {
  const response = await fetch(`${requireApiUrl()}/archive/${getArchiveId(code, birthday)}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`读取云存档失败（${response.status}）`);
  return response.json() as Promise<CloudArchiveEnvelope>;
};

export const saveCloudArchive = async (code: string, birthday: string, envelope: CloudArchiveEnvelope) => {
  const response = await fetch(`${requireApiUrl()}/archive/${getArchiveId(code, birthday)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope)
  });
  if (!response.ok) throw new Error(`上传云存档失败（${response.status}）`);
};

export const CLOUD_ARCHIVE_CODE_KEY = `${CLOUD_CONFIG_PREFIX}code`;
export const CLOUD_ARCHIVE_BIRTHDAY_KEY = `${CLOUD_CONFIG_PREFIX}birthday`;
export const CLOUD_ARCHIVE_SYNCED_AT_KEY = `${CLOUD_CONFIG_PREFIX}synced_at`;
