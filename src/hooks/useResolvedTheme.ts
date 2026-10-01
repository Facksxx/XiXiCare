import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  readMediaTheme,
  resolveTheme,
  SystemTheme,
  SYSTEM_THEME_EVENT,
  type ResolvedTheme,
  type ThemePreference
} from '../utils/theme';

const isDarkDetail = (detail: unknown): ResolvedTheme | null => {
  let payload: unknown = detail;
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); }
    catch { return null; }
  }
  const theme = (payload as { theme?: unknown } | null)?.theme;
  return theme === 'dark' || theme === 'light' ? theme : null;
};

/** 订阅系统深色模式：Web 用媒体查询，安卓额外用原生 uiMode 兜底并监听配置变化事件。 */
export function useSystemTheme(): ResolvedTheme {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readMediaTheme);

  useEffect(() => {
    const isAndroid = Capacitor.getPlatform() === 'android';
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

    const syncFromMedia = () => setSystemTheme(readMediaTheme());
    const syncFromNative = () => {
      void SystemTheme.getSystemTheme()
        .then((result) => setSystemTheme(result?.dark ? 'dark' : 'light'))
        .catch(() => undefined);
    };
    // 安卓 WebView 的媒体查询可能始终返回浅色，因此以原生值为准。
    const syncSystemTheme = () => (isAndroid ? syncFromNative() : syncFromMedia());
    const handleNativeEvent = (event: Event) => {
      const theme = isDarkDetail((event as CustomEvent<unknown>).detail);
      if (theme) setSystemTheme(theme);
    };
    const handleForeground = () => { if (!document.hidden) syncFromNative(); };

    media?.addEventListener('change', syncSystemTheme);
    window.addEventListener(SYSTEM_THEME_EVENT, handleNativeEvent);
    if (isAndroid) {
      syncFromNative();
      document.addEventListener('visibilitychange', handleForeground);
      window.addEventListener('focus', handleForeground);
    }

    return () => {
      media?.removeEventListener('change', syncSystemTheme);
      window.removeEventListener(SYSTEM_THEME_EVENT, handleNativeEvent);
      document.removeEventListener('visibilitychange', handleForeground);
      window.removeEventListener('focus', handleForeground);
    };
  }, []);

  return systemTheme;
}

/** 把用户偏好与系统主题合成最终生效的主题。 */
export function useResolvedTheme(preference: ThemePreference): ResolvedTheme {
  return resolveTheme(preference, useSystemTheme());
}
