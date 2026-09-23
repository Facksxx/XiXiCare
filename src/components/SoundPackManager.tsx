import { useEffect, useRef, useState } from 'react';
import { Check, Download, Music2, Trash2, X } from 'lucide-react';
import { CLOUD_ARCHIVE_APPLIED_EVENT } from '../utils/cloudArchive';
import { cancelSoundPackDownload, createSoundPackDownloadTask, deleteSoundPack, downloadSoundPack, reconcileInstalledSoundPacks, SOUND_PACKS, type SoundCategory, type SoundPackDownloadTask } from '../utils/soundPacks';

export function SoundPackManager() {
  const [installed, setInstalled] = useState<SoundCategory[]>([]);
  const tasks = useRef<Partial<Record<SoundCategory, SoundPackDownloadTask>>>({});
  const [progress, setProgress] = useState<Partial<Record<SoundCategory, number>>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const refresh = () => { void reconcileInstalledSoundPacks().then(ids => { if (active) setInstalled(ids); }); };
    refresh();
    window.addEventListener(CLOUD_ARCHIVE_APPLIED_EVENT, refresh);
    return () => { active = false; window.removeEventListener(CLOUD_ARCHIVE_APPLIED_EVENT, refresh); };
  }, []);

  const install = async (packId: SoundCategory) => {
    if (tasks.current[packId]) return;
    const pack = SOUND_PACKS.find(item => item.id === packId)!;
    const task = createSoundPackDownloadTask(packId);
    tasks.current[packId] = task;
    setProgress(current => ({ ...current, [packId]: 0 })); setError('');
    try {
      await downloadSoundPack(pack, task, (done, total) => setProgress(current => ({ ...current, [packId]: Math.round(done / total * 100) })));
      setInstalled(await reconcileInstalledSoundPacks());
    } catch {
      if (!task.cancelled) setError(`${pack.name}下载中断，请重新下载`);
    } finally {
      delete tasks.current[packId];
      setProgress(current => { const next = { ...current }; delete next[packId]; return next; });
    }
  };

  const cancel = async (packId: SoundCategory) => {
    const task = tasks.current[packId];
    if (task) await cancelSoundPackDownload(task);
  };

  const remove = async (packId: SoundCategory) => {
    await deleteSoundPack(packId);
    setInstalled(await reconcileInstalledSoundPacks());
  };

  return <div className="sound-pack-manager">
    {SOUND_PACKS.map(pack => {
      const ready = installed.includes(pack.id);
      const loading = progress[pack.id] !== undefined;
      return <div className="sound-pack-row" key={pack.id}>
        <span className="sound-pack-icon"><Music2 size={18} /></span>
        <span className="sound-pack-copy">
          <strong>
            <span>{pack.name}</span>
            <em>{ready && <Check size={12} />}{loading ? `${progress[pack.id]}%` : ready ? '已下载' : '未下载'}<b>{pack.sizeMb.toFixed(1)} MB</b></em>
          </strong>
          <small>{pack.description}</small>
          {loading && <i><b style={{ width: `${progress[pack.id]}%` }} /></i>}
        </span>
        {ready ? <button type="button" className="sound-pack-remove" onClick={() => void remove(pack.id)} aria-label={`删除${pack.name}`}><Trash2 size={16} /></button>
          : <button type="button" className={`sound-pack-download${loading ? ' is-cancelling' : ''}`} onClick={() => void (loading ? cancel(pack.id) : install(pack.id))} aria-label={loading ? `取消下载${pack.name}` : `下载${pack.name}`} title={loading ? `取消下载 ${progress[pack.id]}%` : `下载${pack.name}`}>{loading ? <X size={17} /> : <Download size={17} />}</button>}
      </div>;
    })}
    {error && <p className="sound-pack-error">{error}</p>}
  </div>;
}
