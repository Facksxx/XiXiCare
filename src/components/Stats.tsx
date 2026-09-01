import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsOption } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import { BarChart as EChartsBar, LineChart as EChartsLine } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ActivityLog } from '../types/baby';
import { Clock3, Heart, Milk, Moon, Scale } from 'lucide-react';
import { getEffectiveFeedingIntervals } from '../utils/feedingIntervals';

echarts.use([EChartsBar, EChartsLine, GridComponent, TooltipComponent, CanvasRenderer]);

interface StatsProps {
  logs: ActivityLog[];
  birthday: string;
}

type RangeMode = 'week' | 'month' | 'year';
type BucketMode = 'day' | 'week' | 'month';

interface DailyStat {
  date: string;
  milk: number;
  sleepHrs: number;
  feedingIntervalHrs: number;
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
  feedingIntervalHrs: number;
  pee: number;
  poop: number;
  weight: number;
  hasWeightLog: boolean;
}

const RANGE_OPTIONS: Array<{ mode: RangeMode; label: string; days: number; bucket: BucketMode; hint: string }> = [
  { mode: 'week', label: '7天', days: 7, bucket: 'day', hint: '每日' },
  { mode: 'month', label: '30天', days: 30, bucket: 'week', hint: '按周日均' },
  { mode: 'year', label: '1年', days: 365, bucket: 'month', hint: '按月日均' }
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

const cssColor = (name: string, fallback: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

function EChart({ option }: { option: EChartsOption }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' });
    chart.setOption(option, { notMerge: true });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [option]);

  return <div ref={containerRef} className="stats-echart" />;
}

const axisBase = (labels: string[]) => ({
  animationDuration: 0,
  animationDurationUpdate: 0,
  grid: { left: 14, right: 14, top: 52, bottom: 8, containLabel: true },
  tooltip: {
    trigger: 'axis' as const,
    confine: true,
    backgroundColor: cssColor('--bg-card', '#fff'),
    borderColor: cssColor('--border', '#e9e5df'),
    textStyle: { color: cssColor('--text-heading', '#292623'), fontSize: 12 }
  },
  xAxis: {
    type: 'category' as const,
    data: labels,
    boundaryGap: true,
    axisLine: { lineStyle: { color: cssColor('--border', '#e9e5df') } },
    axisTick: { show: false },
    axisLabel: { color: cssColor('--text-muted', '#8b857f'), fontSize: 11, interval: 'auto' as const, hideOverlap: true, margin: 12 }
  },
  yAxis: {
    type: 'value' as const,
    scale: true,
    splitNumber: 3,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: cssColor('--text-muted', '#8b857f'), fontSize: 10, margin: 8 },
    splitLine: { lineStyle: { color: cssColor('--border', '#e9e5df'), type: 'dashed' as const } }
  }
});

const valueLabel = (formatter: (value: number) => string) => ({
  show: true,
  position: 'top' as const,
  distance: 7,
  color: cssColor('--text-heading', '#292623'),
  fontSize: 11,
  fontWeight: 700,
  formatter: (params: CallbackDataParams) => formatter(Number(params.value))
});

const stableBarStates = (color: string, borderRadius: number[]) => ({
  itemStyle: { color, opacity: 1, borderRadius },
  emphasis: { disabled: true, itemStyle: { color, opacity: 1 } },
  blur: { itemStyle: { color, opacity: 1 } },
  select: { disabled: true, itemStyle: { color, opacity: 1 } }
});

const niceStep = (roughStep: number) => {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / magnitude;
  const factor = [1, 2, 2.5, 3, 5, 10].find(candidate => candidate >= fraction) ?? 10;
  return factor * magnitude;
};

const zeroBasedAxis = (rawMax: number, minimumSpan: number) => {
  const targetMax = Math.max(rawMax * 1.2, minimumSpan);
  const interval = niceStep(targetMax / 3);
  return { min: 0, max: Math.ceil(targetMax / interval) * interval, interval };
};

const rangedAxis = (rawMin: number, rawMax: number) => {
  const dataSpan = Math.max(rawMax - rawMin, 0.5);
  const paddedMin = Math.max(0, rawMin - dataSpan * 0.25);
  const paddedMax = rawMax + dataSpan * 0.3;
  const interval = niceStep((paddedMax - paddedMin) / 3);
  const min = Math.max(0, Math.floor(paddedMin / interval) * interval);
  const max = Math.ceil(paddedMax / interval) * interval;
  return { min, max: max <= rawMax ? max + interval : max, interval };
};

function EmptyChart({ text }: { text: string }) {
  return <div className="stats-empty">{text}</div>;
}

