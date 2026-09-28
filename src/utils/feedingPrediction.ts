import type { ActivityLog } from '../types/baby';
import { getEffectiveFeedingIntervals } from './feedingIntervals';

/** 上次喂奶时间与当前时间相差超过该时长时，不再显示预测内容。 */
export const FEEDING_PREDICTION_MAX_GAP_MS = 6 * 60 * 60 * 1000;
/** 预测基于最近 N 天的喂奶间隔。 */
export const FEEDING_PREDICTION_WINDOW_DAYS = 7;

export interface NextFeedingPrediction {
  /** 最近一次喂奶时间（毫秒时间戳）。 */
  lastFeedingAt: number;
  /** 预计下次喂奶时间（毫秒时间戳）。 */
  predictedAt: number;
  /** 最近 7 天有效喂奶间隔的平均值（分钟）。 */
  averageIntervalMinutes: number;
  /** 参与计算的间隔样本数量。 */
  sampleCount: number;
}

/**
 * 根据最近 7 天的喂奶间隔推算下一次喂奶时间。
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
  const feedingTimes = logs
    .filter(log => log.logType === 'feeding')
    .map(log => new Date(log.timestamp).getTime())
    .filter(time => Number.isFinite(time))
    .sort((a, b) => a - b);
  if (feedingTimes.length === 0) return null;

  const lastFeedingAt = feedingTimes[feedingTimes.length - 1];
  if (Math.abs(now - lastFeedingAt) > FEEDING_PREDICTION_MAX_GAP_MS) return null;

  const windowStart = now - FEEDING_PREDICTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentIntervals = getEffectiveFeedingIntervals(logs).filter(
    item => new Date(item.log.timestamp).getTime() >= windowStart
  );
  if (recentIntervals.length === 0) return null;

  const averageIntervalMinutes =
    recentIntervals.reduce((sum, item) => sum + item.minutes, 0) / recentIntervals.length;
  const predictedAt = lastFeedingAt + averageIntervalMinutes * 60000;
  if (Math.abs(now - predictedAt) > FEEDING_PREDICTION_MAX_GAP_MS) return null;

  return {
    lastFeedingAt,
    predictedAt,
    averageIntervalMinutes: Math.round(averageIntervalMinutes),
    sampleCount: recentIntervals.length
  };
};
