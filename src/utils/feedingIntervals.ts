import type { ActivityLog } from '../types/baby';

export const MIN_FEEDING_INTERVAL_MINUTES = 30;
export const MAX_FEEDING_INTERVAL_MINUTES = 24 * 60;

export interface EffectiveFeedingInterval {
  log: ActivityLog;
  minutes: number;
}

export const getEffectiveFeedingIntervals = (logs: ActivityLog[]): EffectiveFeedingInterval[] => {
  const feedingLogs = logs
    .filter(log => log.logType === 'feeding')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  const intervals: EffectiveFeedingInterval[] = [];
  let previousEffectiveTime: number | null = null;

  feedingLogs.forEach(log => {
    const currentTime = new Date(log.timestamp).getTime();
    if (!Number.isFinite(currentTime)) return;
    if (previousEffectiveTime === null) {
      previousEffectiveTime = currentTime;
      return;
    }

    const minutes = Math.round((currentTime - previousEffectiveTime) / 60000);
    if (minutes <= MIN_FEEDING_INTERVAL_MINUTES) return;
    if (minutes <= MAX_FEEDING_INTERVAL_MINUTES) intervals.push({ log, minutes });
    previousEffectiveTime = currentTime;
  });

  return intervals;
};

