// 夜间模式：CSS 变量负责页面配色，导航栏与 tabBar 只能用 API 跟随系统主题。
const LIGHT = {
  navigationBar: { frontColor: '#000000', backgroundColor: '#fbfaf6' },
  tabBar: { color: '#96a09b', selectedColor: '#4f7d69', backgroundColor: '#ffffff' },
  background: '#fbfaf6'
};
const DARK = {
  navigationBar: { frontColor: '#ffffff', backgroundColor: '#151917' },
  tabBar: { color: '#869590', selectedColor: '#86b39a', backgroundColor: '#1e2422' },
  background: '#151917'
};

const TAB_ICONS = [
  ['index', 'tab-index'],
  ['records', 'tab-records'],
  ['guide', 'tab-guide'],
  ['vaccine', 'tab-vaccine'],
  ['stats', 'tab-stats'],
];
const THEME_KEY = 'xixicare_theme_mode_v1';

App({
  globalData: { theme: 'light', themeMode: '' },
  onLaunch() {
    const baseInfo = wx.getAppBaseInfo?.() || {};
    const savedTheme = wx.getStorageSync(THEME_KEY);
    const theme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : (baseInfo.theme || 'light');
    this.globalData.themeMode = savedTheme || '';
    this.applyTheme(theme);
    if (wx.onThemeChange) wx.onThemeChange(result => {
      if (!this.globalData.themeMode) this.applyTheme(result.theme);
    });
  },
  setTheme(theme) {
    const mode = theme === 'dark' ? 'dark' : 'light';
    wx.setStorageSync(THEME_KEY, mode);
    this.globalData.themeMode = mode;
    this.applyTheme(mode);
  },
  applyTheme(theme) {
    const dark = theme === 'dark';
    const palette = dark ? DARK : LIGHT;
    const suffix = dark ? '-dark' : '';
    this.globalData.theme = dark ? 'dark' : 'light';
    wx.setNavigationBarColor?.(palette.navigationBar);
    wx.setTabBarStyle?.(palette.tabBar);
    wx.setBackgroundColor?.({ backgroundColor: palette.background });
    // tabBar 图标是 PNG，不能像 CSS 变量那样自动换色，按主题切换一整套
    TAB_ICONS.forEach(([name, file], index) => {
      wx.setTabBarItem?.({ index, iconPath: `assets/${file}${suffix}.png`, selectedIconPath: `assets/${file}-active${suffix}.png` });
    });
  }
})
