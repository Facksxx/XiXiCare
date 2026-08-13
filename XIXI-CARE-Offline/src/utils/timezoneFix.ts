import type { ActivityLog } from '../types/baby';

/**
 * 修复历史数据时区问题：
 * 旧版本可能使用 toISOString() 存储时间（带 Z 后缀的 UTC 时间），
 * 导致在不同时区设备上显示的日期不正确。
 * 新版本使用本地时间存储（如 2025-08-05T14:30:00），不带时区标记。
 *
 * 此函数检测并转换旧格式数据为本地时间格式。
 */
export function fixTimezoneIssues(logs: ActivityLog[]): ActivityLog[] {
  let changed = false;
  const fixed = logs.map(log => {
    const ts = log.timestamp;
    // 检测 UTC 格式（以 Z 结尾或包含时区偏移 +HH:MM/-HH:MM）
    if (ts.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(ts)) {
      try {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => String(n).padStart(2, '0');
          // 转换为本地时间表示（无时区标记）
          const localTs = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

          const newLog: ActivityLog = { ...log, timestamp: localTs };

          // 同时修复 metadata 中的时间字段
          if (log.metadata?.startTime) {
            const sd = new Date(log.metadata.startTime);
            if (!isNaN(sd.getTime())) {
              newLog.metadata = {
                ...newLog.metadata,
                startTime: `${sd.getFullYear()}-${pad(sd.getMonth() + 1)}-${pad(sd.getDate())}T${pad(sd.getHours())}:${pad(sd.getMinutes())}:${pad(sd.getSeconds())}`
              };
            }
          }
          if (log.metadata?.endTime) {
            const ed = new Date(log.metadata.endTime);
            if (!isNaN(ed.getTime())) {
              newLog.metadata = {
                ...newLog.metadata,
                endTime: `${ed.getFullYear()}-${pad(ed.getMonth() + 1)}-${pad(ed.getDate())}T${pad(ed.getHours())}:${pad(ed.getMinutes())}:${pad(ed.getSeconds())}`
              };
            }
          }

          changed = true;
          return newLog;
        }
      } catch {
        // 解析失败，保持原样
      }
    }
    return log;
  });

  return changed ? fixed : logs;
}

/**
 * 检查日志是否有时区问题
 */
export function hasTimezoneIssues(logs: ActivityLog[]): boolean {
  return logs.some(log =>
    log.timestamp.endsWith('Z') ||
    /[+-]\d{2}:\d{2}$/.test(log.timestamp) ||
    (log.metadata?.startTime && (String(log.metadata.startTime).endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(String(log.metadata.startTime))))
  );
}
