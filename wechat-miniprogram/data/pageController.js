const store = require('./store');
const vaccine = require('./vaccines');
const guideData = require('./guideData');
const cloud = require('./cloudSync');
const statistics = require('./stats');
const PRIVACY_KEY = 'xixicare_privacy_consent_v1';
const TYPES = [{ key:'feeding',label:'喂养' },{ key:'sleep',label:'睡眠' },{ key:'diaper',label:'尿布' },{ key:'growth',label:'体征' }];
const FEEDING = [{ key:'breast',label:'母乳亲喂' },{ key:'bottle',label:'奶瓶喂养' },{ key:'solids',label:'添加辅食' }];
const LABELS = { feeding:'喂养',sleep:'睡眠',diaper:'尿布',growth:'体征' };
const pad = n => String(n).padStart(2,'0');
function today() { return store.localDateTime().slice(0,10); }
function syncTime(value) { if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':[date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate())].join('-')+' '+[pad(date.getHours()),pad(date.getMinutes())].join(':'); }
function ageText(birthday) {
  const born=new Date(`${birthday}T00:00:00`),now=new Date();if(Number.isNaN(born.getTime()))return '';
  let months=(now.getFullYear()-born.getFullYear())*12+now.getMonth()-born.getMonth();
  if(now.getDate()<born.getDate())months--;
  const days=Math.max(0,Math.floor((now-born)/86400000));
  return months<1?`${days}天`:`${Math.floor(months/12)}岁${months%12}个月`;
}
function stageForBirthday(birthday) { const born=new Date(`${birthday}T00:00:00`),now=new Date();if(Number.isNaN(born.getTime()))return '1';let months=(now.getFullYear()-born.getFullYear())*12+now.getMonth()-born.getMonth();if(now.getDate()<born.getDate())months--;return String(months<1?1:months<3?2:months<6?3:months<8?4:months<12?5:months<18?6:months<24?7:8); }
function describe(log) {
  const m = log.metadata || {};
  if (log.logType === 'feeding') {
    if (m.feedingType === 'bottle') return `瓶喂奶量：${m.bottle?.volumeMl || 0} ml（${m.bottle?.fluidType === 'breastmilk' ? '母乳' : '配方奶'}）`;
    if (m.feedingType === 'solids') return `辅食：${m.solids?.foodName || ''}（${m.solids?.amount || ''}）`;
    return `母乳吸吮：左侧 ${m.breast?.leftMinutes || 0} 分钟 / 右侧 ${m.breast?.rightMinutes || 0} 分钟`;
  }
  if (log.logType === 'sleep') return `睡眠时间：${m.durationMinutes || 0} 分钟`;
  if (log.logType === 'diaper') return `换尿布：${[m.pee?'嘘嘘':'',m.poop?'便便':''].filter(Boolean).join('和')||'干爽'}`;
  return [m.weightKg ? `体重：${m.weightKg} kg` : '',m.heightCm ? `身高：${m.heightCm} cm` : '',m.temperatureC ? `体温：${m.temperatureC} ℃` : ''].filter(Boolean).join(' · ');
}
module.exports = function createPage(tab) { return {
  data: {
    agreed:false, tab, types:TYPES, feedingTypes:FEEDING, type:'feeding', feedingType:'bottle',
    darkSuffix:'', theme:'light', nightMode:false,
    babies:[], baby:null, babyName:'', babyInitial:'宝', babyPhoto:'', birthday:'',editingBabyId:'',showBabyForm:false, showSettings:false,cloudCode:'',cloudBirthday:'',cloudMessage:'',cloudBusy:false,cloudSyncedAt:'',autoSync:cloud.autoSyncEnabled(),
    date:today(),today:today(),time:store.localDateTime().slice(11), volume:120, volumePresets:[60,90,120,150,180,210,240], fluidType:'formula', leftMinutes:10, rightMinutes:10,
    foodName:'', foodAmount:'50g', reactionIndex:0,reactionLabels:['无过敏','轻度','严重'],duration:30,durationPresets:[5,30,60,120,180],sleepTimer:null,timerClock:'00:00:00',timerMinutes:0,pee:true,poop:false,poopColor:'yellow',poopColors:[{key:'yellow',label:'黄色'},{key:'green',label:'绿色'},{key:'brown',label:'褐色'}],growthType:'weight',growthTypes:[{key:'weight',label:'体重'},{key:'height',label:'身高'},{key:'temp',label:'体温'}],growthLabel:'体重（kg）',growthValue:'',weight:'',height:'',temperature:'',editingId:'',typeLabel:'',
    logs:[],filteredLogs:[],todayLogs:[],summary:{ feeding:0,sleep:0,diaper:0 },recordFilter:'all',feedingFilter:'all',bottleFilter:'all',startDate:'',endDate:'',filters:[{key:'all',label:'全部'},...TYPES],feedingFilters:[{key:'all',label:'全部喂养'},...FEEDING],bottleFilters:[{key:'all',label:'全部奶瓶'},{key:'formula',label:'配方奶'},{key:'breastmilk',label:'母乳'}],
    statRange:7,charts:[],statsSummary:[],rangeNote:'',
    stage:'1', stageIntoView:'stage-1', stages:guideData.map(x=>({id:x.id,label:x.id==='1'?x.ageRange.replace(/\s*\([^)]*\)\s*$/,''):x.ageRange})),activeGuide:guideData[0],allergenRows:[],
    vaccineGroups:[],vaccineRows:[],vaccineEmpty:false,vaccineTotal:0,vaccineRemaining:0,vaccineDone:0,vaccineCount:0,vaccineClinicTime:'接种时间：每周二至周六上午（夏令 7:30-11:00；冬令 8:00-11:00）',vaccineNote:'日期按出生日期自动推算，疫苗安排与价格请以当地接种门诊为准。',vaccineFilter:'all',vaccineFilters:[{key:'all',label:'全部'},{key:'pending',label:'待接种'},{key:'done',label:'已完成'}]
  },
  syncTheme(theme) {
    const mode=(theme||getApp().globalData.theme)==='dark'?'dark':'light';
    this.setData({ theme: mode, darkSuffix: mode==='dark'?'-dark':'', nightMode:mode==='dark' });
  },
  onLoad() { if (wx.getStorageSync(PRIVACY_KEY) !== 'agreed') { wx.reLaunch({url:'/pages/consent/consent'}); return; } this.setData({ agreed:true }); this.syncTheme(); this.themeHandler = result => this.syncTheme(result && result.theme); if (wx.onThemeChange) wx.onThemeChange(this.themeHandler); this.refresh(); this.refreshCloud(true); this.networkHandler = event => { if (event.isConnected && this.data.agreed) this.refreshCloud(true); }; wx.onNetworkStatusChange(this.networkHandler); this.cloudInterval = setInterval(() => { if (this.data.agreed) this.refreshCloud(true); }, 300000); },
  onShow() { if (wx.getStorageSync(PRIVACY_KEY) !== 'agreed') { wx.reLaunch({url:'/pages/consent/consent'}); return; } this.syncTheme(); this.refresh(); if(this.data.tab==='home'){this.restoreTimer();if(getApp().pendingEdit){const log=getApp().pendingEdit;getApp().pendingEdit=null;this.applyEdit(log);}} this.refreshCloud(true); },
  onHide() { clearInterval(this.timerInterval); },
  onUnload() { clearInterval(this.cloudInterval);clearInterval(this.timerInterval); if (wx.offNetworkStatusChange) wx.offNetworkStatusChange(this.networkHandler); if (this.themeHandler && wx.offThemeChange) wx.offThemeChange(this.themeHandler); },
  showPrivacy() { wx.navigateTo({ url:'/pages/privacy/privacy' }); },
  refresh() {
    const state=store.read(); const baby=state.babies.find(b=>b.id===state.activeBabyId)||state.babies[0]||null;
    if (baby && baby.id!==state.activeBabyId) { state.activeBabyId=baby.id; store.write(state); }
    const logs=state.logs.filter(l=>l.babyId===baby?.id).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
    const todayLogs=logs.filter(l=>l.timestamp.slice(0,10)===today());
    const summary={ feeding:todayLogs.filter(l=>l.logType==='feeding').length,sleep:todayLogs.filter(l=>l.logType==='sleep').reduce((a,l)=>a+(Number(l.metadata.durationMinutes)||0),0),diaper:todayLogs.filter(l=>l.logType==='diaper').length };
    const cloudConfig=cloud.config();
    const formatted=logs.map(l=>({...l,typeLabel:LABELS[l.logType],typeInitial:LABELS[l.logType]?.slice(0,1),description:describe(l),displayTime:l.timestamp.slice(11,16)}));
    const stage=baby?(state.guideStages?.[baby.id]||stageForBirthday(baby.birthday)):'1';
    const showBabyForm=!baby||this.data.showBabyForm;
    this.setData({ cloudCode:this.data.cloudCode||cloudConfig.code||'',cloudBirthday:this.data.cloudBirthday||cloudConfig.birthday||baby?.birthday||'',cloudSyncedAt:syncTime(cloudConfig.lastSyncedAt),babies:state.babies.map(b=>({...b,initial:b.name.slice(0,1)})),baby:baby?{...baby,initial:baby.name.slice(0,1),ageText:ageText(baby.birthday)}:null,logs:formatted,todayLogs:formatted.filter(l=>l.timestamp.slice(0,10)===today()).slice(0,3),summary,showBabyForm,showSettings:this.data.showSettings,today:today(),stage,stageIntoView:`stage-${stage}`,activeGuide:guideData.find(x=>x.id===stage)||guideData[0] },()=>this.updateTabVisibility());
    // 各模块独立刷新：任一模块出错不应拖垮整页（否则其余区块会整体渲染不出来）
    const step=(name,fn)=>{ try{ fn(); }catch(err){ console.error(`[refresh] ${name} 失败`,err); } };
    step('updateRecordFilters',()=>this.updateRecordFilters());
    step('updateStats',()=>this.updateStats());
    step('updateVaccines',()=>this.updateVaccines());
    step('updateAllergens',()=>this.updateAllergens());
  },
  setTab(e) { const path={home:'index',records:'records',guide:'guide',vaccine:'vaccine',stats:'stats'}[e.currentTarget.dataset.tab]; if(path) wx.switchTab({url:`/pages/${path}/${path}`}); },
  updateTabVisibility() { if(!this.data.baby||this.data.showBabyForm||this.data.showSettings)wx.hideTabBar();else wx.showTabBar(); },
  openSettings() { this.setData({ showSettings:true },()=>this.updateTabVisibility()); },
  closeSettings() { this.setData({ showSettings:false },()=>this.updateTabVisibility()); },
  onSettingsTouchStart(e) { const touch=e.touches&&e.touches[0];if(touch)this.settingsTouch={x:touch.clientX,y:touch.clientY}; },
  onSettingsTouchEnd(e) { const touch=e.changedTouches&&e.changedTouches[0],start=this.settingsTouch;this.settingsTouch=null;if(!touch||!start)return;const dx=touch.clientX-start.x,dy=touch.clientY-start.y;if(Math.abs(dx)>90&&Math.abs(dx)>Math.abs(dy)*1.4)this.closeSettings(); },
  openBabyForm() { this.setData({showBabyForm:true,showSettings:false,editingBabyId:'',babyName:'',babyInitial:'宝',babyPhoto:'',birthday:''},()=>this.updateTabVisibility()); },
  editBaby(e) { const baby=this.data.babies.find(x=>x.id===e.currentTarget.dataset.id);if(!baby)return;this.setData({showBabyForm:true,showSettings:false,editingBabyId:baby.id,babyName:baby.name,babyInitial:baby.name.slice(0,1),babyPhoto:baby.avatar||'',birthday:baby.birthday},()=>this.updateTabVisibility()); },
  cancelBabyForm() { this.setData({showBabyForm:false,editingBabyId:''});this.refresh(); },
  onBabyName(e) { const babyName=e.detail.value;this.setData({babyName,babyInitial:babyName.trim().slice(0,1)||'宝'}); },
  onBirthday(e) { this.setData({ birthday:e.detail.value }); },
  chooseBabyPhoto() {
    wx.chooseMedia({count:1,mediaType:['image'],sizeType:['compressed'],success:result=>{
      const source=result.tempFiles&&result.tempFiles[0]&&result.tempFiles[0].tempFilePath;if(!source)return;
      const read=filePath=>wx.getFileSystemManager().readFile({filePath,encoding:'base64',success:data=>{
        if(!data.data||data.data.length>900000){wx.showToast({title:'图片过大，请选择较小图片',icon:'none'});return;}
        this.setData({babyPhoto:`data:image/jpeg;base64,${data.data}`});
      },fail:()=>wx.showToast({title:'读取图片失败',icon:'none'})});
      wx.compressImage({src:source,quality:35,success:value=>read(value.tempFilePath),fail:()=>read(source)});
    }});
  },
  saveBaby() {
    const name=this.data.babyName.trim(); if (!name || !this.data.birthday) { wx.showToast({ title:'请填写姓名和生日',icon:'none' }); return; }
    const state=store.read(),editingId=this.data.editingBabyId,baby={id:editingId||store.id('baby'),name,birthday:this.data.birthday,...(this.data.babyPhoto?{avatar:this.data.babyPhoto}:{})};
    if(editingId)state.babies=state.babies.map(x=>x.id===editingId?{...x,name,birthday:this.data.birthday,avatar:this.data.babyPhoto||''}:x);else state.babies.push(baby);
    state.activeBabyId=baby.id;cloud.markMutation(state,'babycare_babies',baby.id);cloud.markMutation(state,'babycare_active_baby_id');store.write(state);
    this.setData({showBabyForm:false,showSettings:false,editingBabyId:'',babyPhoto:''});this.refresh();
  },
  switchBaby(e) { const state=store.read(); state.activeBabyId=e.currentTarget.dataset.id;cloud.markMutation(state,'babycare_active_baby_id');store.write(state); this.refresh(); this.setData({showSettings:false}); wx.showTabBar(); },
  deleteBaby(e) {
    const id=e.currentTarget.dataset.id,target=this.data.babies.find(x=>x.id===id);
    if(!target||this.data.babies.length<=1){wx.showToast({title:'至少保留一位宝宝',icon:'none'});return;}
    wx.showModal({title:'删除宝宝',content:`删除“${target.name}”及其全部记录、疫苗和过敏排查数据？此操作不可恢复。`,success:res=>{
      if(!res.confirm)return;
      const state=store.read();
      state.logs.filter(l=>l.babyId===id).forEach(l=>cloud.markMutation(state,'babycare_logs',l.id,true));
      state.logs=state.logs.filter(l=>l.babyId!==id);
      state.babies=state.babies.filter(b=>b.id!==id);
      cloud.markMutation(state,'babycare_babies',id,true);
      if(state.vaccineStatus)state.vaccineStatus[id]={};
      if(state.vaccineChoices)state.vaccineChoices[id]={};
      if(state.allergens)state.allergens[id]={};
      if(state.guideStages)state.guideStages[id]='1';
      cloud.markMutation(state,`babycare_vaccines_${id}`);
      cloud.markMutation(state,`babycare_vaccine_selections_${id}`);
      cloud.markMutation(state,`babycare_allergens_${id}`);
      cloud.markMutation(state,`babycare_guide_stage_${id}`);
      if(state.activeBabyId===id)state.activeBabyId=state.babies[0]?.id||'';
      store.write(state);
      this.refresh();
      wx.showToast({title:'已删除宝宝',icon:'none'});
    }});
  },
  withdrawConsent() { wx.removeStorageSync(PRIVACY_KEY); wx.reLaunch({url:'/pages/consent/consent'}); },
  setType(e) { this.setData({ type:e.currentTarget.dataset.key }); },
  setFeedingType(e) { this.setData({ feedingType:e.currentTarget.dataset.key }); },
  setFluid(e) { this.setData({ fluidType:e.currentTarget.dataset.key }); },
  onDate(e) { const value=String(e.detail.value||'');if(value)this.setData({date:value}); },
  onTime(e) { const value=String(e.detail.value||'').slice(0,5);if(/^\d{2}:\d{2}$/.test(value))this.setData({time:value}); },
  setNow() { const value=store.localDateTime();this.setData({date:value.slice(0,10),time:value.slice(11)}); },
  onVolume(e) { this.setData({ volume:e.detail.value }); },
  adjustVolume(e) { this.setData({ volume:Math.min(1000,Math.max(0,Number(this.data.volume||0)+Number(e.currentTarget.dataset.delta))) }); },
  setVolume(e) { this.setData({volume:Number(e.currentTarget.dataset.value)}); },
  adjustSide(e) { const name=e.currentTarget.dataset.side==='left'?'leftMinutes':'rightMinutes';this.setData({[name]:Math.max(0,Number(this.data[name]||0)+Number(e.currentTarget.dataset.delta))}); },
  onReaction(e) { this.setData({reactionIndex:Number(e.detail.value)}); },
  onLeft(e) { this.setData({ leftMinutes:e.detail.value }); }, onRight(e) { this.setData({ rightMinutes:e.detail.value }); },
  onFood(e) { this.setData({ foodName:e.detail.value }); }, onFoodAmount(e) { this.setData({ foodAmount:e.detail.value }); },
  onDuration(e) { this.setData({ duration:e.detail.value }); },
  timerKey() { return `xixicare_sleep_timer_${this.data.baby?.id||''}`; },
  restoreTimer() { if(!this.data.baby)return;this.setData({sleepTimer:wx.getStorageSync(this.timerKey())||null});clearInterval(this.timerInterval);this.tickTimer();this.timerInterval=setInterval(()=>this.tickTimer(),1000); },
  tickTimer() { const timer=this.data.sleepTimer;if(!timer){this.setData({timerClock:'00:00:00',timerMinutes:0});return;}const ms=timer.elapsedMs+(timer.runningSince?Math.max(0,Date.now()-timer.runningSince):0);const clock=[Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(pad).join(':');this.setData({timerClock:clock,timerMinutes:Math.floor(ms/60000)}); },
  toggleSleepTimer() { let timer=this.data.sleepTimer;const now=Date.now();if(!timer){timer={startedAt:store.localDateTime().replace(' ','T')+':00',elapsedMs:0,runningSince:now};this.setData({date:timer.startedAt.slice(0,10),time:timer.startedAt.slice(11,16)});}else if(timer.runningSince)timer={...timer,elapsedMs:timer.elapsedMs+Math.max(0,now-timer.runningSince),runningSince:null};else timer={...timer,runningSince:now};wx.setStorageSync(this.timerKey(),timer);this.setData({sleepTimer:timer});this.tickTimer(); },
  cancelSleepTimer() { wx.removeStorageSync(this.timerKey());this.setData({sleepTimer:null});this.tickTimer(); },
  adjustDuration(e) { this.setData({duration:Math.max(5,Number(this.data.duration||0)+Number(e.currentTarget.dataset.delta))}); },
  setDuration(e) { this.setData({duration:Number(e.currentTarget.dataset.value)}); },
  togglePee() { this.setData({ pee:!this.data.pee }); }, togglePoop() { this.setData({ poop:!this.data.poop }); },
  setPoopColor(e) { this.setData({poopColor:e.currentTarget.dataset.key}); },
  setGrowthType(e) { const type=e.currentTarget.dataset.key,field={weight:'weight',height:'height',temp:'temperature'}[type],label={weight:'体重（kg）',height:'身高（cm）',temp:'体温（℃）'}[type];this.setData({growthType:type,growthLabel:label,growthValue:this.data[field]}); },
  onGrowthValue(e) { const field={weight:'weight',height:'height',temp:'temperature'}[this.data.growthType];this.setData({growthValue:e.detail.value,[field]:e.detail.value}); },
  onWeight(e) { this.setData({ weight:e.detail.value }); }, onHeight(e) { this.setData({ height:e.detail.value }); }, onTemperature(e) { this.setData({ temperature:e.detail.value }); },
  saveLog() {
    if (!this.data.baby) { wx.showToast({ title:'请先添加宝宝',icon:'none' }); return; }
    const d=this.data; const timestamp=d.type==='sleep'&&d.sleepTimer&&!d.editingId?d.sleepTimer.startedAt:`${d.date}T${d.time}:00`;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(timestamp) || new Date(timestamp).getTime()>Date.now()+60000) { wx.showToast({title:'请选择有效时间',icon:'none'}); return; }
    let metadata={};
    if (d.type==='feeding') {
      metadata={ feedingType:d.feedingType };
      if (d.feedingType==='bottle') { const n=Number(d.volume); if (!n || n<0) return this.invalid(); metadata.bottle={ volumeMl:n,fluidType:d.fluidType }; }
      if (d.feedingType==='breast') metadata.breast={ leftMinutes:Number(d.leftMinutes)||0,rightMinutes:Number(d.rightMinutes)||0 };
      if (d.feedingType==='solids') { if (!d.foodName.trim()) return this.invalid(); metadata.solids={ foodName:d.foodName.trim(),amount:d.foodAmount,reaction:['none','mild','severe'][d.reactionIndex] }; }
      metadata.startTime=timestamp;
    } else if (d.type==='sleep') { const n=d.sleepTimer&&!d.editingId?d.timerMinutes:Number(d.duration); if (!n || n<5) return this.invalid(); metadata={ startTime:timestamp,durationMinutes:n }; }
    else if (d.type==='diaper') { if (!d.pee && !d.poop) return this.invalid(); metadata={ pee:d.pee,poop:d.poop,...(d.poop?{poopColor:d.poopColor,poopConsistency:'normal'}:{}) }; }
    else { const n=Number(d.growthValue); if (!Number.isFinite(n)||n<=0) return this.invalid();metadata={ [({weight:'weightKg',height:'heightCm',temp:'temperatureC'})[d.growthType]]:n }; }
    const state=store.read();const prior=d.editingId?state.logs.find(l=>l.id===d.editingId):null;
    const log={id:prior?.id||store.id('log'),babyId:d.baby.id,timestamp,logType:d.type,metadata};
    if(prior)state.logs=state.logs.map(l=>l.id===prior.id?log:l);else state.logs.push(log);
    cloud.markMutation(state,'babycare_logs',log.id);store.write(state);
    if(d.type==='sleep'&&d.sleepTimer)this.cancelSleepTimer();
    this.setData({date:today(),time:store.localDateTime().slice(11),editingId:''});this.refresh();wx.showToast({title:prior?'更新成功':'保存成功',icon:'success'});
  },
  invalid() { wx.showToast({ title:'请填写有效内容',icon:'none' }); },
  setRecordFilter(e) { this.setData({recordFilter:e.currentTarget.dataset.key,feedingFilter:'all',bottleFilter:'all'});this.updateRecordFilters(); },
  setFeedingFilter(e) { this.setData({feedingFilter:e.currentTarget.dataset.key,bottleFilter:'all'});this.updateRecordFilters(); },
  setBottleFilter(e) { this.setData({bottleFilter:e.currentTarget.dataset.key});this.updateRecordFilters(); },
  onStartDate(e) { this.setData({startDate:e.detail.value});this.updateRecordFilters(); },
  onEndDate(e) { this.setData({endDate:e.detail.value});this.updateRecordFilters(); },
  clearRecordFilters() { this.setData({startDate:'',endDate:'',recordFilter:'all',feedingFilter:'all',bottleFilter:'all'});this.updateRecordFilters(); },
  updateRecordFilters() {
    const d=this.data;let previous='';const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const yesterdayKey=`${yesterday.getFullYear()}-${pad(yesterday.getMonth()+1)}-${pad(yesterday.getDate())}`;
    const filtered=d.logs.filter(l=>{const day=l.timestamp.slice(0,10),m=l.metadata||{};return (!d.startDate||day>=d.startDate)&&(!d.endDate||day<=d.endDate)&&(d.recordFilter==='all'||l.logType===d.recordFilter)&&(d.feedingFilter==='all'||m.feedingType===d.feedingFilter)&&(d.bottleFilter==='all'||m.bottle?.fluidType===d.bottleFilter);}).map(l=>{const day=l.timestamp.slice(0,10),showDate=day!==previous;previous=day;return {...l,showDate,dateTitle:day===today()?'今天':day===yesterdayKey?'昨天':day};});
    this.setData({filteredLogs:filtered});
  },
  editLog(e) {
    const log=this.data.logs.find(l=>l.id===e.currentTarget.dataset.id);if(!log)return;
    getApp().pendingEdit=log;wx.switchTab({url:'/pages/index/index'});
  },
  applyEdit(log) {
    const m=log.metadata||{},growthType=m.weightKg!=null?'weight':m.heightCm!=null?'height':'temp',value=m.weightKg??m.heightCm??m.temperatureC??'';
    this.setData({editingId:log.id,type:log.logType,typeLabel:LABELS[log.logType],date:log.timestamp.slice(0,10),time:log.timestamp.slice(11,16),feedingType:m.feedingType||'breast',fluidType:m.bottle?.fluidType||'formula',volume:m.bottle?.volumeMl||120,leftMinutes:m.breast?.leftMinutes||10,rightMinutes:m.breast?.rightMinutes||10,foodName:m.solids?.foodName||'',foodAmount:m.solids?.amount||'50g',reactionIndex:Math.max(0,['none','mild','severe'].indexOf(m.solids?.reaction||'none')),duration:m.durationMinutes||30,pee:!!m.pee,poop:!!m.poop,poopColor:m.poopColor||'yellow',growthType,growthLabel:{weight:'体重（kg）',height:'身高（cm）',temp:'体温（℃）'}[growthType],growthValue:String(value),weight:String(m.weightKg||''),height:String(m.heightCm||''),temperature:String(m.temperatureC||'')});
  },
  cancelEdit() { this.setData({editingId:'',date:today(),time:store.localDateTime().slice(11)}); },
  deleteLog(e) {
    const id=e.currentTarget.dataset.id;
    wx.showModal({ title:'删除记录',content:'确定删除这条记录吗？',success:res=>{ if (!res.confirm) return;const state=store.read();state.logs=state.logs.filter(l=>l.id!==id);cloud.markMutation(state,'babycare_logs',id,true);store.write(state);this.refresh(); } });
  },
  setStatRange(e) { this.setData({statRange:Number(e.currentTarget.dataset.days)});this.updateStats(); },
  updateStats() { if(!this.data.baby)return;const result=statistics.build(store.read().logs.filter(l=>l.babyId===this.data.baby.id),this.data.statRange);this.setData({charts:result.charts,statsSummary:result.summary,rangeNote:result.rangeNote}); },
  setStage(e) { const stage=e.currentTarget.dataset.stage,state=store.read(),id=this.data.baby.id;state.guideStages[id]=stage;cloud.markMutation(state,`babycare_guide_stage_${id}`);store.write(state);this.setData({stage,stageIntoView:`stage-${stage}`,activeGuide:guideData.find(x=>x.id===stage)||guideData[0]});this.updateAllergens(); },
  updateAllergens() { const baby=this.data.baby,foods=this.data.activeGuide.solidsGuide?.allergenChecklist||[];const statuses=store.read().allergens[baby?.id]||{};this.setData({allergenRows:foods.map(food=>({food,status:statuses[food]||'untested',label:{untested:'未排查',safe:'安全',allergic:'过敏'}[statuses[food]||'untested']}))}); },
  cycleAllergen(e) { const food=e.currentTarget.dataset.food,state=store.read(),id=this.data.baby.id;state.allergens[id]=state.allergens[id]||{};state.allergens[id][food]={untested:'safe',safe:'allergic',allergic:'untested'}[state.allergens[id][food]||'untested'];cloud.markMutation(state,`babycare_allergens_${id}`);store.write(state);this.updateAllergens(); },
  setVaccineFilter(e) { this.setData({ vaccineFilter:e.currentTarget.dataset.key }); this.updateVaccines(); },
  updateVaccines() {
    const baby=this.data.baby;if(!baby) return;
    const state=store.read();const status=state.vaccineStatus[baby.id]||{};
    const selected=state.vaccineChoices[baby.id]||{};
    // 已接种的疫苗会锁定同品牌/同名称的方案（与原 App lockedChoices 一致）
    const locked=new Map();
    vaccine.schedule.forEach(item=>{if(!status[item.id])return;const c=item.choices.find(x=>x.id===selected[item.id])||item.choices[0];if(c&&!locked.has(c.name))locked.set(c.name,c);});
    // 单元格内容按原 App renderChoiceCell 的规则生成：
    // 只有一个选项且带 label 时，名称 = label + 剂次名；否则直接用剂次名
    const cellOf=(item,kind,choice,isDone)=>{
      const options=item.choices.filter(c=>c.kind===kind);
      if(!options.length)return {empty:true};
      const name=options.length===1&&options[0].label?`${options[0].label}${item.doseLabel}`:item.doseLabel;
      return { empty:false,name,note:item.note||'',
        options:options.map(o=>{
          const lk=locked.get(o.name);
          return { id:o.id,brand:o.brand||'',
            priceLabel:kind==='paid'?`¥${Math.round(Number(o.defaultPrice)||0)}`:'免费',
            active:lk?(!lk.brand||lk.brand===o.brand):(!!choice&&choice.id===o.id),
            locked:isDone||!!lk };
        }) };
    };
    const rows=vaccine.schedule.map(item=>{
      const isDone=!!status[item.id];
      const lockedChoice=item.choices.find(c=>{const p=locked.get(c.name);return p&&(!p.brand||p.brand===c.brand);});
      const storedChoice=item.choices.find(c=>c.id===selected[item.id]);
      const freeChoice=item.choices.find(c=>c.kind==='free');
      // 与原 App 一致：锁定 > 已选 > 免费 > 已完成时取首项
      const choice=lockedChoice||storedChoice||freeChoice||(isDone?item.choices[0]:undefined);
      const due=vaccine.dueDate(baby.birthday,choice?.month??item.month);
      const days=Math.ceil((new Date(`${due}T00:00:00`).getTime()-Date.now())/86400000);
      const price=choice&&choice.kind==='paid'?Number(choice.defaultPrice)||0:0;
      const requiresStatus=!!(choice||freeChoice);
      const level=isDone?'done':days>30?'future':days>=0?'soon':'pending';
      const levelLabel=isDone?'已完成':days>30?'未到月龄':days>=0?'即将接种':'待接种';
      return { id:item.id,month:item.month,ageLabel:item.ageLabel,doseLabel:item.doseLabel,
        due,price,isDone,requiresStatus,level,levelLabel,
        freeCell:cellOf(item,'free',choice,isDone),paidCell:cellOf(item,'paid',choice,isDone) };
    });
    // 按「月龄」分组：一个组 = 表格的一行，组内每个疫苗是一条子行（还原原 App 的表格结构）
    const filter=this.data.vaccineFilter||'all';
    const filtered=filter==='done'?rows.filter(r=>r.isDone)
      :filter==='pending'?rows.filter(r=>!r.isDone&&r.requiresStatus):rows;
    const groups=[],seen=new Map();
    filtered.forEach(row=>{
      const key=`${row.month}:${row.ageLabel}`;
      let g=seen.get(key);
      if(!g){g={key,ageLabel:row.ageLabel,due:row.due,rows:[]};seen.set(key,g);groups.push(g);}
      g.rows.push(row);
    });
    const activeRows=rows.filter(r=>r.requiresStatus||r.isDone);
    this.setData({ vaccineGroups:groups,vaccineRows:filtered,vaccineEmpty:filtered.length===0,
      vaccineDone:activeRows.filter(r=>r.isDone).length,vaccineCount:activeRows.length,
      vaccineTotal:rows.reduce((s,r)=>s+r.price,0),
      vaccineRemaining:rows.reduce((s,r)=>s+(r.isDone?0:r.price),0) });
  },
  findVaccineRow(id) { return (this.data.vaccineRows||[]).find(x=>x.id===id)||null; },
  chooseVaccine(e) {
    const id=e.currentTarget.dataset.id,choiceId=e.currentTarget.dataset.choice,kind=e.currentTarget.dataset.kind;
    const active=e.currentTarget.dataset.active===true||e.currentTarget.dataset.active==='true';
    const locked=e.currentTarget.dataset.locked===true||e.currentTarget.dataset.locked==='true';
    const item=vaccine.schedule.find(x=>x.id===id);if(!item)return;
    const choice=item.choices.find(c=>c.id===choiceId);if(!choice)return;
    const state=store.read(),bid=this.data.baby.id;
    if(state.vaccineStatus[bid]?.[id])return;
    state.vaccineChoices[bid]=state.vaccineChoices[bid]||{};
    const isChosen=state.vaccineChoices[bid][id]===choiceId;
    // 再次点击当前自费方案时，取消所有尚未接种剂次中的同品牌方案。
    // 完成接种形成的品牌锁定继续保留，避免历史记录被误改。
    if(kind==='paid'&&(active||isChosen)&&(!locked||isChosen)){
      for(const row of vaccine.schedule){
        if(state.vaccineStatus[bid]?.[row.id])continue;
        const current=row.choices.find(c=>c.id===state.vaccineChoices[bid][row.id]);
        if(!current||current.name!==choice.name||(choice.brand&&current.brand!==choice.brand))continue;
        const free=row.choices.find(c=>c.kind==='free');
        if(free)state.vaccineChoices[bid][row.id]=free.id;else delete state.vaccineChoices[bid][row.id];
      }
      cloud.markMutation(state,`babycare_vaccine_selections_${bid}`);store.write(state);this.updateVaccines();return;
    }
    for(const row of vaccine.schedule){
      if(state.vaccineStatus[bid]?.[row.id])continue;
      const same=row.choices.find(c=>c.name===choice.name&&(!choice.brand||c.brand===choice.brand));
      if(same)state.vaccineChoices[bid][row.id]=same.id;
    }
    cloud.markMutation(state,`babycare_vaccine_selections_${bid}`);store.write(state);this.updateVaccines();
  },
  toggleVaccine(e) {
    const id=e.currentTarget.dataset.id,row=this.findVaccineRow(id);if(!row)return;
    if(!row.requiresStatus){wx.showToast({title:'请先选择疫苗方案',icon:'none'});return;}
    if(row.level==='future'&&!row.isDone){wx.showToast({title:'尚未到接种月龄',icon:'none'});return;}
    const apply=()=>{const state=store.read(),bid=this.data.baby.id;state.vaccineStatus[bid]=state.vaccineStatus[bid]||{};state.vaccineStatus[bid][id]=!state.vaccineStatus[bid][id];cloud.markMutation(state,`babycare_vaccines_${bid}`);store.write(state);this.updateVaccines();};
    if(row.isDone)wx.showModal({title:'取消接种标记',content:`确定将${row.doseLabel}改为未接种吗？`,success:r=>{if(r.confirm)apply();}});else apply();
  },
  onCloudCode(e) { this.setData({cloudCode:e.detail.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}); },
  onCloudBirthday(e) { this.setData({cloudBirthday:e.detail.value}); },
  toggleAutoSync() {
    const enabled=!this.data.autoSync;
    cloud.setAutoSyncEnabled(enabled);
    this.setData({autoSync:enabled,cloudMessage:enabled?'已开启自动同步，保存记录后会自动上传':'已关闭自动同步，需要手动上传或拉取'});
    if(enabled)this.refreshCloud();
  },
  toggleNightMode(e) {
    const dark=!!e.detail.value;
    getApp().setTheme(dark?'dark':'light');
    this.syncTheme(dark?'dark':'light');
  },
  async uploadCloud() {
    const {code,birthday}=this.data.cloudCode?{code:this.data.cloudCode,birthday:this.data.cloudBirthday}:cloud.config();
    if(!cloud.valid(code,birthday)){wx.showToast({title:'请填写6位存档码和生日',icon:'none'});return;}
    if(this.data.cloudBusy)return;
    cloud.saveConfig({code,birthday});
    this.setData({cloudBusy:true,cloudMessage:'正在上传存档…'});
    try{const result=await cloud.upload();this.setData({cloudMessage:result.message,cloudSyncedAt:result.syncedAt||'',showBabyForm:false});this.refresh();}
    catch(error){this.setData({cloudMessage:error.message||'上传存档失败'});}
    finally{this.setData({cloudBusy:false});}
  },
  async connectCloud() {
    const code=this.data.cloudCode,birthday=this.data.cloudBirthday;
    if(!cloud.valid(code,birthday)){wx.showToast({title:'请填写6位存档码和生日',icon:'none'});return;}
    if(this.data.cloudBusy)return;
    this.setData({cloudBusy:true,cloudMessage:'正在拉取云存档…'});
    try { const result=await cloud.connectExisting(code,birthday);this.setData({cloudMessage:result.message,cloudSyncedAt:result.syncedAt||'',showBabyForm:false});this.refresh(); }
    catch(error){this.setData({cloudMessage:error.message||'连接云存档失败'});}
    finally{this.setData({cloudBusy:false});}
  },
  async refreshCloud(silent=false) {
    if(!this.data.agreed || !cloud.autoSyncEnabled() || !cloud.config().code || this.data.cloudBusy)return;
    this.setData({cloudBusy:true,cloudMessage:silent?'': '正在同步云存档…'});
    try{const result=await cloud.sync();this.setData({cloudMessage:silent?'':result.message,cloudSyncedAt:result.syncedAt||'',showBabyForm:false});this.refresh();}
    catch(error){this.setData({cloudMessage:error.message||'云存档同步失败'});}
    finally{this.setData({cloudBusy:false});}
  },
  showDisclaimer() { wx.showModal({title:'接种提示',content:'接种安排与价格请以当地接种门诊为准。',showCancel:false}); }
}; };
