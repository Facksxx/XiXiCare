import { Capacitor, registerPlugin } from '@capacitor/core';

/** 用户可选的三种主题模式：固定浅色、固定深色、跟随系统（自动）。 */
export type ThemePreference = 'light' | 'dark' | 'auto';
/** 实际落到界面上的主题，只可能是浅色或深色。 */
export type ResolvedTheme = 'light' | 'dark';

interface SystemThemePlugin {
  getSystemTheme(): Promise<{ dark?: boolean }>;
  setDarkMode(options: { dark: boolean }): Promise<void>;
}

/** 安卓原生兜底：WebView 的 prefers-color-scheme 在部分机型上不可靠，直接读系统 uiMode。 */
export const SystemTheme = registerPlugin<SystemThemePlugin>('SystemTheme');

export const THEME_STORAGE_KEY = 'babycare_theme';
export const SYSTEM_THEME_EVENT = 'xixicareSystemTheme';

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** 兼容历史值与脏数据：只接受 light / dark / auto，其它一律按浅色处理。 */
export const normalizeThemePreference = (value: unknown): ThemePreference =>
  value === 'dark' || value === 'auto' ? value : 'light';

/** 读取浏览器/WebView 的深色模式偏好。 */
export const readMediaTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light';
};

export const resolveTheme = (preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme =>
  preference === 'auto' ? systemTheme : preference;

export const themePreferenceLabel = (preference: ThemePreference) =>
  preference === 'auto' ? '跟随系统' : preference === 'dark' ? '深夜模式' : '日间模式';

/**
 * 把当前生效主题同步给安卓系统栏：深色主题下状态栏 / 导航栏图标转白、导航栏底色变深，
 * 否则手动切到深色时系统栏图标仍然是深色，在深色背景上看不清。
 */
export const applySystemBars = (theme: ResolvedTheme) => {
  if (Capacitor.getPlatform() !== 'android') return;
  void SystemTheme.setDarkMode({ dark: theme === 'dark' }).catch(() => undefined);
};
