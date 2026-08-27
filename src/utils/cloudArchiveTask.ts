import {
  applyArchiveSnapshot,
  captureArchiveSnapshot,
  CLOUD_ARCHIVE_BIRTHDAY_KEY,
  CLOUD_ARCHIVE_CODE_KEY,
  CLOUD_ARCHIVE_SYNCED_AT_KEY,
  decryptArchiveSnapshot,
  encryptArchiveSnapshot,
  fetchCloudArchive,
  mergeArchiveSnapshots,
  saveCloudArchive,
  validateArchiveIdentity
} from './cloudArchive';

export type CloudArchiveTaskPhase = 'idle' | 'uploading' | 'downloading' | 'success' | 'error';

export interface CloudArchiveTaskState {
  phase: CloudArchiveTaskPhase;
  message: string;
  syncedAt: string;
}

let state: CloudArchiveTaskState = {
  phase: 'idle',
  message: '',
  syncedAt: localStorage.getItem(CLOUD_ARCHIVE_SYNCED_AT_KEY) ?? ''
};
const listeners = new Set<() => void>();

const setState = (next: CloudArchiveTaskState) => {
  state = next;
  listeners.forEach(listener => listener());
};

const rememberIdentity = (code: string, birthday: string) => {
  validateArchiveIdentity(code, birthday);
  localStorage.setItem(CLOUD_ARCHIVE_CODE_KEY, code);
  localStorage.setItem(CLOUD_ARCHIVE_BIRTHDAY_KEY, birthday);
};

const markSynced = (message: string, syncedAt = new Date().toISOString()) => {
  localStorage.setItem(CLOUD_ARCHIVE_SYNCED_AT_KEY, syncedAt);
  setState({ phase: 'success', message, syncedAt });
};

const fail = (error: unknown, fallback: string) => {
  setState({
    phase: 'error',
    message: error instanceof Error ? error.message : fallback,
    syncedAt: state.syncedAt
  });
};

export const getCloudArchiveTaskState = () => state;
export const subscribeCloudArchiveTask = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const isCloudArchiveTaskBusy = () => state.phase === 'uploading' || state.phase === 'downloading';

export const runCloudArchiveUpload = async (code: string, birthday: string) => {
  if (isCloudArchiveTaskBusy()) return;
  rememberIdentity(code, birthday);
  setState({ phase: 'uploading', message: '正在后台上传存档…', syncedAt: state.syncedAt });
  try {
    const local = captureArchiveSnapshot();
    const remoteEnvelope = await fetchCloudArchive(code, birthday);
    const snapshot = remoteEnvelope
      ? mergeArchiveSnapshots(await decryptArchiveSnapshot(remoteEnvelope, code, birthday), local)
      : local;
    await saveCloudArchive(code, birthday, await encryptArchiveSnapshot(snapshot, code, birthday));
    markSynced(remoteEnvelope ? '已合并并上传最新存档' : '云存档已创建', snapshot.updatedAt);
  } catch (error) {
    fail(error, '上传失败，请稍后重试');
  }
};

export const runCloudArchiveDownload = async (code: string, birthday: string) => {
  if (isCloudArchiveTaskBusy()) return;
  rememberIdentity(code, birthday);
  setState({ phase: 'downloading', message: '正在后台拉取存档…', syncedAt: state.syncedAt });
  try {
    const envelope = await fetchCloudArchive(code, birthday);
    if (!envelope) throw new Error('未找到对应云存档');
    applyArchiveSnapshot(await decryptArchiveSnapshot(envelope, code, birthday));
    markSynced('存档已恢复，正在刷新', envelope.updatedAt);
    window.setTimeout(() => window.location.reload(), 600);
  } catch (error) {
    fail(error, '拉取失败，请稍后重试');
  }
};
