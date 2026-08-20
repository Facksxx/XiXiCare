const KEYS = {
  babies: 'xixi_babies', activeBaby: 'xixi_active_baby', logs: 'xixi_logs',
  vaccines: 'xixi_vaccines', allergens: 'xixi_allergens', preferences: 'xixi_preferences'
}

const get = (key, fallback) => {
  try { const value = wx.getStorageSync(key); return value === '' || value == null ? fallback : value } catch (_) { return fallback }
}
const set = (key, value) => wx.setStorageSync(key, value)
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function snapshot() {
  return {
    schema: 1, app: 'XIXI CARE', exportedAt: new Date().toISOString(),
    babies: get(KEYS.babies, []), activeBabyId: get(KEYS.activeBaby, ''), logs: get(KEYS.logs, []),
    vaccines: get(KEYS.vaccines, {}), allergens: get(KEYS.allergens, {}), preferences: get(KEYS.preferences, {})
  }
}

function restore(data, mode) {
  if (!data || !Array.isArray(data.babies) || !Array.isArray(data.logs)) throw new Error('备份文件格式不正确')
  if (mode === 'cover') {
    set(KEYS.babies, data.babies); set(KEYS.logs, data.logs); set(KEYS.vaccines, data.vaccines || {})
    set(KEYS.allergens, data.allergens || {}); set(KEYS.preferences, data.preferences || {})
    set(KEYS.activeBaby, data.activeBabyId || (data.babies[0] && data.babies[0].id) || '')
    return
  }
  const babies = get(KEYS.babies, []); const logs = get(KEYS.logs, [])
  const babyMap = new Map(babies.map(item => [item.id, item])); data.babies.forEach(item => babyMap.set(item.id, item))
  const logMap = new Map(logs.map(item => [item.id, item])); data.logs.forEach(item => logMap.set(item.id, item))
  set(KEYS.babies, Array.from(babyMap.values())); set(KEYS.logs, Array.from(logMap.values()).sort((a, b) => b.timestamp.localeCompare(a.timestamp)))
  set(KEYS.vaccines, Object.assign({}, get(KEYS.vaccines, {}), data.vaccines || {}))
  set(KEYS.allergens, Object.assign({}, get(KEYS.allergens, {}), data.allergens || {}))
  set(KEYS.preferences, Object.assign({}, get(KEYS.preferences, {}), data.preferences || {}))
}

module.exports = { KEYS, get, set, id, snapshot, restore }
