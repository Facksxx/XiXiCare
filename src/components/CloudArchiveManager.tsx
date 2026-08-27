import { useState, useSyncExternalStore } from 'react';
import { CloudDownload, CloudUpload, Dice5, LoaderCircle } from 'lucide-react';
import type { BabyInfo } from '../types/baby';
import {
  CLOUD_ARCHIVE_BIRTHDAY_KEY,
  CLOUD_ARCHIVE_CODE_KEY,
  createArchiveCode,
  validateArchiveIdentity
} from '../utils/cloudArchive';
import {
  getCloudArchiveTaskState,
  runCloudArchiveDownload,
  runCloudArchiveUpload,
  subscribeCloudArchiveTask
} from '../utils/cloudArchiveTask';
import { ConfirmModal } from './ConfirmModal';

export function CloudArchiveManager({ babies, activeBabyId }: { babies: BabyInfo[]; activeBabyId: string }) {
  const activeBaby = babies.find(baby => baby.id === activeBabyId) ?? babies[0];
  const [code, setCode] = useState(() => localStorage.getItem(CLOUD_ARCHIVE_CODE_KEY) ?? '');
  const [birthday, setBirthday] = useState(() => localStorage.getItem(CLOUD_ARCHIVE_BIRTHDAY_KEY) ?? activeBaby?.birthday ?? '');
  const task = useSyncExternalStore(subscribeCloudArchiveTask, getCloudArchiveTaskState);
  const [localMessage, setLocalMessage] = useState('');
  const [confirmDownload, setConfirmDownload] = useState(false);
  const busy = task.phase === 'uploading' || task.phase === 'downloading';

  const upload = async () => {
    setLocalMessage('');
    try {
      validateArchiveIdentity(code, birthday);
      await runCloudArchiveUpload(code, birthday);
    } catch (error) { setLocalMessage(error instanceof Error ? error.message : '信息不完整'); }
  };

  const download = async () => {
    setLocalMessage('');
    setConfirmDownload(false);
    try {
      validateArchiveIdentity(code, birthday);
      await runCloudArchiveDownload(code, birthday);
    } catch (error) { setLocalMessage(error instanceof Error ? error.message : '信息不完整'); }
  };

  const message = localMessage || task.message;

  return <>
    <div className="cloud-archive-form">
      <label><span>6位存档码</span><div className="cloud-code-input"><input inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="请输入6位数字" /><button type="button" onClick={() => setCode(createArchiveCode())} aria-label="随机生成存档码"><Dice5 size={17} /></button></div></label>
      <label><span>验证生日</span><input type="date" value={birthday} onChange={event => setBirthday(event.target.value)} /></label>
      <div className="cloud-archive-actions">
        <button type="button" className={task.phase === 'success' ? 'success' : ''} disabled={busy} onClick={upload}>{task.phase === 'uploading' ? <LoaderCircle className="spin" size={17} /> : <CloudUpload size={17} />}<span>{task.phase === 'uploading' ? '后台上传中' : '上传存档'}</span></button>
        <button type="button" className={task.phase === 'success' ? 'success' : ''} disabled={busy} onClick={() => { try { validateArchiveIdentity(code, birthday); setLocalMessage(''); setConfirmDownload(true); } catch (error) { setLocalMessage(error instanceof Error ? error.message : '信息不完整'); } }}>{task.phase === 'downloading' ? <LoaderCircle className="spin" size={17} /> : <CloudDownload size={17} />}<span>{task.phase === 'downloading' ? '后台拉取中' : '拉取存档'}</span></button>
      </div>
      {(message || task.syncedAt) && <p className={task.phase === 'error' || message.includes('失败') || message.includes('错误') || message.includes('未找到') ? 'error' : ''}>{message || `上次同步：${new Date(task.syncedAt).toLocaleString('zh-CN')}`}</p>}
    </div>
    <ConfirmModal compact isOpen={confirmDownload} title="拉取云存档" message="将使用云端数据替换本机数据，确定继续吗？" type="warning" confirmText="确认拉取" onCancel={() => setConfirmDownload(false)} onConfirm={download} />
  </>;
}
