const KEY='xixicare_privacy_consent_v1';
Page({
  data:{checked:false,brandColor:'#7f9b8a',theme:'light'},
  onLoad(){
    this.syncTheme(getApp().globalData.theme);
    this.themeListener=result=>this.syncTheme(result.theme);
    wx.onThemeChange?.(this.themeListener);
    if(wx.getStorageSync(KEY)==='agreed')wx.switchTab({url:'/pages/index/index'});
  },
  onUnload(){if(this.themeListener)wx.offThemeChange?.(this.themeListener);},
  syncTheme(theme){const dark=theme==='dark';this.setData({theme:dark?'dark':'light',brandColor:dark?'#86b39a':'#7f9b8a'});},
  toggleConsent(e){this.setData({checked:e.detail.value.length>0});},
  showPrivacy(){wx.navigateTo({url:'/pages/privacy/privacy'});},
  acceptPrivacy(){if(!this.data.checked)return;wx.setStorageSync(KEY,'agreed');wx.switchTab({url:'/pages/index/index'});}
});
