import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ActivityLog } from '../types/baby';
import { Activity, Calendar, Sparkles, TrendingUp } from 'lucide-react';

interface StatsProps {
  logs: ActivityLog[];
}

type RangeMode = 'week' | 'month' | 'year';
type BucketMode = 'day' | 'week' | 'month';

interface DailyStat {
  date: string;
  milk: number;
  sleepHrs: number;
  pee: number;
  poop: number;
  weight: number;
  hasWeightLog: boolean;
}

interface BucketStat {
  key: string;
  label: string;
  milk: number;
  sleepHrs: number;
  pee: number;
  poop: number;
  weight: number;
  hasWeightLog: boolean;
}

const RANGE_OPTIONS: Array<{ mode: RangeMode; label: string; days: number; bucket: BucketMode; hint: string }> = [
  { mode: 'week', label: '周', days: 7, bucket: 'day', hint: '每日' },
  { mode: 'month', label: '月', days: 30, bucket: 'week', hint: '按周日均' },
  { mode: 'year', label: '年', days: 365, bucket: 'month', hint: '按月日均' }
];

const pad = (n: number) => String(n).padStart(2, '0');

const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const shortDate = (dateKey: string) => {
  const d = parseDateKey(dateKey);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatRangeLabel = (start: string, end: string) => (
  start === end ? shortDate(start) : `${shortDate(start)}-${shortDate(end)}`
);

const makePath = (points: Array<{ x: number; y: number }>) => {
  if (points.length === 0) return '';
  return `M ${points[0].x} ${points[0].y} ${points.slice(1).map(point => `L ${point.x} ${point.y}`).join(' ')}`;
};

const chartMetrics = (count: number) => {
  const paddingLeft = 56;
  const paddingRight = 18;
  const paddingTop = 48;
  const paddingBottom = 42;
  const width = 320;
  const plotWidth = width - paddingLeft - paddingRight;
  const slotWidth = plotWidth / Math.max(count, 1);
  const height = 224;
  const plotHeight = height - paddingTop - paddingBottom;

  return { paddingLeft, paddingRight, paddingTop, paddingBottom, slotWidth, plotWidth, width, height, plotHeight };
};

const valueLabelY = (pointY: number, index: number) => Math.max(pointY - 15 - (index % 2) * 11, 20);

const textAnchorForIndex = (index: number, count: number): 'start' | 'middle' | 'end' => {
  if (count <= 1) return 'middle';
  if (index === 0) return 'start';
  if (index === count - 1) return 'end';
  return 'middle';
};

const shouldShowXLabel = (buckets: BucketStat[], index: number) => {
  const count = buckets.length;
  if (count <= 1 || index === 0 || index === count - 1) return true;
  const longestLabel = Math.max(...buckets.map(bucket => bucket.label.length));
  const estimatedLabelWidth = longestLabel * 7 + 12;
  const maxLabels = Math.max(2, Math.min(6, Math.floor(246 / estimatedLabelWidth)));
  if (count <= maxLabels) return true;
  const step = Math.ceil((count - 1) / (maxLabels - 1));
  if (count - 1 - index < step) return false;
  return index % step === 0;
};

const shouldShowValueLabel = (count: number, index: number) => {
  if (count <= 4 || index === 0 || index === count - 1) return true;
  const step = Math.ceil((count - 1) / 3);
  return index % step === 0;
};

function EmptyChart({ text }: { text: string }) {
  return <div className="stats-empty">{text}</div>;
}

function SoftChartCard({
  title,
  subtitle,
  icon,
  children,
  legend
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
  legend?: ReactNode;
}) {
  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div className="stats-card-icon">{icon}</div>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="stats-chart-shell">
        {children}
      </div>
      {legend}
    </section>
  );
}

