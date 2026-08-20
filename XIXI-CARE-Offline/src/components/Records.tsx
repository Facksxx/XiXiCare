import { useMemo, useState } from 'react';
import type { ActivityLog, FeedingType, LogType } from '../types/baby';
import { Calendar, Droplets, Edit2, Milk, Moon, Scale, Trash2 } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';
import { DateTimePicker } from './DateTimePicker';
import { getEffectiveFeedingIntervals } from '../utils/feedingIntervals';

interface RecordsProps {
  logs: ActivityLog[];
  onEditLog: (log: ActivityLog) => void;
  onDeleteLog: (id: string) => void;
}

type TypeFilter = 'all' | LogType;
type FeedingFilter = 'all' | FeedingType;
type BottleFilter = 'all' | 'formula' | 'breastmilk';

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'feeding', label: '喂养' },
  { value: 'sleep', label: '睡眠' },
  { value: 'diaper', label: '尿布' },
  { value: 'growth', label: '体征' }
];

const FEEDING_FILTERS: Array<{ value: FeedingFilter; label: string }> = [
  { value: 'all', label: '全部喂养' },
  { value: 'breast', label: '母乳亲喂' },
  { value: 'bottle', label: '奶瓶喂养' },
  { value: 'solids', label: '辅食' }
];

const BOTTLE_FILTERS: Array<{ value: BottleFilter; label: string }> = [
  { value: 'all', label: '全部奶瓶' },
  { value: 'formula', label: '配方奶' },
  { value: 'breastmilk', label: '母乳' }
];

const feedingTypeLabel = (type?: FeedingType) => (
  type === 'bottle' ? '奶瓶' : type === 'solids' ? '辅食' : '母乳'
);

