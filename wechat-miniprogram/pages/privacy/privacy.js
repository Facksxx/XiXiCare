const lines = require('../../data/privacyPolicy');
const url = 'https://swsdl.vivo.com.cn/appstore/developer/privacy-policy/6febf0ab5b07441497d22be1c53f248c.html';
Page({
  data: { lines, darkSuffix: '', theme: 'light' },
  onLoad() {
    this.syncTheme(getApp().globalData.theme);
    this.themeListener = result => this.syncTheme(result.theme);
    wx.onThemeChange?.(this.themeListener);
  },
  onUnload() { if (this.themeListener) wx.offThemeChange?.(this.themeListener); },
  syncTheme(theme) { const dark = theme === 'dark'; this.setData({ theme: dark ? 'dark' : 'light', darkSuffix: dark ? '-dark' : '' }); },
  copyLink() { wx.setClipboardData({ data: url, success: () => wx.showToast({ title: '链接已复制', icon: 'success' }) }); }
})
