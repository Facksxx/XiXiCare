import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as echarts from 'echarts/core';
import type { EChartsOption } from 'echarts';
import type { CallbackDataParams } from 'echarts/types/dist/shared';
import { BarChart as EChartsBar, LineChart as EChartsLine } from 'echarts/charts';
import { DataZoomComponent, GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ActivityLog } from '../types/baby';
import { Check, ChevronDown, ChevronUp, Clock3, Heart, Milk, Moon, RotateCcw, Scale, SlidersHorizontal } from 'lucide-react';
import { getEffectiveFeedingIntervals } from '../utils/feedingIntervals';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DateTimePicker } from './DateTimePicker';

// dataZoom 必须显式注册，否则缩放、平移与复位都不会生效
echarts.use([EChartsBar, EChartsLine, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);

interface StatsProps {
  logs: ActivityLog[];
  birthday: string;
  widgetLaunch?: { chartType: string; token: number } | null;
}

type RangeMode = 'week' | 'month' | 'year' | 'custom';
type BucketMode = 'day' | 'week' | 'month';
type ChartKey = 'weight' | 'milk' | 'sleep' | 'interval' | 'diaper';

interface CustomRange {
  start: string;
  end: string;
}

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

const CHART_KEYS: ChartKey[] = ['weight', 'milk', 'sleep', 'interval', 'diaper'];
const CHART_ORDER_STORAGE_KEY = 'babycare_stats_chart_order';
const CUSTOM_RANGE_STORAGE_KEY = 'babycare_stats_custom_range';
/** 自定义周期最长 730 天，避免一次性渲染过多数据点。 */
const MAX_CUSTOM_DAYS = 730;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

/** 取第一个 series 的数据点数量，用于判断本次 setOption 是否只是样式变化。 */
const optionSeriesLength = (option: EChartsOption): number | null => {
  const series = (option as { series?: unknown }).series;
  const first = Array.isArray(series) ? series[0] : undefined;
  const data = first && typeof first === 'object' && 'data' in first ? (first as { data?: unknown }).data : undefined;
  return Array.isArray(data) ? data.length : null;
};

function EChart({ option, onVisibleCountChange }: {
  option: EChartsOption;
  onVisibleCountChange?: (count: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const signatureRef = useRef<string | null>(null);
  const seriesLengthRef = useRef<number | null>(null);
  const windowRef = useRef({ start: 0, end: 100 });
  const visibleCountRef = useRef(onVisibleCountChange);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    visibleCountRef.current = onVisibleCountChange;
  }, [onVisibleCountChange]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const chart = echarts.init(element, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    const syncZoomState = () => {
      const current = chart.getOption() as {
        dataZoom?: Array<{ start?: number; end?: number }>;
        series?: Array<{ data?: unknown[] }>;
      };
      const view = Array.isArray(current.dataZoom) ? current.dataZoom[0] : undefined;
      const start = Number(view?.start ?? 0);
      const end = Number(view?.end ?? 100);
      windowRef.current = { start, end };
      setZoomed(start > 0.5 || end < 99.5);
      // 回报可见点数，让上层按「看得见的点数」决定是否显示数值标签。
      // 只统计真实数据点（排除 null/0 空档）：体重这类稀疏数据若按桶数计，
      // 放大后窗口里只剩几个点也依然会被判定为「太密」而隐藏标签。
      const seriesData = Array.isArray(current.series?.[0]?.data) ? (current.series[0].data as unknown[]) : [];
      const nonNullTotal = seriesData.filter((value) => value !== null && value !== undefined && Number(value) > 0).length;
      if (nonNullTotal > 0) {
        visibleCountRef.current?.(Math.max(1, Math.round(((end - start) / 100) * nonNullTotal)));
      }
    };
    chart.on('datazoom', syncZoomState);
    return () => {
      observer.disconnect();
      chart.off('datazoom', syncZoomState);
      chart.dispose();
      chartRef.current = null;
      signatureRef.current = null;
    };
  }, []);

  // 只有配置内容真正变化时才重设图表，避免父组件重渲染导致缩放状态被重置
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const signature = JSON.stringify(option, (_key, value: unknown) =>
      typeof value === 'function' ? `fn:${value.toString()}` : value
    );
    if (signature === signatureRef.current) return;
    const isFirstSet = signatureRef.current === null;
    signatureRef.current = signature;

    const nextLength = optionSeriesLength(option);
    // 数据点数没变 → 本次只是标签密度这类样式变化，必须保留用户当前的缩放窗口
    const keepWindow = !isFirstSet && nextLength !== null && nextLength === seriesLengthRef.current;
    const previousWindow = windowRef.current;
    seriesLengthRef.current = nextLength;

    chart.setOption(option, { notMerge: true });

    if (keepWindow) {
      if (previousWindow.start > 0.5 || previousWindow.end < 99.5) {
        chart.dispatchAction({ type: 'dataZoom', start: previousWindow.start, end: previousWindow.end });
      }
    } else if (!isFirstSet) {
      windowRef.current = { start: 0, end: 100 };
      setZoomed(false);
    }
  }, [option]);

  const resetZoom = () => {
    chartRef.current?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 });
    setZoomed(false);
  };

  return (
    <div className="stats-echart-wrap">
      <div ref={containerRef} className="stats-echart" />
      {zoomed && (
        <button type="button" className="stats-zoom-reset" onClick={resetZoom}>
          <RotateCcw size={12} />
          复位
        </button>
      )}
    </div>
  );
}

