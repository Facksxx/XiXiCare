const KEY = 'xixicare_miniprogram_data_v1';
const EMPTY = () => ({ babies: [], activeBabyId: '', logs: [], vaccineStatus: {}, vaccineChoices: {}, allergens: {}, guideStages:{} });
function read() {
  try {
    const value = wx.getStorageSync(KEY);
    if (!value || typeof value !== 'object') return EMPTY();
    return { ...EMPTY(), ...value, babies: Array.isArray(value.babies) ? value.babies : [], logs: Array.isArray(value.logs) ? value.logs : [] };
  } catch (_) { return EMPTY(); }
}
function write(value, shouldSchedule = true) { wx.setStorageSync(KEY, value); if (shouldSchedule) require('./cloudSync').schedule(); }
function localDateTime(date = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
module.exports = { read, write, localDateTime, id };
