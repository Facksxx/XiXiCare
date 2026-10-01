import type { ActivityLog } from '../types/baby';
import { getEffectiveFeedingIntervals } from './feedingIntervals';

/** 上次喂奶时间与当前时间相差超过该时长时，不再显示预测内容。 */
export const FEEDING_PREDICTION_MAX_GAP_MS = 6 * 60 * 60 * 1000;
/** 预测基于最近 N 天的喂奶间隔。 */
export const FEEDING_PREDICTION_WINDOW_DAYS = 7;
/** 样本权重半衰期（天）：越近的间隔权重越高，权重 = 0.5 ^ (距今天数 / 2.5)。 */
export const FEEDING_PREDICTION_HALF_LIFE_DAYS = 2.5;
/** 分时段样本少于该数量时回退到全时段样本，避免小样本抖动。 */
export const FEEDING_PREDICTION_MIN_PERIOD_SAMPLES = 4;
/** 夜间时段：22:00 - 06:00（含起点，不含终点）。 */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
/** 奶量启发式修正：系数、上下限、最少样本数。 */
const VOLUME_ADJUST_STRENGTH = 0.3;
const VOLUME_ADJUST_LIMIT = 0.08;
const VOLUME_ADJUST_MIN_SAMPLES = 5;

export type FeedingPeriod = 'day' | 'night';

export interface NextFeedingPrediction {
  /** 最近一次喂奶时间（毫秒时间戳）。 */
  lastFeedingAt: number;
  /** 预计下次喂奶时间（毫秒时间戳）。 */
  predictedAt: number;
  /** 最终采用的基准间隔（分钟）。 */
  averageIntervalMinutes: number;
  /** 参与最终计算的间隔样本数量。 */
  sampleCount: number;
  /** 基准间隔所属时段。 */
  period: FeedingPeriod;
  /** true = 使用了分时段样本，false = 回退到全时段样本。 */
  periodScoped: boolean;
  /** 最近一次喂养的奶量（毫升），非瓶喂或未记录为 null。 */
  lastVolumeMl: number | null;
  /** 奶量启发式修正量（分钟，正数表示延后）。 */
  volumeAdjustmentMinutes: number;
}

export const feedingPeriodOf = (timestamp: number): FeedingPeriod => {
  const hour = new Date(timestamp).getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR ? 'night' : 'day';
};

const decayWeight = (ageMs: number) =>
  Math.pow(0.5, Math.max(0, ageMs) / (FEEDING_PREDICTION_HALF_LIFE_DAYS * 24 * 60 * 60 * 1000));

interface IntervalSample {
  minutes: number;
  weight: number;
  period: FeedingPeriod;
}

