const store = require('../../utils/store')
const guides = require('../../data/guides')
const echarts = require('../../ec-canvas/echarts')

const pad = n => String(n).padStart(2, '0')
const dateText = d => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
const isoFromPicker = (date, time) => `${date}T${time}:00`
const daysSince = iso => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
const formatPlayerTime = seconds => `${pad(Math.floor((Number(seconds) || 0) / 60))}:${pad(Math.floor((Number(seconds) || 0) % 60))}`
const SOUND_ROOT = 'https://raw.giteeusercontent.com/Facksxx/xi-xi-care/raw/main/sound-packs'
const SOUND_PACKS = [
  { id: 'ambient', name: '环境声音包', description: '鸟鸣、雨声、海浪、嘘声、溪流与晚风', size: '6 首' },
  { id: 'music', name: '纯音乐包', description: '小星星、摇篮曲与轻柔器乐', size: '6 首' }
]

Page({
  data: {
    tabs: [{ id: 'dashboard', name: '记录大盘', icon: '▣' }, { id: 'timeline', name: '时间轴', icon: '✦' }, { id: 'guide', name: '喂养指南', icon: '▤' }, { id: 'stats', name: '成长统计', icon: '▥' }],
    activeTab: 'dashboard', recordType: 'feeding', feedingType: 'breast', bottleType: 'formula',
    babies: [], baby: {}, logs: [], filteredLogs: [], timelineGroups: [], timelineType: 'all',
    date: '', time: '', nowText: '', left: 10, right: 10, volume: 120, sleepMinutes: 30,
    minutePresets: [3, 5, 8, 10, 15, 20], volumePresets: [60, 90, 120, 150, 180, 210], sleepPresets: [5, 15, 30, 60, 120], reactions: ['无过敏', '轻度反应', '严重反应'],
    timelineOptions: [{ id: 'all', n: '全部' }, { id: 'feeding', n: '喂养' }, { id: 'sleep', n: '睡眠' }, { id: 'diaper', n: '尿布' }, { id: 'growth', n: '体征' }],
    timelineFeedingOptions: [{ id: 'all', n: '全部喂养' }, { id: 'breast', n: '母乳亲喂' }, { id: 'bottle', n: '奶瓶喂养' }, { id: 'solids', n: '辅食' }],
    timelineBottleOptions: [{ id: 'all', n: '全部奶瓶' }, { id: 'formula', n: '配方奶' }, { id: 'breastmilk', n: '母乳' }],
    timelineStartDate: '', timelineEndDate: '', timelineFeedingType: 'all', timelineBottleType: 'all',
    growthOptions: [{ id: 'weight', name: '体重' }, { id: 'height', name: '身高' }, { id: 'temperature', name: '体温' }], ranges: [7, 30, 365],
    pee: true, poop: false, poopColor: 'yellow', poopConsistency: 'normal', growthKind: 'weight', growthValue: '', foodName: '', foodAmount: '50g', reaction: 'none', reactionIndex: 0,
    sleepTimerActive: false, sleepTimerRunning: false, sleepTimerSeconds: 0, sleepTimerClock: '00:00:00', sleepTimerAccumulated: 0, sleepTimerRunningSince: 0,
    showSettings: false, showBabyModal: false, showPlayer: false, showImportMode: false, editingLogId: '',
    statusBarHeight: 24, headerClearHeight: 60,
    editBabyId: '', babyName: '', babyBirthday: '', babyAvatar: '', babyAvatarChanged: false, guideIndex: 0, guide: guides[0], guides,
    vaccines: {}, allergens: {}, range: 7, stats: {}, todaySummary: { milk: 0, sleep: 0, pee: 0, poop: 0 },
    chartEc: { lazyLoad: true, disableTouch: false },
    soundPacks: SOUND_PACKS, soundPackRows: SOUND_PACKS.map(item => Object.assign({}, item, { installed: false, downloading: false, progress: 0 })), installedPacks: {}, packDownloading: {}, packProgress: {},
    sounds: [
      { id: 'forest-birds', category: 'ambient', name: '清晨鸟鸣', icon: '鸟', url: `${SOUND_ROOT}/ambient/forest-birds.mp3` },
      { id: 'gentle-rain', category: 'ambient', name: '轻柔雨声', icon: '雨', url: `${SOUND_ROOT}/ambient/gentle-rain.mp3` },
      { id: 'sea-waves', category: 'ambient', name: '舒缓海浪', icon: '浪', url: `${SOUND_ROOT}/ambient/sea-waves.mp3` },
      { id: 'soothing-shush', category: 'ambient', name: '安抚嘘声', icon: '嘘', url: `${SOUND_ROOT}/ambient/soothing-shush.m4a` },
      { id: 'forest-stream', category: 'ambient', name: '森林溪流', icon: '溪', url: `${SOUND_ROOT}/ambient/forest-stream.mp3` },
      { id: 'gentle-wind', category: 'ambient', name: '轻柔晚风', icon: '风', url: `${SOUND_ROOT}/ambient/gentle-wind.mp3` },
      { id: 'twinkle-star', category: 'music', name: '小星星', icon: '星', url: `${SOUND_ROOT}/music/twinkle-star.ogg` },
      { id: 'baby-lullaby', category: 'music', name: '摇篮轻梦', icon: '月', url: `${SOUND_ROOT}/music/baby-lullaby.mp3` },
      { id: 'close-your-eyes', category: 'music', name: '晚安旋律', icon: '音', url: `${SOUND_ROOT}/music/close-your-eyes.mp3` },
      { id: 'forever-love', category: 'music', name: '暖梦长笛', icon: '笛', url: `${SOUND_ROOT}/music/forever-love.mp3` },
      { id: 'moon-lullaby', category: 'music', name: '月光摇篮', icon: '灯', url: `${SOUND_ROOT}/music/moon-lullaby.mp3` },
      { id: 'christmas-lullaby', category: 'music', name: '冬夜摇篮', icon: '雪', url: `${SOUND_ROOT}/music/christmas-lullaby.mp3` }
    ], visibleSounds: [], soundCategory: 'ambient', playingId: '', playingName: '选择一个声音', playingIcon: '月', isPlaying: false,
    loopMode: 'list', loopModes: [{ id: 'track', name: '单曲循环' }, { id: 'list', name: '列表循环' }, { id: 'once', name: '播放一次' }],
    playerCurrent: 0, playerDuration: 0, playerTime: '00:00', playerDurationText: '00:00', playerProgress: 0, playerVolume: 80,
    playerTimerMinutes: 0, playerTimerOptions: [0, 15, 30, 60], playerTimerText: '睡眠定时',
    downloadProgress: {}, downloading: {}, downloaded: {}, ageDays: 0, dark: false
  },

  onLoad() {
    const now = new Date(); const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null
    const statusBarHeight = windowInfo.statusBarHeight || 24
    const headerClearHeight = menu && menu.bottom ? menu.bottom + 2 : statusBarHeight + 42
    this.audio = wx.getBackgroundAudioManager()
    this.bindAudio()
    this.setData({ date, time, nowText: dateText(now), dark: store.get('xixi_dark', false), statusBarHeight, headerClearHeight })
    this.reload()
  },

  onShow() { if (this.data.babies.length) this.reload() },
  onUnload() { if (this.sleepTicker) clearInterval(this.sleepTicker); if (this.playerTimerTicker) clearInterval(this.playerTimerTicker); this.chartInstances = {} },

  reload() {
    const babies = store.get(store.KEYS.babies, [])
    let active = store.get(store.KEYS.activeBaby, '')
    if (!active && babies[0]) { active = babies[0].id; store.set(store.KEYS.activeBaby, active) }
    const baby = babies.find(item => item.id === active) || babies[0] || {}
    const logs = store.get(store.KEYS.logs, []).filter(item => !baby.id || item.babyId === baby.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    const vaccines = store.get(store.KEYS.vaccines, {})[baby.id] || {}
    const allergens = store.get(store.KEYS.allergens, {})[baby.id] || {}
    const preferences = store.get(store.KEYS.preferences, {})[baby.id] || {}
    const downloaded = store.get('xixi_downloaded_sounds', {})
    const installedPacks = { ambient: this.data.sounds.filter(item => item.category === 'ambient').every(item => downloaded[item.id]), music: this.data.sounds.filter(item => item.category === 'music').every(item => downloaded[item.id]) }
    const visibleSounds = installedPacks[this.data.soundCategory] ? this.data.sounds.filter(item => item.category === this.data.soundCategory) : []
    const soundPackRows = SOUND_PACKS.map(item => Object.assign({}, item, { installed: !!installedPacks[item.id], downloading: !!this.data.packDownloading[item.id], progress: this.data.packProgress[item.id] || 0 }))
    const backgroundTrack = this.data.sounds.find(item => item.id === this.data.playingId || item.name === this.audio.title)
    let playerState = {}
    if (backgroundTrack && installedPacks[backgroundTrack.category]) playerState = { playingId: backgroundTrack.id, playingName: backgroundTrack.name, playingIcon: backgroundTrack.icon, soundCategory: backgroundTrack.category, visibleSounds: this.data.sounds.filter(item => item.category === backgroundTrack.category), isPlaying: !this.audio.paused }
    else if (backgroundTrack || this.data.playingId || ((!installedPacks.ambient && !installedPacks.music) && (this.audio.src || this.audio.title))) { this.audio.stop(); playerState = { playingId: '', playingName: '选择一个声音', playingIcon: '月', isPlaying: false } }
    this.setData(Object.assign({ babies: babies.map(item => Object.assign({}, item, { initial: (item.name || '宝').slice(0, 1) })), baby: Object.assign({}, baby, { initial: (baby.name || '宝').slice(0, 1) }), logs, vaccines, allergens, volume: preferences.volume || 120, feedingType: preferences.feedingType || 'breast', ageDays: baby.birthday ? daysSince(baby.birthday) : 0, downloaded, installedPacks, visibleSounds, soundPackRows }, playerState), () => {
      this.filterTimeline()
      this.computeStats()
    })
    if (!babies.length) this.setData({ showBabyModal: true })
  },

  switchTab(e) { const activeTab = e.currentTarget.dataset.id; if (activeTab === 'stats') this.chartInstances = {}; this.setData({ activeTab, showSettings: false }, () => { if (activeTab === 'stats') setTimeout(() => this.drawCharts(), 120) }) },
  setRecordType(e) { this.setData({ recordType: e.currentTarget.dataset.id }) },
  setFeedingType(e) { const feedingType = e.currentTarget.dataset.id; this.setData({ feedingType }); this.savePreference({ feedingType }) },
  setBottleType(e) { this.setData({ bottleType: e.currentTarget.dataset.id }) },
  setTimelineType(e) { const timelineType = e.currentTarget.dataset.id; this.setData({ timelineType, timelineFeedingType: timelineType === 'feeding' ? this.data.timelineFeedingType : 'all', timelineBottleType: timelineType === 'feeding' ? this.data.timelineBottleType : 'all' }, () => this.filterTimeline()) },
  setTimelineFeedingType(e) { const timelineFeedingType = e.currentTarget.dataset.id; this.setData({ timelineFeedingType, timelineBottleType: timelineFeedingType === 'bottle' ? this.data.timelineBottleType : 'all' }, () => this.filterTimeline()) },
  setTimelineBottleType(e) { this.setData({ timelineBottleType: e.currentTarget.dataset.id }, () => this.filterTimeline()) },
  setTimelineDate(e) { this.setData({ [e.currentTarget.dataset.key]: e.detail.value }, () => this.filterTimeline()) },
  clearTimelineFilters() { this.setData({ timelineStartDate: '', timelineEndDate: '', timelineType: 'all', timelineFeedingType: 'all', timelineBottleType: 'all' }, () => this.filterTimeline()) },
  setGrowthKind(e) { this.setData({ growthKind: e.currentTarget.dataset.id, growthValue: '' }) },
  setRange(e) { this.setData({ range: Number(e.currentTarget.dataset.value) }, () => { this.computeStats(); setTimeout(() => this.drawCharts(), 80) }) },
  onDate(e) { this.setData({ date: e.detail.value }) }, onTime(e) { this.setData({ time: e.detail.value }) },
  setNow() { const now = new Date(); this.setData({ date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: `${pad(now.getHours())}:${pad(now.getMinutes())}` }) },
  onReaction(e) { const reactionIndex = Number(e.detail.value); this.setData({ reactionIndex, reaction: ['none', 'mild', 'severe'][reactionIndex] }) },
  input(e) { this.setData({ [e.currentTarget.dataset.key]: e.detail.value }) },
  step(e) { const key = e.currentTarget.dataset.key; const delta = Number(e.currentTarget.dataset.delta); this.setData({ [key]: Math.max(0, Number(this.data[key]) + delta) }); if (key === 'volume') this.savePreference({ volume: this.data[key] }) },
  preset(e) { const key = e.currentTarget.dataset.key; const value = Number(e.currentTarget.dataset.value); this.setData({ [key]: value }); if (key === 'volume') this.savePreference({ volume: value }) },
  toggle(e) { const key = e.currentTarget.dataset.key; this.setData({ [key]: !this.data[key] }) },
  setOption(e) { this.setData({ [e.currentTarget.dataset.key]: e.currentTarget.dataset.value }) },
  toggleSleepTimer() {
    if (!this.data.sleepTimerActive) return this.startSleepTimer()
    const now = Date.now()
    if (this.data.sleepTimerRunning) {
      const sleepTimerAccumulated = this.data.sleepTimerAccumulated + Math.max(0, now - this.data.sleepTimerRunningSince)
      this.setData({ sleepTimerRunning: false, sleepTimerAccumulated, sleepTimerRunningSince: 0 })
    } else this.setData({ sleepTimerRunning: true, sleepTimerRunningSince: now })
    this.updateSleepTimer()
  },
  startSleepTimer() {
    const now = new Date(); this.setNow()
    this.setData({ sleepTimerActive: true, sleepTimerRunning: true, sleepTimerSeconds: 0, sleepTimerClock: '00:00:00', sleepTimerAccumulated: 0, sleepTimerRunningSince: now.getTime() })
    if (this.sleepTicker) clearInterval(this.sleepTicker)
    this.sleepTicker = setInterval(() => this.updateSleepTimer(), 1000)
  },
  updateSleepTimer() {
    if (!this.data.sleepTimerActive) return
    const elapsed = this.data.sleepTimerAccumulated + (this.data.sleepTimerRunning ? Math.max(0, Date.now() - this.data.sleepTimerRunningSince) : 0)
    const seconds = Math.floor(elapsed / 1000); const h = Math.floor(seconds / 3600); const m = Math.floor(seconds / 60) % 60; const s = seconds % 60
    this.setData({ sleepTimerSeconds: seconds, sleepTimerClock: `${pad(h)}:${pad(m)}:${pad(s)}` })
  },
  cancelSleepTimer() { if (this.sleepTicker) clearInterval(this.sleepTicker); this.sleepTicker = null; this.setData({ sleepTimerActive: false, sleepTimerRunning: false, sleepTimerSeconds: 0, sleepTimerClock: '00:00:00', sleepTimerAccumulated: 0, sleepTimerRunningSince: 0 }) },

  savePreference(next) {
    if (!this.data.baby.id) return
    const all = store.get(store.KEYS.preferences, {}); all[this.data.baby.id] = Object.assign({}, all[this.data.baby.id] || {}, next); store.set(store.KEYS.preferences, all)
  },

  saveRecord() {
    const babyId = this.data.baby.id
    if (!babyId) return this.setData({ showBabyModal: true })
    const timestamp = isoFromPicker(this.data.date, this.data.time); let metadata = {}; let title = ''; const type = this.data.recordType
    if (type === 'feeding') {
      if (this.data.feedingType === 'breast') { metadata = { feedingType: 'breast', leftMinutes: this.data.left, rightMinutes: this.data.right }; title = `母乳亲喂 ${this.data.left + this.data.right}分钟` }
      if (this.data.feedingType === 'bottle') { metadata = { feedingType: 'bottle', volumeMl: this.data.volume, fluidType: this.data.bottleType }; title = `奶瓶喂养 ${this.data.volume}ml` }
      if (this.data.feedingType === 'solids') {
        if (!this.data.foodName.trim()) return wx.showToast({ title: '请填写食物名称', icon: 'none' })
        metadata = { feedingType: 'solids', foodName: this.data.foodName, amount: this.data.foodAmount, reaction: this.data.reaction }; title = `辅食 ${this.data.foodName}`
      }
    } else if (type === 'sleep') { const durationMinutes = this.data.sleepTimerActive ? Math.floor(this.data.sleepTimerSeconds / 60) : this.data.sleepMinutes; if (durationMinutes < 5) return wx.showToast({ title: '少于5分钟不记录', icon: 'none' }); metadata = { durationMinutes }; title = `睡眠 ${durationMinutes}分钟`; if (this.data.sleepTimerActive) this.cancelSleepTimer() }
    else if (type === 'diaper') { if (!this.data.pee && !this.data.poop) return wx.showToast({ title: '请选择尿布状态', icon: 'none' }); metadata = { pee: this.data.pee, poop: this.data.poop, poopColor: this.data.poop ? this.data.poopColor : undefined, poopConsistency: this.data.poop ? this.data.poopConsistency : undefined }; title = [this.data.pee ? '嘘嘘' : '', this.data.poop ? '便便' : ''].filter(Boolean).join(' · ') }
    else { const value = Number(this.data.growthValue); if (!value) return wx.showToast({ title: '请输入有效数值', icon: 'none' }); metadata = { [this.data.growthKind]: value }; title = `${this.growthName(this.data.growthKind)} ${value}${this.growthUnit(this.data.growthKind)}` }
    const logs = store.get(store.KEYS.logs, []); const wasEditing = Boolean(this.data.editingLogId); const record = { id: this.data.editingLogId || store.id('log'), babyId, timestamp, logType: type, title, metadata }
    if (wasEditing) { const index = logs.findIndex(item => item.id === this.data.editingLogId); if (index >= 0) logs[index] = record; else logs.unshift(record) } else logs.unshift(record)
    store.set(store.KEYS.logs, logs)
    this.setData({ foodName: '', foodAmount: '50g', editingLogId: '' }); this.reload(); wx.showToast({ title: wasEditing ? '已更新' : '已保存', icon: 'success' })
  },

  filterTimeline() {
    const { timelineType: type, timelineFeedingType, timelineBottleType, timelineStartDate, timelineEndDate } = this.data
    const filteredLogs = this.data.logs.filter(item => {
      const itemDate = item.timestamp.slice(0, 10)
      if (timelineStartDate && itemDate < timelineStartDate) return false
      if (timelineEndDate && itemDate > timelineEndDate) return false
      if (type !== 'all' && item.logType !== type) return false
      if (type === 'feeding' && timelineFeedingType !== 'all' && item.metadata.feedingType !== timelineFeedingType) return false
      if (type === 'feeding' && timelineFeedingType === 'bottle' && timelineBottleType !== 'all' && item.metadata.fluidType !== timelineBottleType) return false
      return true
    }).map(item => { const date = new Date(item.timestamp); return Object.assign({}, item, { dateKey: item.timestamp.slice(0, 10), displayDate: this.timelineDateTitle(item.timestamp.slice(0, 10)), displayTime: `${pad(date.getHours())}:${pad(date.getMinutes())}`, iconName: this.logIcon(item.logType), interval: item.logType === 'feeding' ? this.feedingInterval(item) : '' }) })
    const timelineGroups = []
    filteredLogs.forEach(item => { let group = timelineGroups.find(entry => entry.dateKey === item.dateKey); if (!group) { group = { dateKey: item.dateKey, title: item.displayDate, logs: [] }; timelineGroups.push(group) } group.logs.push(item) })
    this.setData({ filteredLogs, timelineGroups })
  },
  timelineDateTitle(value) { const today = new Date(); const yesterday = new Date(Date.now() - 86400000); const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; if (value === key(today)) return '今天'; if (value === key(yesterday)) return '昨天'; return value },
  feedingInterval(log) { const feeding = this.data.logs.filter(item => item.logType === 'feeding').sort((a, b) => a.timestamp.localeCompare(b.timestamp)); const index = feeding.findIndex(item => item.id === log.id); if (index < 1) return ''; const mins = Math.round((new Date(feeding[index].timestamp) - new Date(feeding[index - 1].timestamp)) / 60000); if (mins < 30) return ''; return `距上次 ${Math.floor(mins / 60)}小时${mins % 60}分钟` },
  deleteLog(e) { const id = e.currentTarget.dataset.id; wx.showModal({ title: '删除记录', content: '确定删除这条记录吗？', success: res => { if (!res.confirm) return; store.set(store.KEYS.logs, store.get(store.KEYS.logs, []).filter(item => item.id !== id)); this.reload() } }) },
  editLog(e) {
    const log = this.data.logs.find(item => item.id === e.currentTarget.dataset.id); if (!log) return
    const d = new Date(log.timestamp); const m = log.metadata || {}; const next = { editingLogId: log.id, activeTab: 'dashboard', recordType: log.logType, date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
    if (log.logType === 'feeding') Object.assign(next, { feedingType: m.feedingType || 'breast', left: m.leftMinutes || 10, right: m.rightMinutes || 10, volume: m.volumeMl || this.data.volume, bottleType: m.fluidType || 'formula', foodName: m.foodName || '', foodAmount: m.amount || '50g', reaction: m.reaction || 'none', reactionIndex: ['none','mild','severe'].indexOf(m.reaction || 'none') })
    if (log.logType === 'sleep') next.sleepMinutes = m.durationMinutes || 30
    if (log.logType === 'diaper') Object.assign(next, { pee: !!m.pee, poop: !!m.poop, poopColor: m.poopColor || 'yellow', poopConsistency: m.poopConsistency || 'normal' })
    if (log.logType === 'growth') { const kind = ['weight','height','temperature'].find(key => m[key] != null) || 'weight'; Object.assign(next, { growthKind: kind, growthValue: String(m[kind] || '') }) }
    this.setData(next)
  },
  cancelEdit() { this.setData({ editingLogId: '' }) },

  openBaby() { this.setData({ editBabyId: '', babyName: '', babyBirthday: '', babyAvatar: '', babyAvatarChanged: false, showBabyModal: true }) },
  editBaby() { const b = this.data.baby; this.setData({ editBabyId: b.id, babyName: b.name, babyBirthday: b.birthday, babyAvatar: b.avatar || '', babyAvatarChanged: false, showBabyModal: true }) },
  closeBaby() { if (this.data.babies.length) this.setData({ showBabyModal: false }) },
  chooseBabyAvatar() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['compressed'], success: result => {
      const file = result.tempFiles && result.tempFiles[0]
      if (file && file.tempFilePath) this.setData({ babyAvatar: file.tempFilePath, babyAvatarChanged: true })
    } })
  },
  removeBabyAvatar() { this.setData({ babyAvatar: '', babyAvatarChanged: true }) },
  saveBaby() {
    const name = this.data.babyName.trim(), birthday = this.data.babyBirthday
    if (!name || !birthday) return wx.showToast({ title: '请填写完整信息', icon: 'none' })
    const persist = avatar => {
      const babies = store.get(store.KEYS.babies, []); let id = this.data.editBabyId
      if (id) { const index = babies.findIndex(item => item.id === id); if (index < 0) return; babies[index] = Object.assign({}, babies[index], { name, birthday, avatar }) }
      else { id = store.id('baby'); babies.push({ id, name, birthday, avatar }) }
      store.set(store.KEYS.babies, babies); store.set(store.KEYS.activeBaby, id); this.setData({ showBabyModal: false, babyAvatarChanged: false }); this.reload()
    }
    const avatar = this.data.babyAvatar
    if (!this.data.babyAvatarChanged || !avatar || avatar.startsWith('data:') || avatar.startsWith('wxfile://usr')) return persist(avatar)
    wx.getFileSystemManager().readFile({ filePath: avatar, encoding: 'base64', success: file => persist(`data:image/jpeg;base64,${file.data}`), fail: () => wx.showToast({ title: '头像读取失败', icon: 'none' }) })
  },
  switchBaby(e) { store.set(store.KEYS.activeBaby, e.currentTarget.dataset.id); this.reload() },

  selectGuide(e) { const guideIndex = Number(e.detail.value); this.setData({ guideIndex, guide: guides[guideIndex] }) },
  selectGuideTab(e) { const guideIndex = Number(e.currentTarget.dataset.index); this.setData({ guideIndex, guide: guides[guideIndex] }) },
  toggleVaccine(e) { const key = `${this.data.guide.id}:${e.currentTarget.dataset.name}`; const all = store.get(store.KEYS.vaccines, {}); const mine = Object.assign({}, all[this.data.baby.id] || {}); mine[key] = !mine[key]; all[this.data.baby.id] = mine; store.set(store.KEYS.vaccines, all); this.setData({ vaccines: mine }) },
  cycleAllergen(e) { const name = e.currentTarget.dataset.name; const all = store.get(store.KEYS.allergens, {}); const mine = Object.assign({}, all[this.data.baby.id] || {}); mine[name] = mine[name] === 'safe' ? 'allergic' : mine[name] === 'allergic' ? 'untested' : 'safe'; all[this.data.baby.id] = mine; store.set(store.KEYS.allergens, all); this.setData({ allergens: mine }) },

  computeStats() {
    const now = new Date(); now.setHours(23, 59, 59, 999)
    const range = this.data.range
    const start = new Date(now)
    if (range === 7) start.setDate(now.getDate() - 6)
    else if (range === 30) start.setDate(now.getDate() - 29)
    else { start.setFullYear(now.getFullYear() - 1); start.setMonth(now.getMonth() + 1); start.setDate(1) }
    start.setHours(0, 0, 0, 0)
    const buckets = []
    if (range === 7) {
      for (let i = 0; i < 7; i += 1) { const from = new Date(start); from.setDate(start.getDate() + i); const to = new Date(from); to.setHours(23, 59, 59, 999); buckets.push({ from, to, label: `${from.getMonth() + 1}/${from.getDate()}`, days: 1 }) }
    } else if (range === 30) {
      for (let i = 0; i < 5; i += 1) { const from = new Date(start); from.setDate(start.getDate() + i * 7); if (from > now) break; const to = new Date(from); to.setDate(from.getDate() + 6); if (to > now) to.setTime(now.getTime()); buckets.push({ from, to, label: `${from.getMonth() + 1}/${from.getDate()}-${to.getMonth() + 1}/${to.getDate()}`, days: Math.max(1, Math.round((to - from) / 86400000) + 1) }) }
    } else {
      for (let i = 0; i < 12; i += 1) { const from = new Date(start.getFullYear(), start.getMonth() + i, 1); const to = new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999); buckets.push({ from, to, label: `${from.getMonth() + 1}月`, days: to.getDate() }) }
    }
    buckets.forEach(item => Object.assign(item, { milk: 0, sleep: 0, pee: 0, poop: 0, intervals: [], weight: null }))
    const logs = this.data.logs.filter(item => { const time = new Date(item.timestamp); return time >= start && time <= now })
    logs.forEach(item => {
      const time = new Date(item.timestamp); const bucket = buckets.find(part => time >= part.from && time <= part.to); if (!bucket) return
      const m = item.metadata || {}
      if (item.logType === 'feeding' && m.volumeMl) bucket.milk += Number(m.volumeMl)
      if (item.logType === 'sleep') bucket.sleep += Number(m.durationMinutes || 0) / 60
      if (item.logType === 'diaper') { if (m.pee) bucket.pee += 1; if (m.poop) bucket.poop += 1 }
      if (item.logType === 'growth' && m.weight != null) bucket.weight = Number(m.weight)
    })
    const feeding = this.data.logs.filter(item => item.logType === 'feeding').sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    feeding.forEach((item, index) => {
      if (!index) return
      const minutes = (new Date(item.timestamp) - new Date(feeding[index - 1].timestamp)) / 60000
      if (minutes < 30) return
      const time = new Date(item.timestamp); const bucket = buckets.find(part => time >= part.from && time <= part.to)
      if (bucket) bucket.intervals.push(minutes / 60)
    })
    const today = new Date(); const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`; const todaySummary = { milk: 0, sleep: 0, pee: 0, poop: 0 }
    this.data.logs.filter(item => item.timestamp.slice(0, 10) === todayKey).forEach(item => { const m = item.metadata || {}; if (item.logType === 'feeding' && m.volumeMl) todaySummary.milk += m.volumeMl; if (item.logType === 'sleep') todaySummary.sleep += (m.durationMinutes || 0) / 60; if (item.logType === 'diaper') { if (m.pee) todaySummary.pee += 1; if (m.poop) todaySummary.poop += 1 } })
    todaySummary.sleep = Number(todaySummary.sleep.toFixed(1))
    const dailyAverage = range === 7 ? value => value : (value, item) => value / item.days
    this.setData({ todaySummary, stats: {
      labels: buckets.map(item => item.label),
      milk: buckets.map(item => Number(dailyAverage(item.milk, item).toFixed(1))),
      sleep: buckets.map(item => Number(dailyAverage(item.sleep, item).toFixed(1))),
      interval: buckets.map(item => item.intervals.length ? Number((item.intervals.reduce((sum, value) => sum + value, 0) / item.intervals.length).toFixed(1)) : null),
      pee: buckets.map(item => Number(dailyAverage(item.pee, item).toFixed(1))),
      poop: buckets.map(item => Number(dailyAverage(item.poop, item).toFixed(1))),
      weight: buckets.map(item => item.weight)
    } })
  },
  drawCharts() {
    const configs = {
      milk: { kind: 'bar', unit: 'ml', color: '#9b9189', series: [{ name: '瓶喂奶量', data: this.data.stats.milk || [] }] },
      sleep: { kind: 'line', unit: 'h', color: '#7fa691', series: [{ name: '睡眠时长', data: this.data.stats.sleep || [] }] },
      interval: { kind: 'line', unit: 'h', color: '#7fa691', series: [{ name: '喂养间隔', data: this.data.stats.interval || [] }] },
      diaper: { kind: 'bar', unit: '次', color: '#7fa691', series: [{ name: '嘘嘘', data: this.data.stats.pee || [], color: '#7fa691' }, { name: '便便', data: this.data.stats.poop || [], color: '#dfa071' }] },
      weight: { kind: 'line', unit: 'kg', color: '#d9868c', series: [{ name: '体重', data: this.data.stats.weight || [] }] }
    }
    Object.keys(configs).forEach(key => this.initChart(key, configs[key]))
  },
  initChart(key, config) {
    const component = this.selectComponent(`#chart-${key}`); if (!component) return
    this.chartInstances = this.chartInstances || {}
    if (this.chartInstances[key]) { this.chartInstances[key].setOption(this.chartOption(config), true); this.chartInstances[key].resize(); return }
    component.init((canvas, width, height, dpr) => {
      const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr })
      canvas.setChart(chart)
      chart.setOption(this.chartOption(config), true)
      this.chartInstances[key] = chart
      return chart
    })
  },
  chartOption(config) {
    const labels = this.data.stats.labels || []; const dark = this.data.dark; const text = dark ? '#b8b2a9' : '#918a82'; const line = dark ? '#3d3e39' : '#ebe6df'
    const hasData = config.series.some(series => series.data.some(value => value != null && Number.isFinite(Number(value)) && Number(value) !== 0))
    const formatValue = value => Number(value).toFixed(1).replace(/\.0$/, '')
    const axisMax = values => {
      const raw = Number(values.max || 0); if (!raw) return 1
      const padded = raw * 1.18
      const step = raw <= 10 ? 0.5 : raw <= 50 ? 5 : raw <= 200 ? 25 : raw <= 1000 ? 100 : Math.pow(10, Math.floor(Math.log10(raw)))
      return Math.ceil(padded / step) * step
    }
    return {
      animation: true,
      animationDuration: 420,
      animationEasing: 'cubicOut',
      grid: { left: 8, right: 12, top: 42, bottom: 10, containLabel: true },
      tooltip: {
        show: hasData, trigger: 'axis', triggerOn: 'click', confine: true, enterable: false,
        axisPointer: { type: config.kind === 'bar' ? 'shadow' : 'line', lineStyle: { color: config.color, width: 1 }, shadowStyle: { color: dark ? 'rgba(255,255,255,.05)' : 'rgba(127,166,145,.08)' } },
        backgroundColor: dark ? '#2b2c28' : '#fff', borderColor: line, borderWidth: 1, padding: [8, 10],
        textStyle: { color: dark ? '#f5f2ec' : '#292622', fontSize: 12 },
        formatter: params => {
          const rows = (Array.isArray(params) ? params : [params]).filter(item => item.value != null && Number.isFinite(Number(item.value)))
          if (!rows.length) return ''
          return [`${rows[0].axisValue}`, ...rows.map(item => `${item.marker}${item.seriesName}  ${formatValue(item.value)}${config.unit}`)].join('\n')
        }
      },
      xAxis: { show: hasData, type: 'category', data: labels, boundaryGap: config.kind === 'bar', axisLine: { lineStyle: { color: line } }, axisTick: { show: false }, axisLabel: { color: text, fontSize: 10, interval: 'auto', hideOverlap: true, margin: 10 } },
      yAxis: { show: hasData, type: 'value', min: 0, max: axisMax, splitNumber: 3, axisLabel: { color: text, fontSize: 10, formatter: value => `${formatValue(value)}${config.unit}` }, splitLine: { show: hasData, lineStyle: { color: line, type: 'dashed' } } },
      graphic: hasData ? [] : [{ type: 'text', left: 'center', top: 'middle', style: { text: '当前范围暂无数据', fill: text, fontSize: 13 } }],
      series: config.series.map(series => ({
        name: series.name, type: config.kind, data: hasData ? series.data : [], stack: config.series.length > 1 ? 'total' : undefined, connectNulls: false,
        barMaxWidth: 34, showSymbol: config.kind === 'line', symbol: 'circle', symbolSize: 8, smooth: false, clip: true,
        itemStyle: { color: series.color || config.color, borderRadius: config.kind === 'bar' ? [6, 6, 0, 0] : 0, opacity: 1 },
        lineStyle: { color: series.color || config.color, width: 3 },
        label: { show: true, position: 'top', distance: 5, color: dark ? '#f5f2ec' : '#292622', fontSize: 11, fontWeight: 600, formatter: params => params.value == null || Number(params.value) === 0 ? '' : formatValue(params.value) },
        emphasis: { focus: 'series', scale: config.kind === 'line', itemStyle: { opacity: 1, shadowBlur: 5, shadowColor: 'rgba(44,38,32,.16)' } }
      }))
    }
  },

  openSettings() { this.setData({ showSettings: true }) }, closeSettings() { this.setData({ showSettings: false }) }, openPlayer() { this.setData({ showPlayer: true }) }, closePlayer() { this.setData({ showPlayer: false }) },
  toggleTheme() { const dark = !this.data.dark; this.setData({ dark }, () => { if (this.data.activeTab === 'stats') setTimeout(() => this.drawCharts(), 80) }); store.set('xixi_dark', dark) },
  bindAudio() {
    const a = this.audio
    a.onPlay(() => this.setData({ isPlaying: true }))
    a.onPause(() => this.setData({ isPlaying: false }))
    a.onStop(() => this.setData({ isPlaying: false, playerCurrent: 0, playerProgress: 0, playerTime: '00:00' }))
    a.onTimeUpdate(() => { const current = Number(a.currentTime || 0), duration = Number(a.duration || 0); this.setData({ playerCurrent: current, playerDuration: duration, playerTime: formatPlayerTime(current), playerDurationText: formatPlayerTime(duration), playerProgress: duration ? Math.min(100, current / duration * 100) : 0 }) })
    a.onEnded(() => { if (this.data.loopMode === 'track') return this.restartSound(); if (this.data.loopMode === 'list') return this.nextSound(); this.setData({ isPlaying: false }) })
    a.onNext(() => this.nextSound()); a.onPrev(() => this.prevSound())
  },
  setSoundCategory(e) { const soundCategory = e.currentTarget.dataset.id; this.setData({ soundCategory, visibleSounds: this.data.installedPacks[soundCategory] ? this.data.sounds.filter(item => item.category === soundCategory) : [] }) },
  setLoopMode(e) { this.setData({ loopMode: e.currentTarget.dataset.id }) },
  playSound(e) {
    const id = e.currentTarget.dataset.id; const track = this.data.sounds.find(item => item.id === id); if (!track) return
    if (id === this.data.playingId) return this.togglePlayerPlayback()
    this.setData({ playingId: id, playingName: track.name, playingIcon: track.icon, soundCategory: track.category, visibleSounds: this.data.sounds.filter(item => item.category === track.category), playerCurrent: 0, playerProgress: 0, playerTime: '00:00', playerDurationText: '00:00' })
    this.audio.title = track.name; this.audio.epname = 'XIXI CARE 睡眠声音'; this.audio.singer = 'XIXI CARE'; this.audio.coverImgUrl = ''; this.audio.src = this.data.downloaded[id] || track.url
  },
  togglePlayerPlayback() {
    if (!this.data.playingId) { const first = this.data.visibleSounds[0]; if (first) this.playSound({ currentTarget: { dataset: { id: first.id } } }); return }
    if (this.data.isPlaying) this.audio.pause(); else this.audio.play()
  },
  restartSound() { try { this.audio.seek(0); this.audio.play() } catch (_) { const id = this.data.playingId; if (id) this.playSound({ currentTarget: { dataset: { id } } }) } },
  nextSound() { this.shiftSound(1) }, prevSound() { this.shiftSound(-1) },
  shiftSound(delta) {
    const current = this.data.sounds.find(item => item.id === this.data.playingId); const category = current ? current.category : this.data.soundCategory
    const list = this.data.sounds.filter(item => item.category === category); if (!list.length) return
    let index = list.findIndex(item => item.id === this.data.playingId); index = (Math.max(index, 0) + delta + list.length) % list.length
    const track = list[index]; this.setData({ playingId: track.id, playingName: track.name, playingIcon: track.icon, soundCategory: category, visibleSounds: list, playerCurrent: 0, playerProgress: 0, playerTime: '00:00' })
    this.audio.title = track.name; this.audio.epname = 'XIXI CARE 睡眠声音'; this.audio.singer = 'XIXI CARE'; this.audio.src = this.data.downloaded[track.id] || track.url
  },
  seekPlayer(e) { const duration = Number(this.audio.duration || this.data.playerDuration || 0); if (duration) this.audio.seek(duration * Number(e.detail.value) / 100) },
  setPlayerVolume(e) { const playerVolume = Number(e.detail.value); this.audio.volume = playerVolume / 100; this.setData({ playerVolume }) },
  setPlayerTimer(e) {
    const playerTimerMinutes = Number(e.currentTarget.dataset.value)
    if (this.playerTimerTicker) clearInterval(this.playerTimerTicker)
    this.playerTimerEndsAt = playerTimerMinutes ? Date.now() + playerTimerMinutes * 60000 : 0
    this.setData({ playerTimerMinutes, playerTimerText: playerTimerMinutes ? `${playerTimerMinutes}:00 后停止` : '睡眠定时' })
    if (!playerTimerMinutes) return
    this.playerTimerTicker = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((this.playerTimerEndsAt - Date.now()) / 1000))
      this.setData({ playerTimerText: seconds ? `${formatPlayerTime(seconds)} 后停止` : '睡眠定时', playerTimerMinutes: seconds ? playerTimerMinutes : 0 })
      if (!seconds) { clearInterval(this.playerTimerTicker); this.playerTimerTicker = null; this.audio.pause() }
    }, 1000)
  },
  updatePackState(packId, next) {
    const installedPacks = Object.assign({}, this.data.installedPacks); const packDownloading = Object.assign({}, this.data.packDownloading); const packProgress = Object.assign({}, this.data.packProgress)
    if (next.installed != null) installedPacks[packId] = next.installed
    if (next.downloading != null) packDownloading[packId] = next.downloading
    if (next.progress != null) packProgress[packId] = next.progress
    const soundPackRows = SOUND_PACKS.map(item => Object.assign({}, item, { installed: !!installedPacks[item.id], downloading: !!packDownloading[item.id], progress: packProgress[item.id] || 0 }))
    this.setData({ installedPacks, packDownloading, packProgress, soundPackRows })
  },
  downloadSoundPack(e) {
    const packId = e.currentTarget.dataset.id; const tracks = this.data.sounds.filter(item => item.category === packId)
    this.packTasks = this.packTasks || {}; if (!tracks.length || this.packTasks[packId]) return
    const downloaded = Object.assign({}, this.data.downloaded)
    const fs = wx.getFileSystemManager()
    const isSaved = track => { const path = downloaded[track.id]; if (!path) return false; try { fs.accessSync(path); return true } catch (_) { delete downloaded[track.id]; return false } }
    const pending = tracks.filter(track => !isSaved(track)); const completedAtStart = tracks.length - pending.length
    if (!pending.length) { this.updatePackState(packId, { installed: true, downloading: false, progress: 100 }); this.setData({ downloaded, visibleSounds: this.data.soundCategory === packId ? tracks : this.data.visibleSounds }); return }
    const task = { cancelled: false, request: null, retryTimer: null, index: 0, attempt: 0, urlIndex: 0, lastError: '' }; this.packTasks[packId] = task
    this.updatePackState(packId, { downloading: true, progress: Math.round(completedAtStart / tracks.length * 100) })
    const finish = () => { delete this.packTasks[packId]; this.updatePackState(packId, { installed: true, downloading: false, progress: 100 }); this.setData({ downloaded, visibleSounds: this.data.soundCategory === packId ? tracks : this.data.visibleSounds }); store.set('xixi_downloaded_sounds', downloaded); wx.showToast({ title: '声音包已下载' }) }
    const stop = message => { delete this.packTasks[packId]; const completed = completedAtStart + task.index; this.updatePackState(packId, { installed: false, downloading: false, progress: Math.round(completed / tracks.length * 100) }); store.set('xixi_downloaded_sounds', downloaded); if (!task.cancelled) wx.showModal({ title: '声音包下载失败', content: message || task.lastError || '网络中断，请点击下载继续', showCancel: false }) }
    const retry = message => {
      if (task.cancelled) return stop('')
      if (task.attempt >= 2) {
        if (task.urlIndex < 1) { task.urlIndex += 1; task.attempt = 0 }
        else return stop(message || task.lastError || '下载中断，请点击下载继续')
      }
      const delay = task.attempt * 900; task.retryTimer = setTimeout(() => downloadCurrent(), delay)
    }
    const saveTrack = (track, tempFilePath) => fs.saveFile({
      tempFilePath,
      success: saved => { if (task.cancelled) return; downloaded[track.id] = saved.savedFilePath; store.set('xixi_downloaded_sounds', downloaded); task.index += 1; task.attempt = 0; task.urlIndex = 0; task.lastError = ''; this.setData({ downloaded }); this.updatePackState(packId, { progress: Math.round((completedAtStart + task.index) / tracks.length * 100) }); next() },
      fail: error => { task.lastError = String(error.errMsg || '无法保存音频文件'); retry(task.lastError.includes('storage') ? '设备存储空间不足' : task.lastError) }
    })
    const downloadCurrent = () => {
      if (task.cancelled) return stop('')
      const track = pending[task.index]; if (!track) return finish()
      task.attempt += 1
      const fallbackUrl = track.url.replace('https://raw.giteeusercontent.com/Facksxx/xi-xi-care/raw/main', 'https://gitee.com/Facksxx/xi-xi-care/raw/main')
      task.request = wx.downloadFile({
        url: task.urlIndex ? fallbackUrl : track.url,
        timeout: 180000,
        success: result => { if (task.cancelled) return; if (result.statusCode !== 200) { task.lastError = `服务器响应异常（${result.statusCode}）`; return retry(task.lastError) } saveTrack(track, result.tempFilePath) },
        fail: error => { if (!task.cancelled && !String(error.errMsg || '').includes('abort')) { task.lastError = String(error.errMsg || '网络连接中断'); retry(task.lastError) } }
      })
      task.request.onProgressUpdate(progress => { const finished = completedAtStart + task.index; this.updatePackState(packId, { progress: Math.min(99, Math.round((finished + progress.progress / 100) / tracks.length * 100)) }) })
    }
    const next = () => {
      if (task.cancelled) return stop('')
      if (task.index >= pending.length) return finish()
      downloadCurrent()
    }
    next()
  },
  cancelSoundPack(e) { const packId = e.currentTarget.dataset.id; const task = this.packTasks && this.packTasks[packId]; if (!task) return; task.cancelled = true; if (task.retryTimer) clearTimeout(task.retryTimer); if (task.request) task.request.abort(); delete this.packTasks[packId]; this.updatePackState(packId, { downloading: false }) },
  removeSoundPack(e) {
    const packId = e.currentTarget.dataset.id; const tracks = this.data.sounds.filter(item => item.category === packId)
    wx.showModal({ title: '删除声音包', content: `确定删除${packId === 'ambient' ? '环境声音包' : '纯音乐包'}吗？`, success: result => {
      if (!result.confirm) return
      const downloaded = Object.assign({}, this.data.downloaded); const fs = wx.getFileSystemManager()
      tracks.forEach(track => { const path = downloaded[track.id]; if (path) { try { fs.unlinkSync(path) } catch (_) {} delete downloaded[track.id] } })
      if (tracks.some(track => track.id === this.data.playingId)) { this.audio.stop(); this.setData({ playingId: '', playingName: '选择一个声音', playingIcon: '月' }) }
      this.updatePackState(packId, { installed: false, progress: 0 }); this.setData({ downloaded, visibleSounds: this.data.soundCategory === packId ? [] : this.data.visibleSounds }); store.set('xixi_downloaded_sounds', downloaded)
    } })
  },
  downloadSound(e) { const id = e.currentTarget.dataset.id; const track = this.data.sounds.find(item => item.id === id); this.downloadTasks = this.downloadTasks || {}; if (!track || this.downloadTasks[id]) return; this.setData({ [`downloading.${id}`]: true, [`downloadProgress.${id}`]: 0 }); const task = wx.downloadFile({ url: track.url, success: res => { if (res.statusCode !== 200) return wx.showToast({ title: '下载失败', icon: 'none' }); wx.getFileSystemManager().saveFile({ tempFilePath: res.tempFilePath, success: saved => { const downloaded = Object.assign({}, this.data.downloaded, { [id]: saved.savedFilePath }); this.setData({ downloaded }); store.set('xixi_downloaded_sounds', downloaded); wx.showToast({ title: '下载完成' }) }, fail: () => wx.showToast({ title: '保存失败', icon: 'none' }) }) }, fail: err => { if (!String(err.errMsg || '').includes('abort')) wx.showToast({ title: '下载中断', icon: 'none' }) }, complete: () => { delete this.downloadTasks[id]; this.setData({ [`downloading.${id}`]: false, [`downloadProgress.${id}`]: 0 }) } }); this.downloadTasks[id] = task; task.onProgressUpdate(p => this.setData({ [`downloadProgress.${id}`]: p.progress })) },
  cancelSoundDownload(e) { const id = e.currentTarget.dataset.id; if (this.downloadTasks && this.downloadTasks[id]) this.downloadTasks[id].abort() },
  removeSound(e) { const id = e.currentTarget.dataset.id, path = this.data.downloaded[id]; if (!path) return; wx.getFileSystemManager().unlink({ filePath: path, complete: () => { const downloaded = Object.assign({}, this.data.downloaded); delete downloaded[id]; this.setData({ downloaded }); store.set('xixi_downloaded_sounds', downloaded) } }) },

  exportData() {
    const now = new Date(); const exportDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const fileName = `XIXI-CARE备份-${exportDate}.json`; const path = `${wx.env.USER_DATA_PATH}/${fileName}`
    wx.showLoading({ title: '正在生成备份', mask: true })
    wx.getFileSystemManager().writeFile({
      filePath: path, data: JSON.stringify(store.snapshot(), null, 2), encoding: 'utf8',
      success: () => {
        wx.hideLoading()
        const platform = typeof wx.getDeviceInfo === 'function' ? wx.getDeviceInfo().platform : ''
        wx.showModal({ title: '备份已生成', content: platform === 'devtools' ? '开发者工具不支持发送文件，请使用真机预览测试。手机端点击“发送文件”即可选择会话保存备份。' : '备份包含全部宝宝、记录、疫苗、过敏排查及设置。点击发送文件选择保存位置。', confirmText: '发送文件', success: modal => {
          if (!modal.confirm) return
          if (typeof wx.shareFileMessage !== 'function' || platform === 'devtools') return wx.showToast({ title: '请使用真机导出', icon: 'none' })
          wx.shareFileMessage({ filePath: path, fileName, success: () => wx.showToast({ title: '导出成功', icon: 'success' }), fail: error => { if (!String(error.errMsg || '').includes('cancel')) wx.showModal({ title: '无法发送备份', content: '备份文件已经生成，但微信未能打开文件发送面板，请稍后重试。', showCancel: false }) } })
        } })
      },
      fail: error => { wx.hideLoading(); wx.showModal({ title: '导出失败', content: error.errMsg || '无法生成备份文件', showCancel: false }) }
    })
  },
  importData() {
    wx.showModal({ title: '导入全部数据', content: '请选择由 XIXI CARE 导出的 JSON 备份文件。读取后还可以选择合并或覆盖，不会立即修改数据。', confirmText: '选择文件', success: modal => {
      if (!modal.confirm) return
      wx.chooseMessageFile({
        count: 1, type: 'file', extension: ['json'],
        success: result => {
          const selected = result.tempFiles && result.tempFiles[0]
          if (!selected || !selected.path) return wx.showToast({ title: '未读取到文件', icon: 'none' })
          wx.showLoading({ title: '正在读取', mask: true })
          wx.getFileSystemManager().readFile({ filePath: selected.path, encoding: 'utf8', success: file => { wx.hideLoading(); try { this.pendingImport = JSON.parse(file.data); this.setData({ showImportMode: true }) } catch (_) { wx.showToast({ title: '备份文件格式错误', icon: 'none' }) } }, fail: error => { wx.hideLoading(); wx.showModal({ title: '读取失败', content: error.errMsg || '无法读取所选文件', showCancel: false }) } })
        },
        fail: error => { if (!String(error.errMsg || '').includes('cancel')) wx.showModal({ title: '无法选择文件', content: '请在手机微信中选择由本程序导出的 JSON 备份文件。', showCancel: false }) }
      })
    } })
  },
  applyImport(e) { try { store.restore(this.pendingImport, e.currentTarget.dataset.mode); this.setData({ showImportMode: false }); this.reload(); wx.showToast({ title: '导入完成' }) } catch (err) { wx.showToast({ title: err.message, icon: 'none' }) } },
  closeImport() { this.setData({ showImportMode: false }) }, noop() {},

  logIcon(type) { return { feeding: 'milk', sleep: 'moon', diaper: 'droplets', growth: 'scale' }[type] || 'calendar' },
  growthName(kind) { return { weight: '体重', height: '身高', temperature: '体温' }[kind] },
  growthUnit(kind) { return { weight: 'kg', height: 'cm', temperature: '℃' }[kind] }
})
