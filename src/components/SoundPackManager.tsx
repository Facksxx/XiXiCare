import { useState } from 'react';
import { Check, Download, Music2, Trash2 } from 'lucide-react';
import { deleteSoundPack, downloadSoundPack, getInstalledSoundPacks, SOUND_PACKS, type SoundCategory } from '../utils/soundPacks';

export function SoundPackManager() {
  const [installed, setInstalled] = useState<SoundCategory[]>(getInstalledSoundPacks);
  const [working, setWorking] = useState<SoundCategory | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const install = async (packId: SoundCategory) => {
    const pack = SOUND_PACKS.find(item => item.id === packId)!;
    setWorking(packId); setProgress(0); setError('');
    try {
      await downloadSoundPack(pack, (done, total) => setProgress(Math.round(done / total * 100)));
      setInstalled(getInstalledSoundPacks());
    } catch {
      setError('声音包下载中断，请重新下载');
    } finally { setWorking(null); }
  };

  const remove = async (packId: SoundCategory) => {
    await deleteSoundPack(packId);
    setInstalled(getInstalledSoundPacks());
  };

  return <div className="sound-pack-manager">
    {SOUND_PACKS.map(pack => {
      const ready = installed.includes(pack.id);
      const loading = working === pack.id;
      return <div className="sound-pack-row" key={pack.id}>
        <span className="sound-pack-icon"><Music2 size={18} /></span>
        <span className="sound-pack-copy"><strong>{pack.name}</strong><small>{pack.description} · {pack.sizeMb.toFixed(1)} MB</small>{loading && <i><b style={{ width: `${progress}%` }} /></i>}</span>
        {ready ? <button type="button" className="sound-pack-remove" onClick={() => void remove(pack.id)} aria-label={`删除${pack.name}`}><Trash2 size={16} /></button>
          : <button type="button" className="sound-pack-download" disabled={working !== null} onClick={() => void install(pack.id)}>{loading ? `${progress}%` : <><Download size={15} />下载</>}</button>}
        {ready && <Check className="sound-pack-ready" size={14} />}
      </div>;
    })}
    {error && <p className="sound-pack-error">{error}</p>}
  </div>;
}
