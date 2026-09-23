import {
  applyArchiveSnapshot,
  captureArchiveSnapshot,
  CLOUD_ARCHIVE_BIRTHDAY_KEY,
  CLOUD_ARCHIVE_CODE_KEY,
  CLOUD_ARCHIVE_SYNCED_AT_KEY,
  decryptArchiveSnapshot,
  encryptArchiveSnapshot,
  fetchCloudArchive,
  fetchCloudArchiveMeta,
  isCloudArchiveAutoSyncEnabled,
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

const stopAutoSyncIfDisabled = () => {
  if (isCloudArchiveAutoSyncEnabled()) return false;
  setState({ phase: 'idle', message: '自动同步已关闭', syncedAt: state.syncedAt });
  return true;
};

export const runCloudArchiveUpload = async (code: string, birthday: string) => {
  if (isCloudArchiveTaskBusy()) return;
  rememberIdentity(code, birthday);
  setState({ phase: 'uploading', message: '正在后台上传存档…', syncedAt: state.syncedAt });
  try {
    const local = captureArchiveSnapshot();
    const meta = await fetchCloudArchiveMeta(code, birthday);
    const remoteEnvelope = meta ? await fetchCloudArchive(code, birthday) : null;
    const snapshot = remoteEnvelope
      ? mergeArchiveSnapshots(await decryptArchiveSnapshot(remoteEnvelope, code, birthday), local)
      : local;
    await saveCloudArchive(code, birthday, await encryptArchiveSnapshot(snapshot, code, birthday), meta?.revision ?? 0);
    markSynced(remoteEnvelope ? '已合并并上传最新存档' : '云存档已创建', snapshot.updatedAt);
  } catch (error) {
    fail(error, '上传失败，请稍后重试');
  }
};

export const runCloudArchiveAutoSync = async () => {
  if (!isCloudArchiveAutoSyncEnabled() || isCloudArchiveTaskBusy() || !navigator.onLine) return;
  const code = localStorage.getItem(CLOUD_ARCHIVE_CODE_KEY) ?? '';
  const birthday = localStorage.getItem(CLOUD_ARCHIVE_BIRTHDAY_KEY) ?? '';
  if (!code || !birthday) return;
  const pendingToken = localStorage.getItem('babycare_cloud_archive_pending');
  setState({ phase: 'uploading', message: '正在自动同步…', syncedAt: state.syncedAt });
  try {
    let local = captureArchiveSnapshot();
    const localEnvelope = await encryptArchiveSnapshot(local, code, birthday);
    let meta = await fetchCloudArchiveMeta(code, birthday);
    if (stopAutoSyncIfDisabled()) return;
    if (meta && meta.digest === localEnvelope.digest) {
      const currentToken = localStorage.getItem('babycare_cloud_archive_pending');
      if (currentToken === pendingToken) localStorage.removeItem('babycare_cloud_archive_pending');
      else window.setTimeout(() => void runCloudArchiveAutoSync(), 0);
      markSynced('已是最新存档', meta.updatedAt);
      return;
    }
    let snapshot = local;
    if (meta) {
      const remoteEnvelope = await fetchCloudArchive(code, birthday);
      if (stopAutoSyncIfDisabled()) return;
      if (remoteEnvelope) snapshot = mergeArchiveSnapshots(await decryptArchiveSnapshot(remoteEnvelope, code, birthday), local);
    }
    if (stopAutoSyncIfDisabled()) return;

    // 网络请求期间可能又发生编辑或删除。上传前必须重新读取当前本地状态，
    // 否则较早捕获的快照会把刚刚完成的操作覆盖掉。
    const tokenBeforeUpload = localStorage.getItem('babycare_cloud_archive_pending');
    if (tokenBeforeUpload !== pendingToken) {
      local = captureArchiveSnapshot();
      snapshot = mergeArchiveSnapshots(snapshot, local);
    }
    try {
      await saveCloudArchive(code, birthday, await encryptArchiveSnapshot(snapshot, code, birthday), meta?.revision ?? 0);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'CLOUD_ARCHIVE_CONFLICT') throw error;
      meta = await fetchCloudArchiveMeta(code, birthday);
      const latestEnvelope = await fetchCloudArchive(code, birthday);
      if (stopAutoSyncIfDisabled()) return;
      local = captureArchiveSnapshot();
      snapshot = latestEnvelope ? mergeArchiveSnapshots(await decryptArchiveSnapshot(latestEnvelope, code, birthday), local) : local;
      await saveCloudArchive(code, birthday, await encryptArchiveSnapshot(snapshot, code, birthday), meta?.revision ?? 0);
    }
    const tokenAfterUpload = localStorage.getItem('babycare_cloud_archive_pending');
    const localChangedDuringSync = tokenAfterUpload !== tokenBeforeUpload;
    const changedLocally = JSON.stringify(snapshot.values) !== JSON.stringify(local.values);
    // 只允许把远端合并结果应用到捕获时的同一份本地状态。若同步期间又有
    // 新操作，保留当前页面数据，并让现有 pending 标记触发下一次同步。
    if (changedLocally && !localChangedDuringSync) applyArchiveSnapshot(snapshot);
    if (!localChangedDuringSync && tokenAfterUpload === tokenBeforeUpload) localStorage.removeItem('babycare_cloud_archive_pending');
    markSynced('自动同步完成', snapshot.updatedAt);
    if (localChangedDuringSync) window.setTimeout(() => void runCloudArchiveAutoSync(), 0);
  } catch (error) {
    localStorage.setItem('babycare_cloud_archive_pending', '1');
    fail(error, '自动同步失败，联网后重试');
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
