import { Clock3, Database } from 'lucide-react';
import type { ActivityLog, TimeInferenceMode } from '../types/baby';
import { DataTransfer } from './DataTransfer';

interface SettingsProps {
  timeInferenceMode: TimeInferenceMode;
  onTimeInferenceModeChange: (mode: TimeInferenceMode) => void;
  logs: ActivityLog[];
  onImportLogs: (logs: ActivityLog[]) => void;
}

export function Settings({ timeInferenceMode, onTimeInferenceModeChange, logs, onImportLogs }: SettingsProps) {
  return (
    <div className="container settings-page fade-in">
      <div className="settings-heading">
        <h1>设置</h1>
      </div>

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
        <DataTransfer logs={logs} onImportLogs={onImportLogs} />
      </section>
    </div>
  );
}