function BarChart({
  buckets,
  valueKey,
  color,
  unit,
  minMax,
}: {
  buckets: BucketStat[];
  valueKey: 'milk' | 'pee';
  color: string;
  unit: string;
  minMax: number;
}) {
  const dataBuckets = buckets.filter(bucket => Number(bucket[valueKey]) > 0);
  if (dataBuckets.length === 0) {
    return <EmptyChart text="当前范围暂无瓶喂数据" />;
  }

  const metrics = chartMetrics(dataBuckets.length);
  const maxValue = Math.max(...dataBuckets.map(bucket => Number(bucket[valueKey])), minMax);
  const barWidth = Math.min(24, metrics.slotWidth * 0.54);

  return (
    <svg className="stats-chart-svg" width="100%" height={metrics.height} viewBox={`0 0 ${metrics.width} ${metrics.height}`}>
      {[0, 0.5, 1].map(ratio => {
        const y = metrics.paddingTop + ratio * metrics.plotHeight;
        const val = Math.round(maxValue * (1 - ratio));
        return (
          <g key={ratio}>
            <line x1={metrics.paddingLeft} y1={y} x2={metrics.width - metrics.paddingRight} y2={y} className="stats-grid-line" />
            <text x={metrics.paddingLeft - 8} y={y + 5} textAnchor="end" className="stats-axis-label">{val}{unit}</text>
          </g>
        );
      })}
      {dataBuckets.map((bucket, index) => {
        const rawValue = Number(bucket[valueKey]);
        const height = (rawValue / maxValue) * metrics.plotHeight;
        const x = metrics.paddingLeft + index * metrics.slotWidth + metrics.slotWidth / 2 - barWidth / 2;
        const y = metrics.height - metrics.paddingBottom - height;
        return (
          <g key={bucket.key}>
            <rect x={x} y={y} width={barWidth} height={height} rx="7" className="stats-soft-bar" style={{ fill: color }} />
            {shouldShowXLabel(dataBuckets, index) && (
              <text x={x + barWidth / 2} y={metrics.height - 13} textAnchor={textAnchorForIndex(index, dataBuckets.length)} className="stats-x-label">{bucket.label}</text>
            )}
          </g>
        );
      })}
      {dataBuckets.map((bucket, index) => {
        if (!shouldShowValueLabel(dataBuckets.length, index)) return null;
        const rawValue = Number(bucket[valueKey]);
        const height = (rawValue / maxValue) * metrics.plotHeight;
        const x = metrics.paddingLeft + index * metrics.slotWidth + metrics.slotWidth / 2;
        const y = metrics.height - metrics.paddingBottom - height;
        return <text key={`value-${bucket.key}`} x={x} y={valueLabelY(y, index)} textAnchor={textAnchorForIndex(index, dataBuckets.length)} className="stats-value-label">{Math.round(rawValue)}</text>;
      })}
    </svg>
  );
}

function SleepChart({ buckets }: { buckets: BucketStat[] }) {
  const dataBuckets = buckets.filter(bucket => bucket.sleepHrs > 0);
  if (dataBuckets.length === 0) {
    return <EmptyChart text="当前范围暂无睡眠数据" />;
  }

  const metrics = chartMetrics(dataBuckets.length);
  const maxValue = Math.max(...dataBuckets.map(bucket => bucket.sleepHrs), 8);
  const points = dataBuckets.map((bucket, index) => {
    const x = dataBuckets.length === 1
      ? metrics.paddingLeft + metrics.plotWidth / 2
      : metrics.paddingLeft + index * (metrics.plotWidth / (dataBuckets.length - 1));
    const y = metrics.height - metrics.paddingBottom - (bucket.sleepHrs / maxValue) * metrics.plotHeight;
    return { x, y, bucket };
  });
  return (
    <svg className="stats-chart-svg" width="100%" height={metrics.height} viewBox={`0 0 ${metrics.width} ${metrics.height}`}>
      {[0, 0.5, 1].map(ratio => {
        const y = metrics.paddingTop + ratio * metrics.plotHeight;
        const val = (maxValue * (1 - ratio)).toFixed(1);
        return (
          <g key={ratio}>
            <line x1={metrics.paddingLeft} y1={y} x2={metrics.width - metrics.paddingRight} y2={y} className="stats-grid-line" />
            <text x={metrics.paddingLeft - 8} y={y + 5} textAnchor="end" className="stats-axis-label">{val}h</text>
          </g>
        );
      })}
      <path d={makePath(points)} className="stats-line-path" />
      {points.map((point, index) => (
        <g key={point.bucket.key}>
          <circle cx={point.x} cy={point.y} r="5" className="stats-line-dot" />
          {shouldShowXLabel(dataBuckets, index) && (
            <text x={point.x} y={metrics.height - 13} textAnchor={textAnchorForIndex(index, dataBuckets.length)} className="stats-x-label">{point.bucket.label}</text>
          )}
        </g>
      ))}
      {points.map((point, index) => shouldShowValueLabel(dataBuckets.length, index) ? (
        <text key={`value-${point.bucket.key}`} x={point.x} y={valueLabelY(point.y, index)} textAnchor={textAnchorForIndex(index, dataBuckets.length)} className="stats-value-label">{point.bucket.sleepHrs.toFixed(1)}</text>
      ) : null)}
    </svg>
  );
}

