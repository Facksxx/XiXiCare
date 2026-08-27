import { useState } from 'react';
import { Activity, ChevronDown, Edit2, Music2, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { RemoteRelease } from '../utils/version';
import type { ActivityLog, BabyInfo } from '../types/baby';
import { DataTransfer } from './DataTransfer';
import { UpdateChecker } from './UpdateChecker';
import { SoundPackManager } from './SoundPackManager';
import { updateVaccinePricesFromRemote, VACCINE_PRICE_UPDATED_AT_KEY } from '../utils/vaccines';

interface SettingsProps {
  logs: ActivityLog[];
  babies: BabyInfo[];
  activeBabyId: string;
  onAddBaby: () => void;
  onSwitchBaby: (babyId: string) => void;
  onEditBaby: (babyId: string) => void;
  onDeleteBaby: (babyId: string) => void;
  detectedRelease: RemoteRelease | null;
  onReleaseChange: (release: RemoteRelease | null) => void;
  onBack: () => void;
}

export function Settings({ logs, babies, activeBabyId, onAddBaby, onSwitchBaby, onEditBaby, onDeleteBaby, detectedRelease, onReleaseChange, onBack }: SettingsProps) {
  const [priceUpdating, setPriceUpdating] = useState(false);
  const [priceMessage, setPriceMessage] = useState('');
  const [priceUpdatedAt, setPriceUpdatedAt] = useState(() => {
    try { return JSON.parse(localStorage.getItem(VACCINE_PRICE_UPDATED_AT_KEY) || 'null') as string | null; }
    catch { return null; }
  });

  const updatePriceTable = async () => {
    setPriceUpdating(true);
    setPriceMessage('');
    try {
      const updatedAt = await updateVaccinePricesFromRemote();
      setPriceUpdatedAt(updatedAt);
      setPriceMessage('价格表已更新');
    } catch {
      setPriceMessage('更新失败，请检查网络后重试');
    } finally { setPriceUpdating(false); }
  };

  return (
    <div className="container settings-page fade-in">
      <div className="settings-heading">
        <button type="button" className="settings-back-button" onClick={onBack} aria-label="返回"><ChevronDown size={20} /></button>
        <h1>设置</h1>
      </div>

      <section className="settings-section" aria-labelledby="baby-management-title">
        <div className="settings-item-heading settings-baby-heading">
          <span className="settings-icon" aria-hidden="true"><Users size={18} /></span>
          <div><h2 id="baby-management-title">宝宝管理</h2><p>当前共 {babies.length} 位宝宝</p></div>
          <button type="button" className="settings-add-baby" onClick={onAddBaby}><Plus size={15} />添加</button>
        </div>
        <div className="settings-baby-list">
          {babies.map((baby) => (
            <div className={`settings-baby-row ${baby.id === activeBabyId ? 'active' : ''}`} key={baby.id}>
              <button type="button" className="settings-baby-select" onClick={() => onSwitchBaby(baby.id)} aria-pressed={baby.id === activeBabyId}>
                <span className="settings-baby-avatar">{baby.avatar ? <img src={baby.avatar} alt="" /> : baby.name.slice(0, 1)}</span>
                <span className="settings-baby-copy"><strong>{baby.name}</strong><small>{baby.birthday}{baby.id === activeBabyId ? ' · 当前宝宝' : ' · 点击切换'}</small></span>
              </button>
              <button type="button" onClick={() => onEditBaby(baby.id)} aria-label={`编辑${baby.name}`}><Edit2 size={15} /></button>
              <button type="button" disabled={babies.length <= 1} onClick={() => onDeleteBaby(baby.id)} aria-label={`删除${baby.name}`}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="data-management-title">
        <div id="data-management-title"><DataTransfer logs={logs} babies={babies} activeBabyId={activeBabyId} /></div>
      </section>

      <section className="settings-section" aria-labelledby="vaccine-data-title">
        <div className="settings-item-heading settings-price-update">
          <span className="settings-icon" aria-hidden="true"><Activity size={18} /></span>
          <div><h2 id="vaccine-data-title">疫苗价格表</h2><p>{priceMessage || (priceUpdatedAt ? `已更新：${priceUpdatedAt.slice(0, 10)}` : '使用内置价格，可从仓库更新')}</p></div>
          <button type="button" className="settings-icon-action" disabled={priceUpdating} onClick={updatePriceTable} aria-label="更新疫苗价格表"><RefreshCw size={16} className={priceUpdating ? 'spin' : ''} /></button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="sound-packs-title">
        <div className="settings-item-heading">
          <span className="settings-icon" aria-hidden="true"><Music2 size={18} /></span>
          <div><h2 id="sound-packs-title">睡眠声音包</h2><p>下载和管理本地声音资源</p></div>
        </div>
        <SoundPackManager />
      </section>

      {Capacitor.getPlatform() !== 'ios' && <section className="settings-section" aria-labelledby="about-title">
        <div id="about-title"><UpdateChecker detectedRelease={detectedRelease} onReleaseChange={onReleaseChange} /></div>
      </section>}
    </div>
  );
}
