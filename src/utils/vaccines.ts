export type VaccinePrices = Record<string, number>;

export interface VaccineChoice {
  id: string; priceKey: string; name: string; brand?: string; label?: string; kind: 'free' | 'paid'; defaultPrice: number; month?: number;
}

export interface VaccineScheduleItem {
  id: string; month: number; ageLabel: string; doseLabel: string;
  choices: VaccineChoice[]; note?: string; legacyNames?: string[];
}

const free = (id: string, name: string): VaccineChoice => ({ id, priceKey: id, name, kind: 'free', defaultPrice: 0 });
const paid = (id: string, name: string, price: number, brand?: string, priceKey = id.replace(/-\d+$/, '')): VaccineChoice => ({ id, priceKey, name, brand, kind: 'paid', defaultPrice: price });
const pcv13 = (dose: number): VaccineChoice[] => [
  { ...paid(`pcv13-${dose}-a`, '13价肺炎球菌疫苗', 721, '辉瑞', 'pcv13-a'), month: dose === 3 ? 3.5 : undefined },
  { ...paid(`pcv13-${dose}-b`, '13价肺炎球菌疫苗', 621, '沃森', 'pcv13-b'), month: dose === 3 ? 5.5 : undefined },
  { ...paid(`pcv13-${dose}-c`, '13价肺炎球菌疫苗', 481, '民海', 'pcv13-c'), month: dose === 3 ? 5.5 : undefined }
];

