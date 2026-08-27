import { Activity, ChevronDown, Edit2, Music2, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import type { RemoteRelease } from '../utils/version';
import type { ActivityLog, BabyInfo } from '../types/baby';
import { DataTransfer } from './DataTransfer';
import { UpdateChecker } from './UpdateChecker';
import { SoundPackManager } from './SoundPackManager';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { defaultVaccinePrices, VACCINE_PRICE_STORAGE_KEY, vaccinePriceOptions, type VaccinePrices } from '../utils/vaccines';

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
  const [vaccinePrices, setVaccinePrices] = useLocalStorage<VaccinePrices>(VACCINE_PRICE_STORAGE_KEY, defaultVaccinePrices);

  const updateVaccinePrice = (id: string, rawValue: string) => {
    const price = Math.max(0, Number(rawValue) || 0);
    setVaccinePrices({ ...defaultVaccinePrices, ...vaccinePrices, [id]: price });
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

      <section className="settings-section" aria-labelledby="vaccine-prices-title">
        <div className="settings-item-heading">
          <span className="settings-icon" aria-hidden="true"><Activity size={18} /></span>
          <div><h2 id="vaccine-prices-title">疫苗价格</h2><p>用于接种计划费用估算</p></div>
          <button type="button" className="settings-icon-action" onClick={() => setVaccinePrices(defaultVaccinePrices)} aria-label="恢复默认价格"><RefreshCw size={16} /></button>
        </div>
        <div className="vaccine-price-list">
          {vaccinePriceOptions.map(option => (
            <label className="vaccine-price-row" key={option.priceKey}>
              <span>{option.name}{option.brand ? <small>{option.brand}</small> : null}</span>
              <span className="vaccine-price-input"><b>¥</b><input type="number" min="0" step="0.01" inputMode="decimal" value={vaccinePrices[option.priceKey] ?? defaultVaccinePrices[option.priceKey] ?? 0} onChange={event => updateVaccinePrice(option.priceKey, event.target.value)} aria-label={`${option.name}${option.brand || ''}价格`} /></span>
            </label>
          ))}
        </div>
        <p className="settings-footnote">国家免疫规划疫苗默认按免费计算；自费价格因地区和品牌不同，可按实际情况修改。</p>
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