function DiaperChart({ buckets }: { buckets: BucketStat[] }) {
  const dataBuckets = buckets.filter(bucket => bucket.pee + bucket.poop > 0);
  if (dataBuckets.length === 0) {
    return <EmptyChart text="当前范围暂无排泄数据" />;
  }

  const metrics = chartMetrics(dataBuckets.length);
  const maxValue = Math.max(...dataBuckets.map(bucket => bucket.pee + bucket.poop), 5);
  const barWidth = Math.min(23, metrics.slotWidth * 0.54);

  return (
    <svg className="stats-chart-svg" width="100%" height={metrics.height} viewBox={`0 0 ${metrics.width} ${metrics.height}`}>
      {[0, 0.5, 1].map(ratio => {
        const y = metrics.paddingTop + ratio * metrics.plotHeight;
        const val = Math.round(maxValue * (1 - ratio));
        return (
          <g key={ratio}>
            <line x1={metrics.paddingLeft} y1={y} x2={metrics.width - metrics.paddingRight} y2={y} className="stats-grid-line" />
            <text x={metrics.paddingLeft - 8} y={y + 5} textAnchor="end" className="stats-axis-label">{val}次</text>
          </g>
        );
      })}
      {dataBuckets.map((bucket, index) => {
        const peeHeight = (bucket.pee / maxValue) * metrics.plotHeight;
        const poopHeight = (bucket.poop / maxValue) * metrics.plotHeight;
        const x = metrics.paddingLeft + index * metrics.slotWidth + metrics.slotWidth / 2 - barWidth / 2;
        const peeY = metrics.height - metrics.paddingBottom - peeHeight;
        const poopY = peeY - poopHeight;
        return (
          <g key={bucket.key}>
            {poopHeight > 0 && <rect x={x} y={poopY} width={barWidth} height={poopHeight} rx="6" className="stats-diaper-poop" />}
            {peeHeight > 0 && <rect x={x} y={peeY} width={barWidth} height={peeHeight} rx="6" className="stats-diaper-pee" />}
            {shouldShowXLabel(dataBuckets, index) && (
              <text x={x + barWidth / 2} y={metrics.height - 13} textAnchor={textAnchorForIndex(index, dataBuckets.length)} className="stats-x-label">{bucket.label}</text>
            )}
          </g>
        );
      })}
      {dataBuckets.map((bucket, index) => {
        if (!shouldShowValueLabel(dataBuckets.length, index)) return null;
        const peeHeight = (bucket.pee / maxValue) * metrics.plotHeight;
        const poopHeight = (bucket.poop / maxValue) * metrics.plotHeight;
        const topY = metrics.height - metrics.paddingBottom - peeHeight - poopHeight;
        const x = metrics.paddingLeft + index * metrics.slotWidth + metrics.slotWidth / 2;
        return <text key={`value-${bucket.key}`} x={x} y={valueLabelY(topY, index)} textAnchor={textAnchorForIndex(index, dataBuckets.length)} className="stats-value-label">{(bucket.pee + bucket.poop).toFixed(1).replace('.0', '')}</text>;
      })}
    </svg>
  );
}

