import { useState } from 'react';
import { CloudDownload, CloudUpload, Dice5, LoaderCircle } from 'lucide-react';
import type { BabyInfo } from '../types/baby';
import {
  applyArchiveSnapshot,
  captureArchiveSnapshot,
  CLOUD_ARCHIVE_BIRTHDAY_KEY,
  CLOUD_ARCHIVE_CODE_KEY,
  CLOUD_ARCHIVE_SYNCED_AT_KEY,
  createArchiveCode,
  decryptArchiveSnapshot,
  encryptArchiveSnapshot,
  fetchCloudArchive,
  mergeArchiveSnapshots,
  saveCloudArchive,
  validateArchiveIdentity
} from '../utils/cloudArchive';
import { ConfirmModal } from './ConfirmModal';

export function CloudArchiveManager({ babies, activeBabyId }: { babies: BabyInfo[]; activeBabyId: string }) {
  const activeBaby = babies.find(baby => baby.id === activeBabyId) ?? babies[0];
  const [code, setCode] = useState(() => localStorage.getItem(CLOUD_ARCHIVE_CODE_KEY) ?? '');
  const [birthday, setBirthday] = useState(() => localStorage.getItem(CLOUD_ARCHIVE_BIRTHDAY_KEY) ?? activeBaby?.birthday ?? '');
  const [syncedAt, setSyncedAt] = useState(() => localStorage.getItem(CLOUD_ARCHIVE_SYNCED_AT_KEY) ?? '');
  const [busy, setBusy] = useState<'upload' | 'download' | null>(null);
  const [message, setMessage] = useState('');
  const [confirmDownload, setConfirmDownload] = useState(false);

  const rememberIdentity = () => {
    validateArchiveIdentity(code, birthday);
    localStorage.setItem(CLOUD_ARCHIVE_CODE_KEY, code);
    localStorage.setItem(CLOUD_ARCHIVE_BIRTHDAY_KEY, birthday);
  };

  const markSynced = (time = new Date().toISOString()) => {
    localStorage.setItem(CLOUD_ARCHIVE_SYNCED_AT_KEY, time);
    setSyncedAt(time);
  };

  const upload = async () => {
    setBusy('upload');
    setMessage('');
    try {
      rememberIdentity();
      const local = captureArchiveSnapshot();
      const remoteEnvelope = await fetchCloudArchive(code, birthday);
      const snapshot = remoteEnvelope ? mergeArchiveSnapshots(await decryptArchiveSnapshot(remoteEnvelope, code, birthday), local) : local;
      await saveCloudArchive(code, birthday, await encryptArchiveSnapshot(snapshot, code, birthday));
      markSynced(snapshot.updatedAt);
      setMessage(remoteEnvelope ? '已合并并上传最新存档' : '云存档已创建');
    } catch (error) { setMessage(error instanceof Error ? error.message : '上传失败，请稍后重试'); }
    finally { setBusy(null); }
  };

  const download = async () => {
    setBusy('download');
    setMessage('');
    try {
      rememberIdentity();
      const envelope = await fetchCloudArchive(code, birthday);
      if (!envelope) throw new Error('未找到对应云存档');
      applyArchiveSnapshot(await decryptArchiveSnapshot(envelope, code, birthday));
      markSynced(envelope.updatedAt);
      setConfirmDownload(false);
      setMessage('存档已恢复，正在刷新');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) { setMessage(error instanceof Error ? error.message : '拉取失败，请稍后重试'); setConfirmDownload(false); }
    finally { setBusy(null); }
  };

  return <>
    <div className="cloud-archive-form">
      <label><span>6位存档码</span><div className="cloud-code-input"><input inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="请输入6位数字" /><button type="button" onClick={() => setCode(createArchiveCode())} aria-label="随机生成存档码"><Dice5 size={17} /></button></div></label>
      <label><span>验证生日</span><input type="date" value={birthday} onChange={event => setBirthday(event.target.value)} /></label>
      <div className="cloud-archive-actions">
        <button type="button" disabled={Boolean(busy)} onClick={upload}>{busy === 'upload' ? <LoaderCircle className="spin" size={17} /> : <CloudUpload size={17} />}<span>上传存档</span></button>
        <button type="button" disabled={Boolean(busy)} onClick={() => { try { validateArchiveIdentity(code, birthday); setConfirmDownload(true); } catch (error) { setMessage(error instanceof Error ? error.message : '信息不完整'); } }}>{busy === 'download' ? <LoaderCircle className="spin" size={17} /> : <CloudDownload size={17} />}<span>拉取存档</span></button>
      </div>
      {(message || syncedAt) && <p className={message.includes('失败') || message.includes('错误') || message.includes('未找到') ? 'error' : ''}>{message || `上次同步：${new Date(syncedAt).toLocaleString('zh-CN')}`}</p>}
    </div>
    <ConfirmModal compact isOpen={confirmDownload} title="拉取云存档" message="将使用云端数据替换本机数据，确定继续吗？" type="warning" confirmText="确认拉取" onCancel={() => setConfirmDownload(false)} onConfirm={download} />
  </>;
}