function SoftChartCard({
  title,
  subtitle,
  icon,
  tone,
  children,
  legend
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: 'rose' | 'amber' | 'lavender' | 'sage' | 'peach';
  children: ReactNode;
  legend?: ReactNode;
}) {
  return (
    <section className="stats-card">
      <div className="stats-card-header">
        <div className={`stats-card-icon ${tone}`}>{icon}</div>
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

  const base = axisBase(dataBuckets.map(bucket => bucket.label));
  const axis = zeroBasedAxis(Math.max(...dataBuckets.map(bucket => Number(bucket[valueKey]))), minMax);
  return <EChart option={{ ...base, yAxis: { ...(base.yAxis as object), ...axis, axisLabel: { color: cssColor('--text-muted', '#8b857f'), formatter: (value: number) => `${Math.round(value)}${unit}` } }, series: [{ name: valueKey === 'milk' ? '瓶喂奶量' : '次数', type: 'bar', data: dataBuckets.map(bucket => Number(bucket[valueKey])), barMaxWidth: 28, ...stableBarStates(color, [7, 7, 2, 2]), label: valueLabel(value => String(Math.round(value))), tooltip: { valueFormatter: (value) => `${Math.round(Number(value))}${unit}` } }] }} />;
}

function SleepChart({ buckets }: { buckets: BucketStat[] }) {
  const dataBuckets = buckets.filter(bucket => bucket.sleepHrs > 0);
  if (dataBuckets.length === 0) {
    return <EmptyChart text="当前范围暂无睡眠数据" />;
  }

  return <LineChart buckets={dataBuckets} valueKey="sleepHrs" color={cssColor('--lavender', '#a59ab8')} unit="h" minimumSpan={8} />;
}

function FeedingIntervalChart({ buckets }: { buckets: BucketStat[] }) {
  const dataBuckets = buckets.filter(bucket => bucket.feedingIntervalHrs > 0);
  if (dataBuckets.length === 0) return <EmptyChart text="当前范围暂无连续喂养间隔数据" />;
  return <LineChart buckets={dataBuckets} valueKey="feedingIntervalHrs" color={cssColor('--sage', '#7fa894')} unit="h" minimumSpan={4} />;
}

function LineChart({ buckets, valueKey, color, unit, minimumSpan = 0 }: { buckets: BucketStat[]; valueKey: 'sleepHrs' | 'feedingIntervalHrs' | 'weight'; color: string; unit: string; minimumSpan?: number }) {
  const values = buckets.map(bucket => Number(bucket[valueKey]));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const axis = valueKey === 'weight' ? rangedAxis(rawMin, rawMax) : zeroBasedAxis(rawMax, minimumSpan);
  const base = axisBase(buckets.map(bucket => bucket.label));
  const decimals = valueKey === 'weight' ? 1 : 0;
  const seriesName = valueKey === 'weight' ? '体重' : valueKey === 'sleepHrs' ? '睡眠时长' : '喂养间隔';
  return <EChart option={{ ...base, yAxis: { ...(base.yAxis as object), ...axis, axisLabel: { color: cssColor('--text-muted', '#8b857f'), formatter: (value: number) => `${value.toFixed(decimals)}${unit}` } }, series: [{ name: seriesName, type: 'line', data: values, smooth: 0.22, symbol: 'circle', symbolSize: 9, lineStyle: { width: 3, color }, itemStyle: { color: cssColor('--bg-card', '#fff'), borderColor: color, borderWidth: 3 }, label: valueLabel(value => `${value.toFixed(1)}${valueKey === 'weight' ? 'kg' : ''}`), tooltip: { valueFormatter: (value) => `${Number(value).toFixed(1)}${unit}` }, emphasis: { focus: 'series' } }] }} />;
}

function DiaperChart({ buckets }: { buckets: BucketStat[] }) {
  const dataBuckets = buckets.filter(bucket => bucket.pee + bucket.poop > 0);
  if (dataBuckets.length === 0) {
    return <EmptyChart text="当前范围暂无排泄数据" />;
  }

  const base = axisBase(dataBuckets.map(bucket => bucket.label));
  const totalMax = Math.max(...dataBuckets.map(bucket => bucket.pee + bucket.poop), 5);
  const axis = zeroBasedAxis(totalMax, 5);
  return <EChart option={{ ...base, yAxis: { ...(base.yAxis as object), ...axis, axisLabel: { color: cssColor('--text-muted', '#8b857f'), formatter: (value: number) => `${Math.round(value)}次` } }, series: [
    { name: '嘘嘘', type: 'bar', stack: 'total', data: dataBuckets.map(bucket => bucket.pee), barMaxWidth: 28, ...stableBarStates(cssColor('--sage', '#7fa894'), [0, 0, 3, 3]), tooltip: { valueFormatter: (value) => `${Math.round(Number(value))}次` } },
    { name: '便便', type: 'bar', stack: 'total', data: dataBuckets.map(bucket => bucket.poop), barMaxWidth: 28, ...stableBarStates(cssColor('--amber', '#dca072'), [7, 7, 0, 0]), label: { ...valueLabel((_value) => ''), formatter: (params: CallbackDataParams) => String(Number(dataBuckets[params.dataIndex].pee + dataBuckets[params.dataIndex].poop).toFixed(1)).replace('.0', '') }, tooltip: { valueFormatter: (value) => `${Math.round(Number(value))}次` } }
  ] }} />;
}

function GrowthChart({ buckets }: { buckets: BucketStat[] }) {
  const growthBuckets = buckets.filter(bucket => bucket.hasWeightLog && bucket.weight > 0);
  if (growthBuckets.length === 0) {
    return <div className="stats-empty">暂无体重数据，可以在记录大盘中补一条体重。</div>;
  }

  return <LineChart buckets={growthBuckets} valueKey="weight" color={cssColor('--rose', '#d88f8f')} unit="kg" />;
}

export function Stats({ logs, birthday }: StatsProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const range = RANGE_OPTIONS.find(option => option.mode === rangeMode) ?? RANGE_OPTIONS[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstYearMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const startDate = rangeMode === 'year' ? firstYearMonth : addDays(today, -(range.days - 1));

  const rangeDayCount = Math.round((today.getTime() - startDate.getTime()) / 86400000) + 1;
  const dateRange = Array.from({ length: rangeDayCount }, (_, i) => toDateKey(addDays(startDate, i)));
  const weightLogDates = new Set(
    logs
      .filter(log => log.logType === 'growth' && log.metadata.weightKg)
      .map(log => log.timestamp.split('T')[0])
  );
  const feedingIntervalsByDate = new Map<string, number[]>();
  getEffectiveFeedingIntervals(logs).forEach(({ log, minutes }) => {
    const key = log.timestamp.split('T')[0];
    feedingIntervalsByDate.set(key, [...(feedingIntervalsByDate.get(key) ?? []), minutes / 60]);
  });

  const dailyStats: DailyStat[] = dateRange.map(date => {
    const dayLogs = logs.filter(log => log.timestamp.split('T')[0] === date);
    let totalMilkMl = 0;
    let totalSleepMins = 0;
    let peeCount = 0;
    let poopCount = 0;
    let latestWeight = 0;
    const feedingIntervals = feedingIntervalsByDate.get(date) ?? [];

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
      feedingIntervalHrs: feedingIntervals.length ? Number((feedingIntervals.reduce((sum, item) => sum + item, 0) / feedingIntervals.length).toFixed(1)) : 0,
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
      feedingIntervalHrs: avgRecorded(items.map(item => item.feedingIntervalHrs)),
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

    const firstMonth = firstYearMonth;
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthStart = addMonths(firstMonth, monthIndex);
      const nextMonth = addMonths(monthStart, 1);
      const items = dailyStats
        .map(item => ({ item, date: parseDateKey(item.date) }))
        .filter(entry => entry.date >= monthStart && entry.date < nextMonth);
      const fillItems = items.map(entry => entry.item);
      const bucket = makeBucket(fillItems, toDateKey(monthStart), `${monthStart.getMonth() + 1}月`);
      const monthWeightLogs = logs
        .filter(log => log.logType === 'growth' && Number(log.metadata.weightKg) > 0)
        .filter(log => {
          const date = new Date(log.timestamp);
          return date >= monthStart && date < nextMonth;
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const birthDate = birthday ? parseDateKey(birthday) : null;
      const isBirthMonth = birthDate
        && birthDate.getFullYear() === monthStart.getFullYear()
        && birthDate.getMonth() === monthStart.getMonth();
      const monthWeightLog = isBirthMonth ? monthWeightLogs[0] : monthWeightLogs.at(-1);
      return monthWeightLog
        ? { ...bucket, weight: Number(monthWeightLog.metadata.weightKg), hasWeightLog: true }
        : bucket;
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
          {shortDate(toDateKey(startDate))} - {shortDate(toDateKey(today))} · 自动{range.hint}汇总{birthday && rangeMode === 'year' ? ` · 出生 ${birthday.replaceAll('-', '/')}` : ''}
        </p>
      </section>

      <SoftChartCard
        title="体重增长"
        subtitle="仅显示实际体重记录"
        icon={<Scale size={17} />}
        tone="rose"
      >
        <GrowthChart buckets={buckets} />
      </SoftChartCard>

      <SoftChartCard
        title="瓶喂奶量"
        subtitle={`${range.hint}，单位 ml/天`}
        icon={<Milk size={17} />}
        tone="amber"
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
        icon={<Moon size={17} />}
        tone="lavender"
      >
        <SleepChart buckets={buckets} />
      </SoftChartCard>

      <SoftChartCard
        title="喂养间隔"
        subtitle={`${range.hint}，单位 小时`}
        icon={<Clock3 size={18} />}
        tone="sage"
      >
        <FeedingIntervalChart buckets={buckets} />
      </SoftChartCard>

      <SoftChartCard
        title="排泄统计"
        subtitle={`${range.hint}，单位 次/天`}
        icon={<Heart size={17} />}
        tone="peach"
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
