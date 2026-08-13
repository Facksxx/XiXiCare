import type { ActivityLog } from '../types/baby';

const minutesBetween = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const value = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

export const normalizeActivityLog = (log: ActivityLog): ActivityLog => {
  if (log.logType !== 'feeding' && log.logType !== 'sleep') return log;
  const metadata = { ...log.metadata };
  const startTime = typeof metadata.startTime === 'string' ? metadata.startTime : log.timestamp;
  const legacyEndTime = typeof metadata.endTime === 'string' ? metadata.endTime : undefined;
  const storedDuration = Number(metadata.durationMinutes);

  metadata.startTime = startTime;
  if (log.logType === 'sleep') {
    metadata.durationMinutes = storedDuration > 0 ? Math.round(storedDuration) : minutesBetween(startTime, legacyEndTime);
  } else if (storedDuration > 0) {
    metadata.durationMinutes = Math.round(storedDuration);
  } else {
    delete metadata.durationMinutes;
  }
  delete metadata.endTime;
  return { ...log, timestamp: startTime, metadata };
};

export const normalizeActivityLogs = (logs: ActivityLog[]) => logs.map(normalizeActivityLog);