const formatInterval = (minutes: number) => {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分钟` : `${hours}小时`;
};

export function Records({ logs, onEditLog, onDeleteLog }: RecordsProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [feedingFilter, setFeedingFilter] = useState<FeedingFilter>('all');
  const [bottleFilter, setBottleFilter] = useState<BottleFilter>('all');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [logs]);
  const filteredLogs = useMemo(() => sortedLogs.filter(log => {
    const logDate = log.timestamp.split('T')[0];
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    if (typeFilter !== 'all' && log.logType !== typeFilter) return false;
    if (typeFilter === 'feeding' && feedingFilter !== 'all' && log.metadata.feedingType !== feedingFilter) return false;
    if (typeFilter === 'feeding' && feedingFilter === 'bottle' && bottleFilter !== 'all' && log.metadata.bottle?.fluidType !== bottleFilter) return false;
    return true;
  }), [sortedLogs, startDate, endDate, typeFilter, feedingFilter, bottleFilter]);

  const feedingIntervals = useMemo(() => {
    return new Map(getEffectiveFeedingIntervals(logs).map(item => [item.log.id, item.minutes]));
  }, [logs]);

  const groupedLogs = useMemo(() => {
    const groups: Record<string, ActivityLog[]> = {};
    filteredLogs.forEach(log => {
      const date = log.timestamp.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return groups;
  }, [filteredLogs]);
  const sortedDateKeys = useMemo(() => Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a)), [groupedLogs]);

  const getFormatDateTitle = (date: string) => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = `${yesterdayDate.getFullYear()}-${pad(yesterdayDate.getMonth() + 1)}-${pad(yesterdayDate.getDate())}`;
    if (date === today) return '今天';
    if (date === yesterday) return '昨天';
    return date;
  };

  const getFormatTime = (isoString: string) => {
    const date = new Date(isoString);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getLogDisplayDetails = (log: ActivityLog) => {
    const meta = log.metadata;
    if (log.logType === 'feeding') {
      if (meta.feedingType === 'breast' && meta.breast) return `母乳吸吮：左侧 ${meta.breast.leftMinutes} 分钟 / 右侧 ${meta.breast.rightMinutes} 分钟`;
      if (meta.feedingType === 'bottle' && meta.bottle) return `瓶喂奶量：${meta.bottle.volumeMl} ml (${meta.bottle.fluidType === 'formula' ? '配方奶' : '吸出母乳'})`;
      if (meta.feedingType === 'solids' && meta.solids) {
        const reaction = meta.solids.reaction === 'severe' ? '严重过敏' : meta.solids.reaction === 'mild' ? '轻度过敏' : '无过敏';
        return `辅食：${meta.solids.foodName} (${meta.solids.amount})，过敏反应：${reaction}`;
      }
    }
    if (log.logType === 'sleep') return `睡眠时间：${meta.durationMinutes || 0} 分钟`;
    if (log.logType === 'diaper') {
      if (meta.pee && meta.poop) {
        const color = meta.poopColor === 'yellow' ? '黄色' : meta.poopColor === 'green' ? '绿色' : meta.poopColor === 'brown' ? '褐色' : '其他';
        return `换尿布：嘘嘘 & 便便 (${color})`;
      }
      if (meta.pee) return '换尿布：只嘘嘘';
      if (meta.poop) return '换尿布：只便便';
      return '尿布检查：干爽';
    }
    if (meta.weightKg) return `体重：${meta.weightKg} kg`;
    if (meta.heightCm) return `身高：${meta.heightCm} cm`;
    if (meta.headCircumferenceCm) return `头围：${meta.headCircumferenceCm} cm`;
    if (meta.temperatureC) return `体温：${meta.temperatureC} °C`;
    return '';
  };

  const handleDeleteClick = (id: string) => {
    setDeleteTargetId(id);
  };

  const hasFilter = Boolean(startDate || endDate || typeFilter !== 'all' || feedingFilter !== 'all' || bottleFilter !== 'all');
  const clearFilter = () => {
    setStartDate('');
    setEndDate('');
    setTypeFilter('all');
    setFeedingFilter('all');
    setBottleFilter('all');
  };

  return (
    <div className="container fade-in">
      <div className="card records-tools-card">
        <div className="records-filter-row">
          <div className="records-date-range">
            <Calendar size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <DateTimePicker mode="date" label="开始日期" placeholder="开始日期" value={startDate} onChange={setStartDate} />
            <span>~</span>
            <DateTimePicker mode="date" label="结束日期" placeholder="结束日期" value={endDate} onChange={setEndDate} />
            {hasFilter && <button type="button" className="records-clear-filter" onClick={clearFilter}>清除</button>}
          </div>
        </div>
        <div className="records-type-filter" role="radiogroup" aria-label="记录类型">
          {TYPE_FILTERS.map(option => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={typeFilter === option.value}
              className={typeFilter === option.value ? 'active' : ''}
              onClick={() => {
                setTypeFilter(option.value);
                if (option.value !== 'feeding') {
                  setFeedingFilter('all');
                  setBottleFilter('all');
                }
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        {typeFilter === 'feeding' && (
          <div className="records-feeding-filter" role="radiogroup" aria-label="喂养类型">
            {FEEDING_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={feedingFilter === option.value}
                className={feedingFilter === option.value ? 'active' : ''}
                onClick={() => {
                  setFeedingFilter(option.value);
                  if (option.value !== 'bottle') setBottleFilter('all');
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {typeFilter === 'feeding' && feedingFilter === 'bottle' && (
          <div className="records-feeding-filter" role="radiogroup" aria-label="奶瓶类型">
            {BOTTLE_FILTERS.map(option => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={bottleFilter === option.value}
                className={bottleFilter === option.value ? 'active' : ''}
                onClick={() => setBottleFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        <div className="records-count"><Calendar size={14} /><span>共 <strong>{filteredLogs.length}</strong> 条记录{hasFilter && '（已筛选）'}</span></div>
      </div>

      {sortedDateKeys.length === 0 ? (
        <div className="card records-empty">
          <Calendar size={40} />
          <p>{hasFilter ? '所选条件下暂无记录' : '暂无记录，快去记录大盘添加吧'}</p>
        </div>
      ) : sortedDateKeys.map(date => (
        <div key={date}>
          <h4 className="timeline-title">{getFormatDateTitle(date)}</h4>
          <div className="timeline">
            {groupedLogs[date].map(log => (
              <div key={log.id} className="timeline-item fade-in">
                <div className="timeline-content-left" onClick={() => onEditLog(log)}>
                  <div className={`timeline-icon-box ${log.logType}`}>
                    {log.logType === 'feeding' && <Milk size={18} />}
                    {log.logType === 'sleep' && <Moon size={18} />}
                    {log.logType === 'diaper' && <Droplets size={18} />}
                    {log.logType === 'growth' && <Scale size={18} />}
                  </div>
                  <div className="timeline-details">
                    <h4>{getLogDisplayDetails(log)}</h4>
                    {log.logType === 'feeding' && (
                      <p className="timeline-feeding-meta">
                        <span>{feedingTypeLabel(log.metadata.feedingType)}</span>
                        {feedingIntervals.has(log.id) && <span>距上次喂养 {formatInterval(feedingIntervals.get(log.id) ?? 0)}</span>}
                      </p>
                    )}
                    <p className="timeline-time-line"><span>{log.timestamp.split('T')[0]}</span><span>{getFormatTime(log.timestamp)}</span></p>
                  </div>
                </div>
                <div className="timeline-actions">
                  <button onClick={() => onEditLog(log)} className="timeline-edit-btn" title="编辑"><Edit2 size={14} /></button>
                  <button onClick={() => handleDeleteClick(log.id)} className="timeline-delete-btn" title="删除"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        message="确认删除这条记录？"
        type="danger"
        confirmText="确认"
        cancelText="取消"
        onConfirm={() => {
          if (deleteTargetId) onDeleteLog(deleteTargetId);
          setDeleteTargetId(null);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
