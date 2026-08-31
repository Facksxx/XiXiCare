import { useState, useEffect } from 'react';
import type { ActivityLog, LogType, FeedingType } from '../types/baby';
import { 
  Milk, Moon, Droplets, Scale, Check, Edit2, AlertTriangle, Pause, Play, X
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { Incrementor } from './Incrementor';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DateTimePicker } from './DateTimePicker';

interface DashboardProps {
  babyId: string;
  onAddLog: (log: ActivityLog) => void;
  onUpdateLog: (log: ActivityLog) => void;
  editingLog?: ActivityLog | null;
  onEditingDone?: () => void;
}

const getNowLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toISO = (localStr: string) => {
  // 保留本地时间，不转UTC，避免凌晨记录跑到前一天
  return localStr.length === 16 ? `${localStr}:00` : localStr;
};

interface SleepTimerState {
  startedAt: string;
  elapsedMs: number;
  runningSince: number | null;
}

const getLogTypeLabel = (logType: LogType) => {
  const labels: Record<LogType, string> = {
    feeding: '喂养',
    sleep: '睡眠',
    diaper: '尿布',
    growth: '体征'
  };
  return labels[logType] || logType;
};

export function Dashboard({ babyId, onAddLog, onUpdateLog, editingLog: externalEditingLog, onEditingDone }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<LogType>('feeding');
  const [feedingType, setFeedingType] = useLocalStorage<FeedingType>(`babycare_last_feeding_type_${babyId}`, 'breast');

  const [startTime, setStartTime] = useState(getNowLocal);
  const [sleepDurationMinutes, setSleepDurationMinutes] = useLocalStorage<number>(`babycare_last_sleep_duration_${babyId}`, 30);
  const [sleepTimer, setSleepTimer] = useLocalStorage<SleepTimerState | null>(`babycare_sleep_timer_${babyId}`, null);
  const [timerNow, setTimerNow] = useState(Date.now());

  // Feeding State
  const [breastLeft, setBreastLeft] = useState(10);
  const [breastRight, setBreastRight] = useState(10);
  const [bottleVolume, setBottleVolume] = useLocalStorage<number>(`babycare_last_bottle_volume_${babyId}`, 120);
  const [bottleType, setBottleType] = useLocalStorage<'formula' | 'breastmilk'>(`babycare_last_bottle_type_${babyId}`, 'formula');
  const [solidsName, setSolidsName] = useState('');
  const [solidsAmount, setSolidsAmount] = useState('50g');
  const [solidsReaction, setSolidsReaction] = useState<'none' | 'mild' | 'severe'>('none');

  // Diaper State
  const [diaperPee, setDiaperPee] = useState(true);
  const [diaperPoop, setDiaperPoop] = useState(false);
  const [poopColor, setPoopColor] = useState<'yellow' | 'green' | 'brown' | 'other'>('yellow');
  const [poopConsistency, setPoopConsistency] = useState<'watery' | 'normal' | 'hard'>('normal');

  // Growth State - 选择式
  const [growthType, setGrowthType] = useState<'weight' | 'height' | 'temp'>('weight');
  const [growthWeight, setGrowthWeight] = useState(() => localStorage.getItem(`babycare_growth_weight_${babyId}`) || '');
  const [growthHeight, setGrowthHeight] = useState(() => localStorage.getItem(`babycare_growth_height_${babyId}`) || '');
  const [growthTemp, setGrowthTemp] = useState(() => localStorage.getItem(`babycare_growth_temp_${babyId}`) || '');

  // 编辑状态
  const [editingLog, setEditingLog] = useState<ActivityLog | null>(null);

  // 自定义弹窗状态
  const [alertModal, setAlertModal] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 2500);
  };

  // 重置表单
  const resetForm = () => {
    setStartTime(getNowLocal());
    setSolidsName('');
    setBreastLeft(10);
    setBreastRight(10);
    setDiaperPee(true);
    setDiaperPoop(false);
    setGrowthType('weight');
    setEditingLog(null);
    if (onEditingDone) onEditingDone();
  };

  // 外部编辑日志（来自Records的编辑按钮）
  useEffect(() => {
    if (externalEditingLog) {
      const log = externalEditingLog;
      setActiveTab(log.logType);
      setStartTime(log.timestamp.replace('Z', '').substring(0, 16));

      if (log.logType === 'sleep') setSleepDurationMinutes(Math.max(5, Number(log.metadata.durationMinutes) || 30));

      const meta = log.metadata;
      if (log.logType === 'feeding') {
        setFeedingType(meta.feedingType || 'breast');
        if (meta.feedingType === 'breast' && meta.breast) {
          setBreastLeft(meta.breast.leftMinutes || 10);
          setBreastRight(meta.breast.rightMinutes || 10);
        } else if (meta.feedingType === 'bottle' && meta.bottle) {
          setBottleVolume(meta.bottle.volumeMl || 120);
          setBottleType(meta.bottle.fluidType || 'formula');
        } else if (meta.feedingType === 'solids' && meta.solids) {
          setSolidsName(meta.solids.foodName || '');
          setSolidsAmount(meta.solids.amount || '50g');
          setSolidsReaction(meta.solids.reaction || 'none');
        }
      } else if (log.logType === 'diaper') {
        setDiaperPee(!!meta.pee);
        setDiaperPoop(!!meta.poop);
        if (meta.poopColor) setPoopColor(meta.poopColor);
        if (meta.poopConsistency) setPoopConsistency(meta.poopConsistency);
      } else if (log.logType === 'growth') {
        if (meta.weightKg !== undefined) { setGrowthType('weight'); setGrowthWeight(String(meta.weightKg)); }
        else if (meta.heightCm !== undefined) { setGrowthType('height'); setGrowthHeight(String(meta.heightCm)); }
        else if (meta.temperatureC !== undefined) { setGrowthType('temp'); setGrowthTemp(String(meta.temperatureC)); }
      }
      setEditingLog(log);
    }
  }, [externalEditingLog]);

  // 当切换tab时重置选择状态
  useEffect(() => {
    if (editingLog) {
      resetForm();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!sleepTimer?.runningSince) return;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [sleepTimer?.runningSince]);

  const timerElapsedMs = sleepTimer
    ? sleepTimer.elapsedMs + (sleepTimer.runningSince ? Math.max(0, timerNow - sleepTimer.runningSince) : 0)
    : 0;
  const timerElapsedMinutes = Math.floor(timerElapsedMs / 60000);
  const timerClock = `${String(Math.floor(timerElapsedMs / 3600000)).padStart(2, '0')}:${String(Math.floor(timerElapsedMs / 60000) % 60).padStart(2, '0')}:${String(Math.floor(timerElapsedMs / 1000) % 60).padStart(2, '0')}`;

  const startSleepTimer = () => {
    const now = Date.now();
    const startedAt = getNowLocal();
    setStartTime(startedAt);
    setTimerNow(now);
    setSleepTimer({ startedAt, elapsedMs: 0, runningSince: now });
  };

  const toggleSleepTimer = () => {
    if (!sleepTimer) return startSleepTimer();
    const now = Date.now();
    setTimerNow(now);
    setSleepTimer(sleepTimer.runningSince
      ? { ...sleepTimer, elapsedMs: sleepTimer.elapsedMs + Math.max(0, now - sleepTimer.runningSince), runningSince: null }
      : { ...sleepTimer, runningSince: now });
  };

  const cancelSleepTimer = () => setSleepTimer(null);

  const handleSaveLog = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!startTime) {
      setAlertModal({ show: true, message: '请选择时间' });
      return;
    }

    let recordStartTime = startTime;
    let metadata: any = {
      pee: false,
      poop: false
    };

    if (activeTab === 'feeding') {
      metadata.feedingType = feedingType;
      metadata.startTime = toISO(startTime);
      if (feedingType === 'breast') {
        metadata.breast = { leftMinutes: breastLeft, rightMinutes: breastRight };
      } else if (feedingType === 'bottle') {
        metadata.bottle = { volumeMl: bottleVolume, fluidType: bottleType };
      } else if (feedingType === 'solids') {
        const foodName = solidsName.trim();
        if (!foodName) {
          setAlertModal({ show: true, message: '请填写辅食名称' });
          return;
        }
        metadata.solids = { foodName, amount: solidsAmount.trim(), reaction: solidsReaction };
      }
    } else if (activeTab === 'sleep') {
      const duration = sleepTimer ? timerElapsedMinutes : sleepDurationMinutes;
      const sleepStart = sleepTimer?.startedAt ?? startTime;
      recordStartTime = sleepStart;
      metadata.startTime = toISO(sleepStart);
      metadata.durationMinutes = duration;
      if (duration < 5) {
        setAlertModal({ show: true, message: '睡眠少于5分钟，不会保存记录' });
        return;
      }
      if (sleepTimer) setSleepTimer(null);
    } else if (activeTab === 'diaper') {
      metadata.pee = diaperPee;
      metadata.poop = diaperPoop;
      if (diaperPoop) {
        metadata.poopColor = poopColor;
        metadata.poopConsistency = poopConsistency;
      }
    } else if (activeTab === 'growth') {
      metadata.feedingType = 'breast';
      
      if (growthType === 'weight' && growthWeight) {
        metadata.weightKg = parseFloat(growthWeight);
        localStorage.setItem(`babycare_growth_weight_${babyId}`, growthWeight);
      } else if (growthType === 'height' && growthHeight) {
        metadata.heightCm = parseFloat(growthHeight);
        localStorage.setItem(`babycare_growth_height_${babyId}`, growthHeight);
      } else if (growthType === 'temp' && growthTemp) {
        metadata.temperatureC = parseFloat(growthTemp);
        localStorage.setItem(`babycare_growth_temp_${babyId}`, growthTemp);
      }
    }

    if (editingLog) {
      const updatedLog: ActivityLog = {
        ...editingLog,
        timestamp: toISO(recordStartTime),
        metadata
      };
      onUpdateLog(updatedLog);
      showToast('记录已更新', 'success');
    } else {
      const newLog: ActivityLog = {
        id: `${activeTab}-${Date.now()}`,
        babyId,
        timestamp: toISO(recordStartTime),
        logType: activeTab,
        metadata
      };
      onAddLog(newLog);
      showToast('记录已保存', 'success');
    }

    resetForm();
  };

  return (
    <div className="container fade-in">
      <div className="card dashboard-card">
        {editingLog && (
          <div className="editing-banner">
            <div className="editing-banner-icon">
              <Edit2 size={16} />
            </div>
            <div className="editing-banner-text">
              <strong>编辑模式</strong>
              <span>正在修改 {getLogTypeLabel(editingLog.logType)} 记录</span>
            </div>
            <button 
              type="button"
              className="editing-cancel-btn"
              onClick={resetForm}
            >
              取消
            </button>
          </div>
        )}

        <div className="record-tab-grid">
          <button type="button" className={`pill-option icon-pill ${activeTab === 'feeding' ? 'active-amber' : ''}`} onClick={() => setActiveTab('feeding')}>
            <Milk size={16} /> 喂养
          </button>
          <button type="button" className={`pill-option icon-pill ${activeTab === 'sleep' ? 'active-lavender' : ''}`} onClick={() => setActiveTab('sleep')}>
            <Moon size={16} /> 睡眠
          </button>
          <button type="button" className={`pill-option icon-pill ${activeTab === 'diaper' ? 'active' : ''}`} onClick={() => setActiveTab('diaper')}>
            <Droplets size={16} /> 尿布
          </button>
          <button type="button" className={`pill-option icon-pill ${activeTab === 'growth' ? 'active-amber' : ''}`} onClick={() => setActiveTab('growth')}>
            <Scale size={16} /> 体征
          </button>
        </div>

        <div className="time-range-section">
          {activeTab === 'feeding' || activeTab === 'sleep' ? (
            <div className="time-row-single">
              <DateTimePicker value={sleepTimer && activeTab === 'sleep' ? sleepTimer.startedAt : startTime} onChange={setStartTime} label="开始时间" />
            </div>
          ) : (
            <div className="time-row-single">
              <DateTimePicker
                value={startTime}
                onChange={(value) => {
                  setStartTime(value);
                }}
                label="记录时间"
              />
              <button
                type="button"
                className="quick-time-btn"
                onClick={() => {
                  const now = getNowLocal();
                  setStartTime(now);
                }}
                title="设为当前时间"
              >
                设为当前
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveLog}>
          {activeTab === 'feeding' && (
            <div className="fade-in form-stack">
              <div className="pill-selection wrap-selection">
                <button type="button" className={`pill-option ${feedingType === 'breast' ? 'active-amber' : ''}`} onClick={() => setFeedingType('breast')}>母乳亲喂</button>
                <button type="button" className={`pill-option ${feedingType === 'bottle' ? 'active-amber' : ''}`} onClick={() => setFeedingType('bottle')}>奶瓶喂养</button>
                <button type="button" className={`pill-option ${feedingType === 'solids' ? 'active-amber' : ''}`} onClick={() => setFeedingType('solids')}>添加辅食</button>
              </div>

              {feedingType === 'breast' && (
                <div className="duration-pair-grid">
                  <Incrementor
                    value={breastLeft}
                    onChange={setBreastLeft}
                    step={1}
                    min={0}
                    unit=""
                    label="左侧 (分钟)"
                    quickOptions={[3, 5, 8, 10, 15, 20]}
                  />
                  <Incrementor
                    value={breastRight}
                    onChange={setBreastRight}
                    step={1}
                    min={0}
                    unit=""
                    label="右侧 (分钟)"
                    quickOptions={[3, 5, 8, 10, 15, 20]}
                  />
                </div>
              )}

              {feedingType === 'bottle' && (
                <div className="form-stack">
                  <div className="pill-selection wrap-selection">
                    <button type="button" className={`pill-option ${bottleType === 'formula' ? 'active-amber' : ''}`} onClick={() => setBottleType('formula')}>配方奶</button>
                    <button type="button" className={`pill-option ${bottleType === 'breastmilk' ? 'active-amber' : ''}`} onClick={() => setBottleType('breastmilk')}>母乳</button>
                  </div>
                  <Incrementor
                    value={bottleVolume}
                    onChange={setBottleVolume}
                    step={10}
                    min={0}
                    max={1000}
                    unit=" ml"
                    label="喂奶量"
                    quickOptions={[60, 90, 120, 150, 180, 210, 240]}
                  />
                </div>
              )}

              {feedingType === 'solids' && (
                <div className="form-stack">
                  <div>
                    <label className="form-label">食物名称</label>
                    <input type="text" className="input-field" placeholder="如：胡萝卜泥" value={solidsName} onChange={(e) => setSolidsName(e.target.value)} />
                  </div>
                  <div className="two-field-grid">
                    <div>
                      <label className="form-label">摄入量</label>
                      <input type="text" className="input-field" placeholder="如：50g" value={solidsAmount} onChange={(e) => setSolidsAmount(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">过敏反应</label>
                      <select className="input-field" value={solidsReaction} onChange={(e) => setSolidsReaction(e.target.value as any)} style={{ height: '45px' }}>
                        <option value="none">无过敏</option>
                        <option value="mild">轻度</option>
                        <option value="severe">严重</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sleep' && (
            <div className="fade-in form-stack">
              {!editingLog && (
                <div className={`sleep-timer-panel${sleepTimer ? ' active' : ''}`}>
                  <div className="sleep-timer-copy"><span>睡眠计时</span><strong>{sleepTimer ? timerClock : '00:00:00'}</strong></div>
                  <div className="sleep-timer-actions">
                    <button
                      type="button"
                      className="sleep-timer-primary"
                      onClick={toggleSleepTimer}
                      aria-label={sleepTimer?.runningSince ? '暂停计时' : sleepTimer ? '继续计时' : '开始计时'}
                      title={sleepTimer?.runningSince ? '暂停计时' : sleepTimer ? '继续计时' : '开始计时'}
                    >
                      {sleepTimer?.runningSince ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    {sleepTimer && <button type="button" className="sleep-timer-cancel" onClick={cancelSleepTimer} aria-label="取消计时" title="取消计时"><X size={18} /></button>}
                  </div>
                </div>
              )}
              {!sleepTimer && (
                <div className="sleep-duration-picker">
                  <span>睡眠时长</span>
                  <div className="quick-duration-row">
                    {[5, 30, 60, 120, 180].map((mins) => <button key={mins} type="button" className={`quick-duration-btn${sleepDurationMinutes === mins ? ' active' : ''}`} onClick={() => setSleepDurationMinutes(mins)}>{mins < 60 ? `${mins}分钟` : `${mins / 60}小时`}</button>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'diaper' && (
            <div className="fade-in form-stack">
              <div className="diaper-grid">
                <button type="button" className={`pill-option icon-pill ${diaperPee ? 'active' : ''}`} onClick={() => setDiaperPee(!diaperPee)}>
                  <Droplets size={18} /> 嘘嘘
                </button>
                <button type="button" className={`pill-option icon-pill ${diaperPoop ? 'active' : ''}`} onClick={() => setDiaperPoop(!diaperPoop)}>
                  <Scale size={18} /> 便便
                </button>
              </div>

              {diaperPoop && (
                <div className="fade-in inset-panel">
                  <label className="form-label">便便颜色</label>
                  <div className="color-swatch-picker">
                    <div className={`color-swatch yellow ${poopColor === 'yellow' ? 'active' : ''}`} onClick={() => setPoopColor('yellow')} title="黄色" />
                    <div className={`color-swatch green ${poopColor === 'green' ? 'active' : ''}`} onClick={() => setPoopColor('green')} title="绿色" />
                    <div className={`color-swatch brown ${poopColor === 'brown' ? 'active' : ''}`} onClick={() => setPoopColor('brown')} title="褐色" />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'growth' && (
            <div className="fade-in form-stack">
              <div className="pill-selection wrap-selection">
                <button type="button" className={`pill-option ${growthType === 'weight' ? 'active-amber' : ''}`} onClick={() => setGrowthType('weight')}>体重</button>
                <button type="button" className={`pill-option ${growthType === 'height' ? 'active-amber' : ''}`} onClick={() => setGrowthType('height')}>身高</button>
                <button type="button" className={`pill-option ${growthType === 'temp' ? 'active-amber' : ''}`} onClick={() => setGrowthType('temp')}>体温</button>
              </div>

              {growthType === 'weight' && (
                <div>
                  <label className="form-label">体重 (kg)</label>
                  <input type="number" step="0.01" className="input-field" placeholder="如 6.2" value={growthWeight} onChange={(e) => setGrowthWeight(e.target.value)} />
                </div>
              )}

              {growthType === 'height' && (
                <div>
                  <label className="form-label">身高 (cm)</label>
                  <input type="number" step="0.1" className="input-field" placeholder="如 61.5" value={growthHeight} onChange={(e) => setGrowthHeight(e.target.value)} />
                </div>
              )}

              {growthType === 'temp' && (
                <div>
                  <label className="form-label">体温 (°C)</label>
                  <input type="number" step="0.1" className="input-field" placeholder="如 36.6" value={growthTemp} onChange={(e) => setGrowthTemp(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div className="save-section">
            <button type="submit" className="btn-primary">
              <Check size={18} /> {editingLog ? '更新记录' : '保存记录'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={alertModal.show}
        message={alertModal.message}
        type="info"
        confirmText="确定"
        cancelText=""
        onConfirm={() => setAlertModal({ show: false, message: '' })}
        onCancel={() => setAlertModal({ show: false, message: '' })}
      />

      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
