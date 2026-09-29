import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { gunzipSync } from 'fflate';

const encode = value => utf8ToBytes(value);
const decode = bytes => {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  let text = '';
  for (let i = 0; i < bytes.length; i++) text += `%${bytes[i].toString(16).padStart(2, '0')}`;
  return decodeURIComponent(text);
};
const b64 = bytes => wx.arrayBufferToBase64(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const unb64 = value => new Uint8Array(wx.base64ToArrayBuffer(value));
const random = length => new Promise((resolve, reject) => wx.getRandomValues({length, success: res => resolve(new Uint8Array(res.randomValues)), fail: reject}));
const key = (code, birthday, salt) => pbkdf2Async(sha256, encode(`${code}:${birthday}`), salt, { c: 310000, dkLen: 32, asyncTick: 10 });
export async function encrypt(values, code, birthday) {
  const salt = await random(16), iv = await random(12);
  const snapshot = { version: 1, updatedAt: new Date().toISOString(), values };
  const plaintext = encode(JSON.stringify(snapshot));
  const ciphertext = gcm(await key(code, birthday, salt), iv).encrypt(plaintext);
  return { version: 2, updatedAt: snapshot.updatedAt, digest: b64(sha256(encode(JSON.stringify(values)))), salt: b64(salt), iv: b64(iv), ciphertext: b64(ciphertext) };
}
export async function decrypt(envelope, code, birthday) {
  const raw = gcm(await key(code, birthday, unb64(envelope.salt)), unb64(envelope.iv)).decrypt(unb64(envelope.ciphertext));
  const plaintext = envelope.compression === 'gzip' ? gunzipSync(raw) : raw;
  const snapshot = JSON.parse(decode(plaintext));
  if (snapshot.version !== 1 || !snapshot.values) throw new Error('存档格式错误');
  return snapshot;
}
