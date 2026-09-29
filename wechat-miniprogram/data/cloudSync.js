const store = require('./store');
const crypto = require('./crypto');
const API = 'https://env-00jy6pn3o40f.dev-hz.cloudbasefunction.cn/xixi-sync';
const CONFIG_KEY = 'xixicare_miniprogram_cloud_v1';
const AUTO_KEY = 'xixicare_miniprogram_cloud_auto_v1';
const META_KEY = 'babycare_sync_meta';
let running = null, timer = null;
const blankMeta = () => ({ keys:{},records:{},tombstones:{} });
const parse = (value, fallback) => { try { return JSON.parse(value); } catch (_) { return fallback; } };
const config = () => wx.getStorageSync(CONFIG_KEY) || {};
const saveConfig = value => wx.setStorageSync(CONFIG_KEY, { ...config(), ...value });
const valid = (code, birthday) => /^[A-Z0-9]{6}$/.test(code) && /^\d{4}-\d{2}-\d{2}$/.test(birthday) && !Number.isNaN(new Date(`${birthday}T00:00:00`).getTime());
const archiveId = (code, birthday) => `${code}-${birthday.replace(/-/g,'')}`;
function request(path, method='GET', data) {
  return new Promise((resolve,reject) => wx.request({
    url:API+path,method,data,header:{'Content-Type':'application/json'},timeout:20000,
    success:res=>resolve(res),fail:err=>reject(new Error(err.errMsg||'云存档网络请求失败'))
  }));
}
async function ping() { const response=await request('/health');if(response.statusCode!==200||!response.data?.ok)throw new Error(`云存档服务异常（${response.statusCode}）`);return true; }
async function connectExisting(code, birthday) {
  if (!valid(code, birthday)) throw new Error('请填写6位存档码和正确的验证生日');
  if (running) await running.catch(()=>{});
  const id=archiveId(code,birthday);
  const response=await request(`/archive/${id}/meta`);
  if(response.statusCode===404) throw new Error('未找到该云存档，请核对存档码和验证生日');
  if(response.statusCode!==200) throw new Error(`校验云存档失败（${response.statusCode}）`);
  const archive=await request(`/archive/${id}`);
  if(archive.statusCode!==200) throw new Error(`读取云存档失败（${archive.statusCode}）`);
  let snapshot;
  try { snapshot=await crypto.decrypt(archive.data,code,birthday); }
  catch (_) { throw new Error('云存档解密失败，请核对存档码和验证生日'); }
  const incoming=stateFromValues(snapshot.values,store.read());
  if(!incoming.babies.length) throw new Error('云存档中没有宝宝资料，请确认存档中已有宝宝资料');
  // A deliberate restore must not merge this device's draft data into another archive.
  // Keep a local copy so existing unsynced records can still be recovered if needed.
  const local=store.read();
  if(local.babies.length||local.logs.length) wx.setStorageSync('xixicare_before_cloud_restore_v1',local);
  store.write(incoming,false);
  saveConfig({code,birthday});
  const time=new Date().toISOString();saveConfig({lastSyncedAt:time});
  return {message:`已拉取 ${incoming.babies.length} 位宝宝、${incoming.logs.length} 条记录`,syncedAt:time};
}
function metadata(local) { return local.syncMeta && typeof local.syncMeta==='object' ? local.syncMeta : blankMeta(); }
function markMutation(state, key, id, deleted=false) {
  state.syncMeta=metadata(state);
  const meta=state.syncMeta, now=new Date().toISOString();
  meta.keys[key]=now;
  if (id) {
    meta.records[key]=meta.records[key]||{};meta.tombstones[key]=meta.tombstones[key]||{};
    if(deleted){meta.tombstones[key][id]=now;delete meta.records[key][id];}
    else {meta.records[key][id]=now;delete meta.tombstones[key][id];}
  }
}
function valuesFromState(state) {
  const values={babycare_babies:JSON.stringify(state.babies),babycare_logs:JSON.stringify(state.logs),babycare_active_baby_id:JSON.stringify(state.activeBabyId||''),[META_KEY]:JSON.stringify(metadata(state))};
  for(const [babyId,status] of Object.entries(state.vaccineStatus||{})) values[`babycare_vaccines_${babyId}`]=JSON.stringify(Object.fromEntries(Object.entries(status).map(([key,value])=>[`schedule:${key}`,value])));
  for(const [babyId,choices] of Object.entries(state.vaccineChoices||{})) values[`babycare_vaccine_selections_${babyId}`]=JSON.stringify(choices);
  for(const [babyId,allergens] of Object.entries(state.allergens||{})) values[`babycare_allergens_${babyId}`]=JSON.stringify(allergens);
  for(const [babyId,stage] of Object.entries(state.guideStages||{})) values[`babycare_guide_stage_${babyId}`]=JSON.stringify(stage);
  return values;
}
function stateFromValues(values, old) {
  const babies=parse(values.babycare_babies,'[]'), logs=parse(values.babycare_logs,'[]');
  const state={...old,babies:Array.isArray(babies)?babies:[],logs:Array.isArray(logs)?logs:[],activeBabyId:parse(values.babycare_active_baby_id,'')||'',vaccineStatus:{},vaccineChoices:{},allergens:{},guideStages:{},syncMeta:parse(values[META_KEY],'{}')};
  for(const [key,value] of Object.entries(values)) {
    if(key.startsWith('babycare_vaccines_')) state.vaccineStatus[key.slice(18)]=Object.fromEntries(Object.entries(parse(value,'{}')).filter(([k])=>k.startsWith('schedule:')).map(([k,v])=>[k.slice(9),!!v]));
    if(key.startsWith('babycare_vaccine_selections_')) state.vaccineChoices[key.slice(28)]=parse(value,'{}');
    if(key.startsWith('babycare_allergens_')) state.allergens[key.slice(19)]=parse(value,'{}');
    if(key.startsWith('babycare_guide_stage_')) state.guideStages[key.slice(21)]=parse(value,'1');
  }
  if(!state.babies.some(b=>b.id===state.activeBabyId))state.activeBabyId=state.babies[0]?.id||'';
  return state;
}
function mergeMeta(a,b) {
  const out=blankMeta();
  for(const src of [a||{},b||{}]) for(const bucket of ['keys','records','tombstones']) {
    for(const [key,value] of Object.entries(src[bucket]||{})) {
      if(bucket==='keys'){if(value>(out.keys[key]||''))out.keys[key]=value;}
      else {out[bucket][key]=out[bucket][key]||{};for(const [id,time] of Object.entries(value||{}))if(time>(out[bucket][key][id]||''))out[bucket][key][id]=time;}
    }
  }
  return out;
}
function mergeArray(key,remote,local,remoteMeta,localMeta) {
  const r=parse(remote,'[]'),l=parse(local,'[]');if(!Array.isArray(r)||!Array.isArray(l))return local;
  const rm=new Map(r.map(x=>[x.id,x])),lm=new Map(l.map(x=>[x.id,x]));
  const ids=new Set([...rm.keys(),...lm.keys(),...Object.keys(remoteMeta.tombstones?.[key]||{}),...Object.keys(localMeta.tombstones?.[key]||{})]);
  const result=[];
  for(const id of ids) {
    const rd=remoteMeta.tombstones?.[key]?.[id]||'',ld=localMeta.tombstones?.[key]?.[id]||'';
    const re=remoteMeta.records?.[key]?.[id]||remoteMeta.keys?.[key]||'',le=localMeta.records?.[key]?.[id]||localMeta.keys?.[key]||'';
    if((rd>ld?rd:ld)>=(re>le?re:le) && (rd||ld))continue;
    const item=le>re?lm.get(id):(rm.get(id)||lm.get(id));if(item)result.push(item);
  }
  return JSON.stringify(result);
}
function mergeValues(remote,local) {
  const rm=parse(remote[META_KEY],'{}'),lm=parse(local[META_KEY],'{}');
  const values={...remote,...local};
  if(remote.babycare_active_baby_id && (!local.babycare_active_baby_id || local.babycare_active_baby_id==='""')) values.babycare_active_baby_id=remote.babycare_active_baby_id;
  for(const key of ['babycare_babies','babycare_logs'])if(remote[key]&&local[key])values[key]=mergeArray(key,remote[key],local[key],rm,lm);
  for(const key of Object.keys(local)) {
    if(!remote[key]||!/^babycare_(vaccines|vaccine_selections|allergens)_/.test(key))continue;
    const old=parse(remote[key],'{}'),newer=parse(local[key],'{}');
    values[key]=JSON.stringify((lm.keys?.[key]||'')>(rm.keys?.[key]||'')?{...old,...newer}:{...newer,...old});
  }
  for(const key of Object.keys(local))if(key.startsWith('babycare_guide_stage_')&&remote[key]&&(rm.keys?.[key]||'')>(lm.keys?.[key]||''))values[key]=remote[key];
  values[META_KEY]=JSON.stringify(mergeMeta(rm,lm));
  return values;
}
function equalValues(a,b){const keys=new Set([...Object.keys(a),...Object.keys(b)]);for(const k of keys){if(k===META_KEY)continue;if(a[k]===b[k])continue;const x=parse(a[k],null),y=parse(b[k],null);if(JSON.stringify(x)!==JSON.stringify(y))return false;}return true;}
async function run(allowCreate=false) {
  const {code,birthday}=config();if(!valid(code||'',birthday||''))return {message:'请先填写存档码和验证生日'};
  const id=archiveId(code,birthday),localState=store.read(),localValues=valuesFromState(localState);
  let metaResponse=await request(`/archive/${id}/meta`);
  if(metaResponse.statusCode===404&&!allowCreate)throw new Error('未找到该云存档，请核对存档码和验证生日');
  if(metaResponse.statusCode!==200&&!(allowCreate&&metaResponse.statusCode===404))throw new Error(`校验云存档失败（${metaResponse.statusCode}）`);
  let meta=metaResponse.statusCode===404?null:metaResponse.data;
  for(let attempt=0;attempt<3;attempt++) {
    let remoteValues={};
    if(meta){const response=await request(`/archive/${id}`);if(response.statusCode!==200)throw new Error(`读取云存档失败（${response.statusCode}）`);remoteValues=(await crypto.decrypt(response.data,code,birthday)).values;}
    const merged=mergeValues(remoteValues,localValues);
    if(!meta||!equalValues(remoteValues,merged)) {
      const envelope=await crypto.encrypt(merged,code,birthday);envelope.baseRevision=meta?.revision||0;
      const result=await request(`/archive/${id}`,'PUT',envelope);
      if(result.statusCode===409){const latest=await request(`/archive/${id}/meta`);meta=latest.data;continue;}
      if(result.statusCode<200||result.statusCode>=300)throw new Error(`上传云存档失败（${result.statusCode}）`);
    }
    store.write(stateFromValues(merged,localState),false);
    const time=new Date().toISOString();saveConfig({lastSyncedAt:time});
    return {message:'云存档已同步',syncedAt:time};
  }
  throw new Error('云存档持续冲突，请稍后重试');
}
/** 自动同步总开关：关闭后除手动「上传/拉取存档」外不再自动联网同步。 */
const autoSyncEnabled = () => wx.getStorageSync(AUTO_KEY) !== false;
const setAutoSyncEnabled = value => wx.setStorageSync(AUTO_KEY, !!value);
async function upload() { const result = await run(true); return { ...result, message:'存档已上传到云端' }; }
function sync(){if(!running)running=run().finally(()=>{running=null;});return running;}
function schedule(delay=1500){clearTimeout(timer);timer=setTimeout(()=>{sync().catch(()=>{});},delay);}
module.exports={config,saveConfig,valid,sync,upload,connectExisting,ping,schedule,markMutation,autoSyncEnabled,setAutoSyncEnabled,valuesFromState,stateFromValues,mergeValues};