export const vaccineSchedule: VaccineScheduleItem[] = [
  { id: 'birth-hepb1', month: 0, ageLabel: '出生时', doseLabel: '乙肝第1剂', choices: [free('hepb-1-free', '乙肝疫苗')], legacyNames: ['乙肝疫苗 (第1剂)'] },
  { id: 'birth-bcg', month: 0, ageLabel: '出生时', doseLabel: '卡介苗', choices: [free('bcg-free', '卡介苗（BCG）')], legacyNames: ['卡介苗 (BCG)'] },
  { id: 'm1-hepb2', month: 1, ageLabel: '1月龄', doseLabel: '乙肝第2剂', choices: [free('hepb-2-free', '乙肝疫苗')], legacyNames: ['乙肝疫苗 (第2剂)'] },
  { id: 'm1_5-rota1', month: 1.5, ageLabel: '1.5月龄', doseLabel: '五价轮状第1剂', choices: [paid('rota5-1', '五价轮状病毒疫苗', 303)], note: '6-12周龄前完成第1剂' },
  { id: 'm1_5-pcv1', month: 1.5, ageLabel: '1.5月龄', doseLabel: '13价肺炎第1剂', choices: pcv13(1) },
  { id: 'm2-polio1', month: 2, ageLabel: '2月龄', doseLabel: '脊灰第1剂', choices: [free('polio-1-free', '脊灰灭活疫苗')], legacyNames: ['脊灰灭活疫苗 (第1剂)'] },
  { id: 'm2-dtap1', month: 2, ageLabel: '2月龄', doseLabel: '百白破第1剂', choices: [free('dtap-1-free', '百白破疫苗'), paid('pentavalent-1', '进口五联疫苗', 661)], note: '五联包含脊灰、百白破与Hib，可减少针次', legacyNames: ['百白破疫苗 (第1剂)'] },
  { id: 'm2-hib1', month: 2, ageLabel: '2月龄', doseLabel: 'Hib第1剂', choices: [paid('hib-1', 'Hib疫苗', 125)] },
  { id: 'm2_5-rota2', month: 2.5, ageLabel: '2.5月龄', doseLabel: '五价轮状第2剂', choices: [paid('rota5-2', '五价轮状病毒疫苗', 303)] },
  { id: 'm2_5-pcv2', month: 2.5, ageLabel: '2.5月龄', doseLabel: '13价肺炎第2剂', choices: pcv13(2) },
  { id: 'm3-polio2', month: 3, ageLabel: '3月龄', doseLabel: '脊灰第2剂', choices: [free('polio-2-free', '脊灰灭活疫苗')], legacyNames: ['脊灰灭活疫苗 (第2剂)'] },
  { id: 'm3-dtap2', month: 3, ageLabel: '3月龄', doseLabel: '百白破第2剂', choices: [free('dtap-2-free', '百白破疫苗'), paid('pentavalent-2', '进口五联疫苗', 661)], legacyNames: ['百白破疫苗 (第2剂)'] },
  { id: 'm3-mencwy1', month: 3, ageLabel: '3月龄', doseLabel: 'ACWY流脑第1剂', choices: [paid('mencwy-1', 'ACWY135流脑结合疫苗', 443)] },
  { id: 'm3_5-rota3', month: 3.5, ageLabel: '3.5月龄', doseLabel: '五价轮状第3剂', choices: [paid('rota5-3', '五价轮状病毒疫苗', 303)], note: '32周龄前完成第3剂' },
  { id: 'm3_5-pcv3', month: 3.5, ageLabel: '3.5月龄', doseLabel: '13价肺炎第3剂', choices: pcv13(3) },
  { id: 'm4-polio3', month: 4, ageLabel: '4月龄', doseLabel: '脊灰第3剂', choices: [free('polio-3-free', '脊灰灭活疫苗')] },
  { id: 'm4-dtap3', month: 4, ageLabel: '4月龄', doseLabel: '百白破第3剂', choices: [free('dtap-3-free', '百白破疫苗'), paid('pentavalent-3', '进口五联疫苗', 661)], legacyNames: ['百白破疫苗 (第3剂)'] },
  { id: 'm4-hib2', month: 4, ageLabel: '4月龄', doseLabel: 'Hib第2剂', choices: [paid('hib-2', 'Hib疫苗', 125)] },
  { id: 'm4-mencwy2', month: 4, ageLabel: '4月龄', doseLabel: 'ACWY流脑第2剂', choices: [paid('mencwy-2', 'ACWY135流脑结合疫苗', 443)] },
  { id: 'm5-mencwy3', month: 5, ageLabel: '5月龄', doseLabel: 'ACWY流脑第3剂', choices: [paid('mencwy-3', 'ACWY135流脑结合疫苗', 443)] },
  { id: 'm6-hepb3', month: 6, ageLabel: '6月龄', doseLabel: '乙肝第3剂', choices: [free('hepb-3-free', '乙肝疫苗')], legacyNames: ['乙肝疫苗 (第3剂)'] },
  { id: 'm6-dtap3', month: 6, ageLabel: '6月龄', doseLabel: '百白破第3剂', choices: [free('dtap-3b-free', '百白破疫苗')], legacyNames: ['百白破疫苗 (第3剂)'] },
  { id: 'm6-mena1', month: 6, ageLabel: '6月龄', doseLabel: 'A群流脑第1剂', choices: [free('mena-1-free', 'A群流脑疫苗'), paid('mencwy-alt-1', 'ACWY135流脑结合疫苗', 443, undefined, 'mencwy')] },
  { id: 'm6-hib3', month: 6, ageLabel: '6月龄', doseLabel: 'Hib第3剂', choices: [paid('hib-3', 'Hib疫苗', 125)] },
  { id: 'm6_5-ev71-1', month: 6.5, ageLabel: '6.5月龄', doseLabel: 'EV71第1剂', choices: [paid('ev71-1', 'EV71手足口疫苗', 211)] },
  { id: 'm7_5-ev71-2', month: 7.5, ageLabel: '7.5月龄', doseLabel: 'EV71第2剂', choices: [paid('ev71-2', 'EV71手足口疫苗', 211)], note: '与第1剂间隔1个月' },
  { id: 'm8-mmr1', month: 8, ageLabel: '8月龄', doseLabel: '麻腮风第1剂', choices: [free('mmr-1-free', '麻腮风疫苗')], legacyNames: ['麻腮风疫苗 (第1剂)'] },
  { id: 'm8-je1', month: 8, ageLabel: '8月龄', doseLabel: '乙脑第1剂', choices: [free('je-1-free', '乙脑减毒活疫苗')], legacyNames: ['乙脑减毒活疫苗 (第1剂)'] },
  { id: 'm9-mena2', month: 9, ageLabel: '9月龄', doseLabel: 'A群流脑第2剂', choices: [free('mena-2-free', 'A群流脑疫苗'), paid('mencwy-alt-2', 'ACWY135流脑结合疫苗', 443, undefined, 'mencwy')] },
  { id: 'm12-pcv4', month: 12, ageLabel: '12-15月龄', doseLabel: '13价肺炎加强剂', choices: pcv13(4) },
  { id: 'm12-mencwy4', month: 12, ageLabel: '12-15月龄', doseLabel: 'ACWY流脑第4剂', choices: [paid('mencwy-4', 'ACWY135流脑结合疫苗', 443)] },
  { id: 'm15-varicella1', month: 15, ageLabel: '15月龄', doseLabel: '水痘第1剂', choices: [paid('varicella-1', '水痘疫苗', 159)], legacyNames: ['水痘疫苗 (第1剂)'] },
  { id: 'm18-mmr2', month: 18, ageLabel: '18-24月龄', doseLabel: '麻腮风第2剂', choices: [free('mmr-2-free', '麻腮风疫苗')], legacyNames: ['麻腮风疫苗 (第2剂)'] },
  { id: 'm18-hepa1', month: 18, ageLabel: '18-24月龄', doseLabel: '甲肝第1剂', choices: [free('hepa-1-free', '甲肝灭活疫苗')], legacyNames: ['甲肝疫苗 (第1剂)'] },
  { id: 'm18-dtap4', month: 18, ageLabel: '18-24月龄', doseLabel: '百白破第4剂', choices: [free('dtap-4-free', '百白破疫苗'), paid('pentavalent-4', '进口五联疫苗', 661)] },
  { id: 'm18-hib4', month: 18, ageLabel: '18-24月龄', doseLabel: 'Hib第4剂', choices: [paid('hib-4', 'Hib疫苗', 125)] },
  { id: 'm24-hepa2', month: 24, ageLabel: '2周岁', doseLabel: '甲肝第2剂', choices: [free('hepa-2-free', '甲肝灭活疫苗')], legacyNames: ['甲肝疫苗 (第2剂)'] },
  { id: 'm24-je2', month: 24, ageLabel: '2周岁', doseLabel: '乙脑第2剂', choices: [free('je-2-free', '乙脑减毒活疫苗')], legacyNames: ['乙脑减毒活疫苗 (第2剂)'] },
  { id: 'm24-pcv23', month: 24, ageLabel: '2周岁', doseLabel: '23价肺炎', choices: [paid('pcv23', '23价肺炎疫苗', 271)] },
  { id: 'm24-rota', month: 24, ageLabel: '2周岁', doseLabel: '轮状病毒', choices: [paid('rota-oral', '轮状病毒疫苗', 118)] },
  { id: 'm36-menc', month: 36, ageLabel: '3周岁', doseLabel: '流脑A+C第1剂', choices: [free('menac-1-free', '流脑A+C疫苗'), paid('mencwy135-1', '流脑ACWY135多糖疫苗', 159)] },
  { id: 'm36-varicella2', month: 36, ageLabel: '3周岁', doseLabel: '水痘第2剂', choices: [paid('varicella-2', '水痘疫苗', 159)], legacyNames: ['水痘疫苗 (第2剂)'] },
  { id: 'm72-menc', month: 72, ageLabel: '6周岁', doseLabel: '流脑A+C第2剂', choices: [free('menac-2-free', '流脑A+C疫苗'), paid('mencwy135-2', '流脑ACWY135多糖疫苗', 159)] },
  { id: 'm72-dtap', month: 72, ageLabel: '6周岁', doseLabel: '百白破加强剂', choices: [free('dtap-5-free', '百白破疫苗')] },
  { id: 'm156-hpv', month: 156, ageLabel: '13周岁及以上', doseLabel: 'HPV疫苗', choices: [{ ...free('hpv2-free', '2价HPV疫苗'), label: '2价' }, { ...paid('hpv9', '9价HPV疫苗', 1321), label: '9价' }] }
];