const buildDataZoom = (withSlider: boolean): EChartsOption['dataZoom'] => {
  const inside = {
    type: 'inside' as const,
    xAxisIndex: 0,
    filterMode: 'filter' as const,
    // 桌面端按住 Ctrl 滚动缩放，避免拦截页面滚动；移动端双指捏合缩放
    zoomOnMouseWheel: 'ctrl' as const,
    moveOnMouseMove: true,
    moveOnMouseWheel: false,
    preventDefaultMouseMove: true
  };
  if (!withSlider) return [inside];

  const sage = cssColor('--sage', '#7fa894');
  const border = cssColor('--border', '#e9e5df');
  return [
    inside,
    {
      type: 'slider' as const,
      xAxisIndex: 0,
      filterMode: 'filter' as const,
      bottom: 4,
      height: 16,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      fillerColor: 'rgba(127, 160, 141, 0.16)',
      handleStyle: { color: sage, borderColor: sage },
      moveHandleStyle: { color: sage },
      emphasis: { handleStyle: { color: sage }, moveHandleStyle: { color: sage } },
      dataBackground: { lineStyle: { color: border, width: 1 }, areaStyle: { color: 'transparent' } },
      selectedDataBackground: { lineStyle: { color: sage }, areaStyle: { color: 'rgba(127, 160, 141, 0.18)' } },
      textStyle: { color: cssColor('--text-muted', '#8b857f'), fontSize: 9 },
      showDetail: false,
      brushSelect: false
    }
  ];
};

const axisBase = (labels: string[]) => {
  const withSlider = labels.length > 7;
  return {
    animationDuration: 0,
    animationDurationUpdate: 0,
    grid: { left: 14, right: 14, top: 52, bottom: withSlider ? 32 : 8, containLabel: true },
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
      axisLabel: { color: cssColor('--text-muted', '#8b857f'), fontSize: 11, interval: labels.length <= 7 ? 0 : 'auto' as const, hideOverlap: labels.length > 7, margin: 12 }
    },
    yAxis: {
      type: 'value' as const,
      scale: true,
      splitNumber: 3,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: cssColor('--text-muted', '#8b857f'), fontSize: 10, margin: 8 },
      splitLine: { lineStyle: { color: cssColor('--border', '#e9e5df'), type: 'dashed' as const } }
    },
    dataZoom: buildDataZoom(withSlider)
  };
};

/**
 * 数值标签密度阶梯：数据点越多标签越短，超过上限则整体隐藏。
 * 判定依据是**当前可见的数据点数量**（缩放后随之变化），不是总数，
 * 所以放大到一定程度会重新显示数值；缩到很密时靠提示框读数。
 */
