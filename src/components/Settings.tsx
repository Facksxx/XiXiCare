import { ChevronDown, Clock3, Database, Edit2, Info, Music2, Plus, Settings as SettingsIcon, Trash2, Users } from 'lucide-react';
import type { RemoteRelease } from '../utils/version';
import type { ActivityLog, BabyInfo, TimeInferenceMode } from '../types/baby';
import { DataTransfer } from './DataTransfer';
import { UpdateChecker } from './UpdateChecker';
import { SoundPackManager } from './SoundPackManager';

interface SettingsProps {
  timeInferenceMode: TimeInferenceMode;
  onTimeInferenceModeChange: (mode: TimeInferenceMode) => void;
  logs: ActivityLog[];
  onImportLogs: (logs: ActivityLog[]) => void;
  onImportBabies: (babies: BabyInfo[]) => void;
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

export function Settings({ timeInferenceMode, onTimeInferenceModeChange, logs, onImportLogs, onImportBabies, babies, activeBabyId, onAddBaby, onSwitchBaby, onEditBaby, onDeleteBaby, detectedRelease, onReleaseChange, onBack }: SettingsProps) {
  return (
    <div className="container settings-page fade-in">
      <div className="settings-heading">
        <button type="button" className="settings-back-button" onClick={onBack} aria-label="返回"><ChevronDown size={20} /></button>
        <span><SettingsIcon size={22} /></span>
        <div><h1>设置</h1><p>管理宝宝、数据与应用偏好</p></div>
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

      <section className="settings-section" aria-labelledby="time-inference-title">
        <div className="settings-item-heading">
          <span className="settings-icon" aria-hidden="true">
            <Clock3 size={18} />
          </span>
          <div>
            <h2 id="time-inference-title">快捷时间推断</h2>
            <p>记录大盘的时长快捷选项</p>
          </div>
        </div>

        <div className="settings-segmented" role="radiogroup" aria-label="快捷时间推断方式">
          <button
            type="button"
            role="radio"
            aria-checked={timeInferenceMode === 'end'}
            className={timeInferenceMode === 'end' ? 'active' : ''}
            onClick={() => onTimeInferenceModeChange('end')}
          >
            当前时间为结束
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={timeInferenceMode === 'start'}
            className={timeInferenceMode === 'start' ? 'active' : ''}
            onClick={() => onTimeInferenceModeChange('start')}
          >
            当前时间为开始
          </button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="data-management-title">
        <div className="settings-item-heading">
          <span className="settings-icon" aria-hidden="true"><Database size={18} /></span>
          <div>
            <h2 id="data-management-title">数据管理</h2>
            <p>完整备份与记录导入</p>
          </div>
        </div>
        <DataTransfer logs={logs} onImportLogs={onImportLogs} onImportBabies={onImportBabies} babies={babies} activeBabyId={activeBabyId} />
      </section>

      <section className="settings-section" aria-labelledby="sound-packs-title">
        <div className="settings-item-heading">
          <span className="settings-icon" aria-hidden="true"><Music2 size={18} /></span>
          <div><h2 id="sound-packs-title">睡眠声音包</h2><p>下载和管理本地声音资源</p></div>
        </div>
        <SoundPackManager />
      </section>

      <section className="settings-section" aria-labelledby="about-title">
        <div className="settings-item-heading">
          <span className="settings-icon" aria-hidden="true"><Info size={18} /></span>
          <div>
            <h2 id="about-title">关于</h2>
            <p>查看版本号并检查最新版本</p>
          </div>
        </div>
        <UpdateChecker detectedRelease={detectedRelease} onReleaseChange={onReleaseChange} />
      </section>
    </div>
  );
}