export const VACCINE_PRICE_STORAGE_KEY = 'babycare_vaccine_prices_v2';
export const VACCINE_PRICE_UPDATED_AT_KEY = 'babycare_vaccine_prices_updated_at';
export const VACCINE_SELECTION_STORAGE_PREFIX = 'babycare_vaccine_selections_';
export const vaccinePriceOptions = Array.from(new Map(vaccineSchedule.flatMap(item => item.choices).filter(choice => choice.kind === 'paid').map(choice => [choice.priceKey, choice])).values());
export const defaultVaccinePrices: VaccinePrices = Object.fromEntries(vaccinePriceOptions.map(choice => [choice.priceKey, choice.defaultPrice]));

export function getVaccinePrices(): VaccinePrices {
  try { return { ...defaultVaccinePrices, ...JSON.parse(localStorage.getItem(VACCINE_PRICE_STORAGE_KEY) || '{}') }; }
  catch { return defaultVaccinePrices; }
}

export async function updateVaccinePricesFromRemote() {
  const urls = [
    'https://gitee.com/Facksxx/xi-xi-care/raw/main/vaccine-prices.json',
    'https://raw.githubusercontent.com/Facksxx/XiXiCare/main/vaccine-prices.json',
    'https://xixicare-cloud-sync.xixicare-facksxx.workers.dev/public/vaccine-prices.json'
  ];
  let lastError: unknown;
  for (const url of urls) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as { updatedAt?: string; prices?: Record<string, unknown> };
      if (!payload.prices || typeof payload.prices !== 'object') throw new Error('价格表格式错误');
      const prices = Object.fromEntries(Object.entries(payload.prices).filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0).map(([key, value]) => [key, Number(value)]));
      if (Object.keys(prices).length === 0) throw new Error('价格表为空');
      localStorage.setItem(VACCINE_PRICE_STORAGE_KEY, JSON.stringify({ ...defaultVaccinePrices, ...prices }));
      const updatedAt = payload.updatedAt || new Date().toISOString();
      localStorage.setItem(VACCINE_PRICE_UPDATED_AT_KEY, JSON.stringify(updatedAt));
      return updatedAt;
    } catch (error) { lastError = error; }
    finally { window.clearTimeout(timeout); }
  }
  throw lastError instanceof Error ? lastError : new Error('价格表更新失败');
}

export function getPlannedVaccineDate(birthday: string, monthOffset: number) {
  const parts = birthday.split('-').map(Number);
  if (parts.length !== 3 || parts.some(value => !Number.isFinite(value))) return '';
  const [year, month, day] = parts;
  const wholeMonths = Math.floor(monthOffset);
  const extraDays = Math.round((monthOffset - wholeMonths) * 30);
  const target = new Date(year, month - 1 + wholeMonths, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const date = new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay) + extraDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getScheduleForStage(stageId: string) {
  const ranges: Record<string, [number, number]> = { '1': [0, 1], '2': [1, 3], '3': [3, 6], '4': [6, 8], '5': [8, 12], '6': [12, 18], '7': [18, 24], '8': [24, 37] };
  const [start, end] = ranges[stageId] ?? [0, 37];
  return vaccineSchedule.filter(item => item.month >= start && item.month < end);
}