type LabelMode = 'full' | 'compact' | 'none';
const LINE_LABEL_FULL_LIMIT = 10;
const LINE_LABEL_COMPACT_LIMIT = 18;
const BAR_LABEL_LIMIT = 14;
const lineLabelMode = (count: number): LabelMode =>
  count <= LINE_LABEL_FULL_LIMIT ? 'full' : count <= LINE_LABEL_COMPACT_LIMIT ? 'compact' : 'none';
const barLabelMode = (count: number): LabelMode => (count <= BAR_LABEL_LIMIT ? 'full' : 'none');
const labelVisible = (mode: LabelMode) => mode !== 'none';

/** 跟随缩放变化的可见数据点数：数据量本身变化时（切换周期/自定义范围）回到全量。 */
const useVisiblePointCount = (total: number) => {
  const [visible, setVisible] = useState(total);
  const [seenTotal, setSeenTotal] = useState(total);
  if (seenTotal !== total) {
    setSeenTotal(total);
    setVisible(total);
  }
  return [visible, setVisible] as const;
};

const valueLabel = (formatter: (value: number) => string, mode: LabelMode = 'full') => ({
  show: labelVisible(mode),
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
  id,
  title,
  subtitle,
  icon,
  tone,
  children,
  legend,
  sortControls
}: {
  id?: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  tone: 'rose' | 'amber' | 'lavender' | 'sage' | 'peach';
  children: ReactNode;
  legend?: ReactNode;
  sortControls?: ReactNode;
}) {
  return (
    <section className="stats-card" id={id}>
      <div className="stats-card-header">
        <div className={`stats-card-icon ${tone}`}>{icon}</div>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {sortControls}
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
  const [visibleCount, setVisibleCount] = useVisiblePointCount(buckets.length);
  if (!buckets.some(bucket => Number(bucket[valueKey]) > 0)) {
    return <EmptyChart text="无数据" />;
  }

  const base = axisBase(buckets.map(bucket => bucket.label));
  const axis = zeroBasedAxis(Math.max(...buckets.map(bucket => Number(bucket[valueKey]))), minMax);
  const mode = barLabelMode(visibleCount);
  return <EChart onVisibleCountChange={setVisibleCount} option={{ ...base, yAxis: { ...(base.yAxis as object), ...axis, axisLabel: { color: cssColor('--text-muted', '#8b857f'), formatter: (value: number) => `${Math.round(value)}${unit}` } }, series: [{ name: valueKey === 'milk' ? '瓶喂奶量' : '次数', type: 'bar', data: buckets.map(bucket => Number(bucket[valueKey])), barMaxWidth: 28, ...stableBarStates(color, [7, 7, 2, 2]), label: valueLabel(value => Number(value) > 0 ? String(Math.round(value)) : '', mode), tooltip: { valueFormatter: (value) => Number(value) > 0 ? `${Math.round(Number(value))}${unit}` : '无数据' } }] }} />;
}

function SleepChart({ buckets }: { buckets: BucketStat[] }) {
  if (!buckets.some(bucket => bucket.sleepHrs > 0)) {
    return <EmptyChart text="无数据" />;
  }

  return <LineChart buckets={buckets} valueKey="sleepHrs" color={cssColor('--lavender', '#a59ab8')} unit="h" minimumSpan={8} />;
}

function FeedingIntervalChart({ buckets }: { buckets: BucketStat[] }) {
  if (!buckets.some(bucket => bucket.feedingIntervalHrs > 0)) return <EmptyChart text="无数据" />;
  return <LineChart buckets={buckets} valueKey="feedingIntervalHrs" color={cssColor('--sage', '#7fa894')} unit="h" minimumSpan={4} />;
}

function LineChart({ buckets, valueKey, color, unit, minimumSpan = 0 }: { buckets: BucketStat[]; valueKey: 'sleepHrs' | 'feedingIntervalHrs' | 'weight'; color: string; unit: string; minimumSpan?: number }) {
  const [visibleCount, setVisibleCount] = useVisiblePointCount(buckets.length);
  const values = buckets.map(bucket => Number(bucket[valueKey])).filter(value => value > 0);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const axis = valueKey === 'weight' ? rangedAxis(rawMin, rawMax) : zeroBasedAxis(rawMax, minimumSpan);
  const base = axisBase(buckets.map(bucket => bucket.label));
  const decimals = valueKey === 'weight' ? 1 : 0;
  const seriesName = valueKey === 'weight' ? '体重' : valueKey === 'sleepHrs' ? '睡眠时长' : '喂养间隔';
  const mode = lineLabelMode(visibleCount);
  // 体重只在有记录的日子有点，用 connectNulls 把相邻记录连成趋势线
  const connectNulls = valueKey === 'weight';
  return <EChart onVisibleCountChange={setVisibleCount} option={{ ...base, yAxis: { ...(base.yAxis as object), ...axis, axisLabel: { color: cssColor('--text-muted', '#8b857f'), formatter: (value: number) => `${value.toFixed(decimals)}${unit}` } }, series: [{ name: seriesName, type: 'line', data: buckets.map(bucket => Number(bucket[valueKey]) > 0 ? Number(bucket[valueKey]) : null), connectNulls, smooth: 0.22, symbol: 'circle', symbolSize: mode === 'full' ? 9 : mode === 'compact' ? 6 : 5, lineStyle: { width: 3, color }, itemStyle: { color: cssColor('--bg-card', '#fff'), borderColor: color, borderWidth: 3 }, label: valueLabel(value => (valueKey === 'weight' && mode === 'full' ? `${value.toFixed(1)}kg` : value.toFixed(1)), mode), tooltip: { valueFormatter: (value) => value == null || Number(value) <= 0 ? '无数据' : `${Number(value).toFixed(1)}${unit}` }, emphasis: { focus: 'series' } }] }} />;
}

function DiaperChart({ buckets }: { buckets: BucketStat[] }) {
  const [visibleCount, setVisibleCount] = useVisiblePointCount(buckets.length);
  if (!buckets.some(bucket => bucket.pee + bucket.poop > 0)) {
    return <EmptyChart text="无数据" />;
  }

  const base = axisBase(buckets.map(bucket => bucket.label));
  const totalMax = Math.max(...buckets.map(bucket => bucket.pee + bucket.poop), 5);
  const axis = zeroBasedAxis(totalMax, 5);
  const labelMode = barLabelMode(visibleCount);
  return <EChart onVisibleCountChange={setVisibleCount} option={{ ...base, yAxis: { ...(base.yAxis as object), ...axis, axisLabel: { color: cssColor('--text-muted', '#8b857f'), formatter: (value: number) => `${Math.round(value)}次` } }, series: [
    { name: '嘘嘘', type: 'bar', stack: 'total', data: buckets.map(bucket => bucket.pee), barMaxWidth: 28, ...stableBarStates(cssColor('--sage', '#7fa894'), [0, 0, 3, 3]), tooltip: { valueFormatter: (value) => Number(value) > 0 ? `${Math.round(Number(value))}次` : '无数据' } },
    { name: '便便', type: 'bar', stack: 'total', data: buckets.map(bucket => bucket.poop), barMaxWidth: 28, ...stableBarStates(cssColor('--amber', '#dca072'), [7, 7, 0, 0]), label: { ...valueLabel((_value) => '', labelMode), formatter: (params: CallbackDataParams) => { const total = buckets[params.dataIndex].pee + buckets[params.dataIndex].poop; return total > 0 ? String(total.toFixed(1)).replace('.0', '') : ''; } }, tooltip: { valueFormatter: (value) => Number(value) > 0 ? `${Math.round(Number(value))}次` : '无数据' } }
  ] }} />;
}

function GrowthChart({ buckets }: { buckets: BucketStat[] }) {
  if (!buckets.some(bucket => bucket.hasWeightLog && bucket.weight > 0)) {
    return <div className="stats-empty">无数据</div>;
  }

  return <LineChart buckets={buckets.map(bucket => ({ ...bucket, weight: bucket.hasWeightLog ? bucket.weight : 0 }))} valueKey="weight" color={cssColor('--rose', '#d88f8f')} unit="kg" />;
}

export function Stats({ logs, birthday, widgetLaunch }: StatsProps) {
  useEffect(() => {
    if (!widgetLaunch) return;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(`stats-chart-${widgetLaunch.chartType}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [widgetLaunch]);
  const [rangeMode, setRangeMode] = useState<RangeMode>('week');
  const [customRange, setCustomRange] = useLocalStorage<CustomRange>(CUSTOM_RANGE_STORAGE_KEY, (() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    return { start: toDateKey(addDays(end, -6)), end: toDateKey(end) };
  })());
  const [chartOrder, setChartOrder] = useLocalStorage<ChartKey[]>(CHART_ORDER_STORAGE_KEY, [...CHART_KEYS]);
  const [sortMode, setSortMode] = useState(false);

  const range = RANGE_OPTIONS.find(option => option.mode === rangeMode) ?? RANGE_OPTIONS[0];
  const isCustomRange = rangeMode === 'custom';
  const rangeHint = isCustomRange ? '每日' : range.hint;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const firstYearMonth = new Date(today.getFullYear(), today.getMonth() - 11, 1);

  const safeParseDateKey = (value?: string) => (value && DATE_KEY_PATTERN.test(value) ? parseDateKey(value) : null);

  // 自定义周期：默认最近 7 天，结束日期不晚于今天，最长 730 天
  const customBounds = (() => {
    let end = safeParseDateKey(customRange.end) ?? new Date(today);
    if (end.getTime() > today.getTime()) end = new Date(today);
    let start = safeParseDateKey(customRange.start) ?? addDays(end, -6);
    if (start.getTime() > end.getTime()) start = new Date(end);
    const earliest = addDays(end, -(MAX_CUSTOM_DAYS - 1));
    if (start.getTime() < earliest.getTime()) start = earliest;
    return { start, end };
  })();

  const startDate = isCustomRange
    ? customBounds.start
    : rangeMode === 'year' ? firstYearMonth : addDays(today, -(range.days - 1));
  const endDate = isCustomRange ? customBounds.end : today;

  const dateRange: string[] = [];
  for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
    dateRange.push(toDateKey(date));
  }

  const handleCustomStartChange = (value: string) => {
    if (!value) return;
    const start = value > todayKey ? todayKey : value;
    setCustomRange(current => ({ start, end: current.end && current.end < start ? start : current.end }));
  };

  const handleCustomEndChange = (value: string) => {
    if (!value) return;
    const end = value > todayKey ? todayKey : value;
    setCustomRange(current => ({ start: current.start && current.start > end ? end : current.start, end }));
  };

  const orderedCharts = useMemo(() => {
    const source: unknown = chartOrder;
    const valid = (Array.isArray(source) ? source : [])
      .filter((key, index, list): key is ChartKey =>
        (CHART_KEYS as string[]).includes(key as ChartKey) && list.indexOf(key) === index);
    CHART_KEYS.forEach(key => {
      if (!valid.includes(key)) valid.push(key);
    });
    return valid;
  }, [chartOrder]);

  const moveChart = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= orderedCharts.length) return;
    const next = [...orderedCharts];
    [next[index], next[target]] = [next[target], next[index]];
    setChartOrder(next);
  };

  const sortedLogs = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const logsByDate = new Map<string, ActivityLog[]>();
  const weightsByDate = new Map<string, number[]>();
  sortedLogs.forEach(log => {
    const key = log.timestamp.split('T')[0];
    const dayLogs = logsByDate.get(key);
    if (dayLogs) dayLogs.push(log);
    else logsByDate.set(key, [log]);
    if (log.logType === 'growth' && log.metadata.weightKg) {
      const weights = weightsByDate.get(key);
      if (weights) weights.push(log.metadata.weightKg);
      else weightsByDate.set(key, [log.metadata.weightKg]);
    }
  });

  const feedingIntervalsByDate = new Map<string, number[]>();
  getEffectiveFeedingIntervals(logs).forEach(({ log, minutes }) => {
    const key = log.timestamp.split('T')[0];
    feedingIntervalsByDate.set(key, [...(feedingIntervalsByDate.get(key) ?? []), minutes / 60]);
  });

  // 体重按时间顺序向前结转：范围开始前最近一次体重作为起点
  const startDateKey = toDateKey(startDate);
  let carriedWeight = 0;
  weightsByDate.forEach((weights, key) => {
    if (key < startDateKey) carriedWeight = weights[weights.length - 1];
  });

  const dailyStats: DailyStat[] = dateRange.map(date => {
    const dayLogs = logsByDate.get(date) ?? [];
    let totalMilkMl = 0;
    let totalSleepMins = 0;
    let peeCount = 0;
    let poopCount = 0;
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
      }
    });

    const dayWeights = weightsByDate.get(date);
    if (dayWeights?.length) carriedWeight = dayWeights[dayWeights.length - 1];

    return {
      date,
      milk: totalMilkMl,
      sleepHrs: Number((totalSleepMins / 60).toFixed(1)),
      feedingIntervalHrs: feedingIntervals.length ? Number((feedingIntervals.reduce((sum, item) => sum + item, 0) / feedingIntervals.length).toFixed(1)) : 0,
      pee: peeCount,
      poop: poopCount,
      weight: carriedWeight,
      hasWeightLog: Boolean(dayWeights?.length)
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

  // 自定义周期始终按天聚合，展示范围内每一天的完整数据
  const bucketMode: BucketMode = isCustomRange ? 'day' : range.bucket;

  const buckets: BucketStat[] = (() => {
    if (bucketMode === 'day') {
      return dailyStats.map(item => makeBucket([item], item.date, shortDate(item.date)));
    }

    if (bucketMode === 'week') {
      const chunks: BucketStat[] = [];
      for (let i = 0; i < dailyStats.length; i += 7) {
        const items = dailyStats.slice(i, i + 7);
        chunks.push(makeBucket(items, `week-${i}`, formatRangeLabel(items[0].date, items[items.length - 1].date)));
      }
      return chunks;
    }

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const monthStart = addMonths(firstYearMonth, monthIndex);
      const nextMonth = addMonths(monthStart, 1);
      const monthStartKey = toDateKey(monthStart);
      const nextMonthKey = toDateKey(nextMonth);
      const items = dailyStats
        .map(item => ({ item, date: parseDateKey(item.date) }))
        .filter(entry => entry.date >= monthStart && entry.date < nextMonth)
        .map(entry => entry.item);
      const bucket = makeBucket(items, monthStartKey, `${monthStart.getMonth() + 1}月`);
      const monthWeightLogs = logs
        .filter(log => log.logType === 'growth' && Number(log.metadata.weightKg) > 0)
        .filter(log => {
          const dateKey = log.timestamp.split('T')[0];
          return dateKey >= monthStartKey && dateKey < nextMonthKey;
        })
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      const birthDate = birthday ? parseDateKey(birthday) : null;
      const isBirthMonth = birthDate
        && birthDate.getFullYear() === monthStart.getFullYear()
        && birthDate.getMonth() === monthStart.getMonth();
      const birthDayWeightLog = isBirthMonth
        ? monthWeightLogs.find(log => log.timestamp.split('T')[0] === birthday)
        : undefined;
      const monthWeightLog = isBirthMonth
        ? birthDayWeightLog ?? monthWeightLogs[0]
        : monthWeightLogs.at(-1);
      return monthWeightLog
        ? { ...bucket, weight: Number(monthWeightLog.metadata.weightKg), hasWeightLog: true }
        : bucket;
    });
  })();

  const todayStats = dailyStats.find(stat => stat.date === todayKey) ?? { milk: 0, sleepHrs: 0, pee: 0, poop: 0 };
  // 今日喂奶次数 = 今日全部喂养记录（瓶喂 + 母乳）
  const todayFeedingCount = logs.filter(log => log.logType === 'feeding' && log.timestamp.split('T')[0] === todayKey).length;
  const activeSummary = [
    { label: '今日瓶喂', value: todayStats.milk, unit: 'ml' },
    { label: '今日喂奶', value: todayFeedingCount, unit: '次' },
    { label: '今日睡眠', value: todayStats.sleepHrs, unit: '小时' }
  ];
  const hasDiaperData = buckets.some(bucket => bucket.pee + bucket.poop > 0);

  const rangeNote = isCustomRange
    ? `${shortDate(toDateKey(startDate))} - ${shortDate(toDateKey(endDate))} · 每日完整数据 · 共 ${dateRange.length} 天`
    : `${shortDate(toDateKey(startDate))} - ${shortDate(toDateKey(today))} · 自动${range.hint}汇总${birthday && rangeMode === 'year' ? ` · 出生 ${birthday.replaceAll('-', '/')}` : ''}`;

  const renderSortControls = (index: number) => (sortMode ? (
    <div className="stats-card-sort">
      <button type="button" aria-label="上移" disabled={index === 0} onClick={() => moveChart(index, -1)}><ChevronUp size={15} /></button>
      <button type="button" aria-label="下移" disabled={index === orderedCharts.length - 1} onClick={() => moveChart(index, 1)}><ChevronDown size={15} /></button>
    </div>
  ) : undefined);

  const renderChartCard = (chartKey: ChartKey, index: number) => {
    const controls = renderSortControls(index);
    switch (chartKey) {
      case 'weight':
        return (
          <SoftChartCard
            key="weight"
            id="stats-chart-weight"
            title="体重增长"
            subtitle={rangeMode === 'year' ? '出生月取初始体重，其余月份取月末体重' : '仅显示实际体重记录'}
            icon={<Scale size={17} />}
            tone="rose"
            sortControls={controls}
          >
            <GrowthChart buckets={buckets} />
          </SoftChartCard>
        );
      case 'milk':
        return (
          <SoftChartCard
            key="milk"
            id="stats-chart-milk"
            title="瓶喂奶量"
            subtitle={`${rangeHint}，单位 ml/天`}
            icon={<Milk size={17} />}
            tone="amber"
            sortControls={controls}
          >
            <BarChart buckets={buckets} valueKey="milk" color="var(--amber)" unit="ml" minMax={300} />
          </SoftChartCard>
        );
      case 'sleep':
        return (
          <SoftChartCard
            key="sleep"
            id="stats-chart-sleep"
            title="睡眠时长"
            subtitle={`${rangeHint}，单位 小时/天`}
            icon={<Moon size={17} />}
            tone="lavender"
            sortControls={controls}
          >
            <SleepChart buckets={buckets} />
          </SoftChartCard>
        );
      case 'interval':
        return (
          <SoftChartCard
            key="interval"
            id="stats-chart-interval"
            title="喂养间隔"
            subtitle={`${rangeHint}，单位 小时`}
            icon={<Clock3 size={18} />}
            tone="sage"
            sortControls={controls}
          >
            <FeedingIntervalChart buckets={buckets} />
          </SoftChartCard>
        );
      case 'diaper':
        return (
          <SoftChartCard
            key="diaper"
            id="stats-chart-diaper"
            title="排泄统计"
            subtitle={`${rangeHint}，单位 次/天`}
            icon={<Heart size={17} />}
            tone="peach"
            sortControls={controls}
            legend={hasDiaperData ? (
              <div className="stats-legend">
                <span><i className="legend-pee" />嘘嘘</span>
                <span><i className="legend-poop" />便便</span>
              </div>
            ) : undefined}
          >
            <DiaperChart buckets={buckets} />
          </SoftChartCard>
        );
    }
  };

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
          <div className="stats-control-row">
            <div className="stats-range-group">
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
                <button
                  type="button"
                  className={isCustomRange ? 'active' : ''}
                  onClick={() => setRangeMode('custom')}
                >
                  自定义
                </button>
              </div>
            </div>
            <button
              type="button"
              className={`stats-sort-toggle${sortMode ? ' active' : ''}`}
              onClick={() => setSortMode(value => !value)}
            >
              {sortMode ? <Check size={13} /> : <SlidersHorizontal size={13} />}
              {sortMode ? '完成' : '排序'}
            </button>
          </div>
          {isCustomRange && (
            <div className="stats-custom-range">
              <DateTimePicker mode="date" label="开始日期" placeholder="开始日期" value={customRange.start} onChange={handleCustomStartChange} />
              <span>~</span>
              <DateTimePicker mode="date" label="结束日期" placeholder="结束日期" value={customRange.end} onChange={handleCustomEndChange} />
            </div>
          )}
          <p className="stats-grain-note">{rangeNote}</p>
          {sortMode && <p className="stats-sort-note">点击卡片右上角的上下箭头调整图表顺序，调整结果会自动保存。</p>}
      </section>

      {orderedCharts.map((chartKey, index) => renderChartCard(chartKey, index))}
    </div>
  );
}
