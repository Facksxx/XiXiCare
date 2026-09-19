import type { ActivityLog } from '../types/baby';
import { getEffectiveFeedingIntervals } from './feedingIntervals';

const pad = (value: number) => String(value).padStart(2, '0');
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function buildWidgetChartSnapshot(logs: ActivityLog[], babyId: string) {
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return { date: dateKey(date), milk: 0, sleep: 0, interval: 0 };
  });
  const byDate = new Map(daily.map(item => [item.date, item]));
  if (!babyId) return daily;

  const babyLogs = logs.filter(log => log.babyId === babyId);
  const intervalTotals = new Map<string, { minutes: number; count: number }>();
  for (const { log, minutes } of getEffectiveFeedingIntervals(babyLogs)) {
    const key = log.timestamp.split('T')[0];
    if (!byDate.has(key)) continue;
    const total = intervalTotals.get(key) ?? { minutes: 0, count: 0 };
    total.minutes += minutes;
    total.count += 1;
    intervalTotals.set(key, total);
  }

  for (const log of babyLogs) {
    const entry = byDate.get(log.timestamp.split('T')[0]);
    if (!entry) continue;
    if (log.logType === 'feeding' && log.metadata.feedingType === 'bottle') {
      const value = Number(log.metadata.bottle?.volumeMl);
      if (Number.isFinite(value) && value > 0) entry.milk += value;
    } else if (log.logType === 'sleep') {
      let minutes = Number(log.metadata.durationMinutes);
      if (!(Number.isFinite(minutes) && minutes > 0) && log.metadata.startTime && log.metadata.endTime) {
        minutes = Math.max(0, Math.round((new Date(log.metadata.endTime).getTime() - new Date(log.metadata.startTime).getTime()) / 60000));
      }
      if (Number.isFinite(minutes) && minutes > 0) entry.sleep += minutes;
    }
  }

  for (const [key, total] of intervalTotals) {
    const entry = byDate.get(key);
    if (entry && total.count > 0) entry.interval = total.minutes / total.count;
  }
  return daily;
}