function GrowthChart({ buckets }: { buckets: BucketStat[] }) {
  const growthBuckets = buckets.filter(bucket => bucket.hasWeightLog && bucket.weight > 0);
  if (growthBuckets.length === 0) {
    return <div className="stats-empty">暂无体重数据，可以在记录大盘中补一条体重。</div>;
  }

  const metrics = chartMetrics(growthBuckets.length);
  const weights = growthBuckets.map(bucket => bucket.weight);
  const maxValue = Math.max(...weights, 10);
  const minValue = Math.min(...weights, 3);
  const diff = maxValue - minValue || 1;
  const pointAt = (value: number, index: number) => {
    const x = growthBuckets.length === 1
      ? metrics.paddingLeft + metrics.plotWidth / 2
      : metrics.paddingLeft + index * (metrics.plotWidth / (growthBuckets.length - 1));
    const y = metrics.height - metrics.paddingBottom - ((value - minValue) / diff) * metrics.plotHeight;
    return { x, y };
  };
  const points = growthBuckets.map((bucket, index) => ({ ...pointAt(bucket.weight, index), bucket }));

  return (
    <svg className="stats-chart-svg" width="100%" height={metrics.height} viewBox={`0 0 ${metrics.width} ${metrics.height}`}>
      {[0, 0.5, 1].map(ratio => {
        const y = metrics.paddingTop + ratio * metrics.plotHeight;
        const val = (maxValue - ratio * diff).toFixed(1);
        return (
          <g key={ratio}>
            <line x1={metrics.paddingLeft} y1={y} x2={metrics.width - metrics.paddingRight} y2={y} className="stats-grid-line" />
            <text x={metrics.paddingLeft - 8} y={y + 5} textAnchor="end" className="stats-axis-label">{val}kg</text>
          </g>
        );
      })}
      <path d={makePath(points)} className="stats-growth-path" />
      {points.map((point, index) => (
        <g key={point.bucket.key}>
          <circle cx={point.x} cy={point.y} r="5" className="stats-growth-dot" />
          {shouldShowXLabel(growthBuckets, index) && (
            <text x={point.x} y={metrics.height - 13} textAnchor={textAnchorForIndex(index, growthBuckets.length)} className="stats-x-label">{point.bucket.label}</text>
          )}
        </g>
      ))}
      {points.map((point, index) => shouldShowValueLabel(growthBuckets.length, index) ? (
        <text key={`value-${point.bucket.key}`} x={point.x} y={valueLabelY(point.y, index)} textAnchor={textAnchorForIndex(index, growthBuckets.length)} className="stats-value-label">{point.bucket.weight.toFixed(1)}kg</text>
      ) : null)}
    </svg>
  );
}