/** 加权中位数：按值排序后累计权重，取累计到一半时的值（用于 MAD）。 */
const weightedMedian = (values: Array<{ value: number; weight: number }>): number => {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let accumulated = 0;
  for (const item of sorted) {
    accumulated += item.weight;
    if (accumulated >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1]?.value ?? 0;
};

const weightedMean = (samples: IntervalSample[]): number => {
  const total = samples.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return 0;
  return samples.reduce((sum, item) => sum + item.minutes * item.weight, 0) / total;
};

/**
 * 稳健加权均值：先用加权均值求中心，再用 MAD 剔除偏离过大的间隔，最后重新加权平均。
 * 相比纯中位数，它在「上半夜长觉 + 下半夜短觉」这类双峰分布下不会只取到端点值；
 * 相比纯均值，它又能挡住漏记、夜醒补喂产生的极端间隔。
 */
const robustWeightedMean = (samples: IntervalSample[]): number => {
  if (samples.length < 5) return weightedMean(samples);
  const center = weightedMean(samples);
  const mad = weightedMedian(samples.map(item => ({ value: Math.abs(item.minutes - center), weight: item.weight })));
  if (mad <= 0) return center;
  const kept = samples.filter(item => Math.abs(item.minutes - center) <= 2.5 * mad);
  return kept.length > 0 ? weightedMean(kept) : center;
};

const bottleVolume = (log: ActivityLog): number | null => {
  if (log.metadata.feedingType !== 'bottle') return null;
  const volume = log.metadata.bottle?.volumeMl;
  return typeof volume === 'number' && volume > 0 ? volume : null;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * 根据喂奶记录推算下一次喂奶时间。
 *
 * 算法（详见 docs/feeding-prediction.md）：
 * 1. 只取最近 7 天、且落在 30 分钟 ~ 24 小时区间内的有效间隔；
 * 2. 先算出全时段基准，用「上次喂奶 + 基准」判断下一顿落在白天还是夜间；
 * 3. 取该时段的间隔样本（少于 4 条时回退全时段），按近期权重做 MAD 截尾加权均值；
 * 4. 若最近一次是瓶喂且历史瓶喂量样本充足，按奶量比例做小幅启发式修正。
 *
 * 隐藏规则（任一命中即返回 null，不显示内容）：
 * 1. 上次喂奶时间与当前时间相差超过 6 小时；
 * 2. 当前时间与预测时间相差超过 6 小时；
 * 3. 没有可参考的喂奶记录或最近 7 天没有有效间隔。
 */
export const getNextFeedingPrediction = (
  logs: ActivityLog[],
  now: number = Date.now()
): NextFeedingPrediction | null => {
  const feedingLogs = logs
    .filter(log => log.logType === 'feeding')
    .map(log => ({ log, time: new Date(log.timestamp).getTime() }))
    .filter(item => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time);
  if (feedingLogs.length === 0) return null;

  const last = feedingLogs[feedingLogs.length - 1];
  if (Math.abs(now - last.time) > FEEDING_PREDICTION_MAX_GAP_MS) return null;

  const windowStart = now - FEEDING_PREDICTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentIntervals = getEffectiveFeedingIntervals(logs).filter(
    item => new Date(item.log.timestamp).getTime() >= windowStart
  );
  if (recentIntervals.length === 0) return null;

  const samples: IntervalSample[] = recentIntervals.map(item => {
    const time = new Date(item.log.timestamp).getTime();
    const start = time - item.minutes * 60000;
    return {
      minutes: item.minutes,
      weight: decayWeight(now - time),
      // 按间隔中点归档：跨越昼夜的整觉取中点，才不会把夜觉后的第一顿算成白天样本
      period: feedingPeriodOf((start + time) / 2)
    };
  });

  // 先判断下一顿落在哪个时段，再取对应时段的样本
  const overallBase = robustWeightedMean(samples);
  const targetPeriod = feedingPeriodOf(last.time + overallBase * 60000);
  const periodSamples = samples.filter(sample => sample.period === targetPeriod);
  const periodScoped = periodSamples.length >= FEEDING_PREDICTION_MIN_PERIOD_SAMPLES;
  const picked = periodScoped ? periodSamples : samples;

  const baseMinutes = robustWeightedMean(picked);

  // 瓶喂奶量启发式修正：这顿喝得比平时多，下一顿通常稍微推后
  const lastVolumeMl = bottleVolume(last.log);
  const bottleVolumes = feedingLogs
    .map(item => bottleVolume(item.log))
    .filter((volume): volume is number => volume !== null);
  let volumeAdjustmentMinutes = 0;
  if (lastVolumeMl !== null && bottleVolumes.length >= VOLUME_ADJUST_MIN_SAMPLES) {
    const typical = median(bottleVolumes);
    if (typical > 0) {
      const ratio = Math.min(1.6, Math.max(0.6, lastVolumeMl / typical));
      const raw = baseMinutes * VOLUME_ADJUST_STRENGTH * (ratio - 1);
      const limit = baseMinutes * VOLUME_ADJUST_LIMIT;
      volumeAdjustmentMinutes = Math.round(Math.min(limit, Math.max(-limit, raw)));
    }
  }

  const predictedAt = last.time + (baseMinutes + volumeAdjustmentMinutes) * 60000;
  if (Math.abs(now - predictedAt) > FEEDING_PREDICTION_MAX_GAP_MS) return null;

  return {
    lastFeedingAt: last.time,
    predictedAt,
    averageIntervalMinutes: Math.round(baseMinutes),
    sampleCount: picked.length,
    period: targetPeriod,
    periodScoped,
    lastVolumeMl,
    volumeAdjustmentMinutes
  };
};