export function Stats({ logs }: StatsProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const range = RANGE_OPTIONS.find(option => option.mode === rangeMode) ?? RANGE_OPTIONS[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = addDays(today, -(range.days - 1));

  const dateRange = Array.from({ length: range.days }, (_, i) => toDateKey(addDays(startDate, i)));
  const weightLogDates = new Set(
    logs
      .filter(log => log.logType === 'growth' && log.metadata.weightKg)
      .map(log => log.timestamp.split('T')[0])
  );

  const dailyStats: DailyStat[] = dateRange.map(date => {
    const dayLogs = logs.filter(log => log.timestamp.split('T')[0] === date);
    let totalMilkMl = 0;
    let totalSleepMins = 0;
    let peeCount = 0;
    let poopCount = 0;
    let latestWeight = 0;

    dayLogs.forEach(log => {
      if (log.logType === 'feeding' && log.metadata.feedingType === 'bottle' && log.metadata.bottle) {
        totalMilkMl += log.metadata.bottle.volumeMl;
      } else if (log.logType === 'sleep') {
        if (log.metadata.durationMinutes) {
          totalSleepMins += log.metadata.durationMinutes;
        } else if (log.metadata.startTime && log.metadata.endTime) {
          const diff = new Date(log.metadata.endTime).getTime() - new Date(log.metadata.startTime).getTime();
          totalSleepMins += Math.max(0, Math.round(diff / 60000));
        }
      } else if (log.logType === 'diaper') {
        if (log.metadata.pee) peeCount++;
        if (log.metadata.poop) poopCount++;
      } else if (log.logType === 'growth' && log.metadata.weightKg) {
        latestWeight = log.metadata.weightKg;
      }
    });

    if (!latestWeight) {
      const pastWeightLog = logs
        .filter(log => log.logType === 'growth' && log.metadata.weightKg && log.timestamp <= `${date}T23:59:59`)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      latestWeight = pastWeightLog?.metadata.weightKg || 0;
    }

    return {
      date,
      milk: totalMilkMl,
      sleepHrs: Number((totalSleepMins / 60).toFixed(1)),
      pee: peeCount,
      poop: poopCount,
      weight: latestWeight,
      hasWeightLog: weightLogDates.has(date)
    };
  });

  const makeBucket = (items: DailyStat[], key: string, label: string): BucketStat => {
    const weightItem = [...items].reverse().find(item => item.hasWeightLog && item.weight > 0);
    const avgRecorded = (values: number[]) => {
      const recorded = values.filter(value => value > 0);
      return recorded.reduce((sum, value) => sum + value, 0) / Math.max(recorded.length, 1);
    };

    return {
      key,
      label,
      milk: avgRecorded(items.map(item => item.milk)),
      sleepHrs: avgRecorded(items.map(item => item.sleepHrs)),
      pee: avgRecorded(items.map(item => item.pee)),
      poop: avgRecorded(items.map(item => item.poop)),
      weight: weightItem?.weight || 0,
      hasWeightLog: Boolean(weightItem),
    };
  };

  const buckets: BucketStat[] = (() => {
    if (range.bucket === 'day') {
      return dailyStats.map(item => makeBucket([item], item.date, shortDate(item.date)));
    }

    if (range.bucket === 'week') {
      const chunks: BucketStat[] = [];
      for (let i = 0; i < dailyStats.length; i += 7) {
        const items = dailyStats.slice(i, i + 7);
        chunks.push(makeBucket(items, `week-${i}`, formatRangeLabel(items[0].date, items[items.length - 1].date)));
      }
      return chunks;
    }

    const firstMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthStart = addMonths(firstMonth, monthIndex);
      const nextMonth = addMonths(monthStart, 1);
      const items = dailyStats
        .map(item => ({ item, date: parseDateKey(item.date) }))
        .filter(entry => entry.date >= monthStart && entry.date < nextMonth);
      const fillItems = items.map(entry => entry.item);
      return makeBucket(fillItems, toDateKey(monthStart), `${monthStart.getMonth() + 1}月`);
    }).filter(bucket => bucket.key >= toDateKey(startDate) || rangeMode === 'year');
  })();

  const todayKey = toDateKey(today);
  const todayStats = dailyStats.find(stat => stat.date === todayKey) ?? { milk: 0, sleepHrs: 0, pee: 0, poop: 0 };
  const activeSummary = [
    { label: '今日瓶喂', value: todayStats.milk, unit: 'ml' },
    { label: '今日睡眠', value: todayStats.sleepHrs, unit: '小时' },
    { label: '今日嘘嘘', value: todayStats.pee, unit: '次' },
    { label: '今日便便', value: todayStats.poop, unit: '次' }
  ];

  return (
    <div className="container fade-in stats-page">
      <div className="stats-summary-grid">
        {activeSummary.map(item => (
          <div className="stats-summary-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}<small>{item.unit}</small></strong>
          </div>
        ))}
      </div>

      <section className="stats-control-panel">
        <div>
          <span className="stats-control-label">图表范围</span>
          <div className="stats-segmented">
            {RANGE_OPTIONS.map(option => (
              <button
                key={option.mode}
                type="button"
                className={rangeMode === option.mode ? 'active' : ''}
                onClick={() => setRangeMode(option.mode)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="stats-grain-note">
          {range.label}视图自动{range.hint}汇总，仅显示有记录的时间点
        </p>
      </section>

      <SoftChartCard
        title="体重增长"
        subtitle="仅显示实际体重记录"
        icon={<TrendingUp size={18} />}
      >
        <GrowthChart buckets={buckets} />
      </SoftChartCard>

      <SoftChartCard
        title="瓶喂奶量"
        subtitle={`${range.hint}，单位 ml/天`}
        icon={<Calendar size={18} />}
      >
        <BarChart
          buckets={buckets}
          valueKey="milk"
          color="var(--amber)"
          unit="ml"
          minMax={300}
        />
      </SoftChartCard>

      <SoftChartCard
        title="睡眠时长"
        subtitle={`${range.hint}，单位 小时/天`}
        icon={<Activity size={18} />}
      >
        <SleepChart buckets={buckets} />
      </SoftChartCard>

      <SoftChartCard
        title="排泄统计"
        subtitle={`${range.hint}，单位 次/天`}
        icon={<Sparkles size={18} />}
        legend={(
          <div className="stats-legend">
            <span><i className="legend-pee" />嘘嘘</span>
            <span><i className="legend-poop" />便便</span>
          </div>
        )}
      >
        <DiaperChart buckets={buckets} />
      </SoftChartCard>
    </div>
  );
}
