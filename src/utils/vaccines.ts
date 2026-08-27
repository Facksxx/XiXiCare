import { guideData } from '../data/guideData';

export type VaccinePrices = Record<string, number>;

export const VACCINE_PRICE_STORAGE_KEY = 'babycare_vaccine_prices';

export const vaccineNames = Array.from(new Set(
  guideData.flatMap(stage => stage.vaccineGuide?.vaccines.map(vaccine => vaccine.name) ?? [])
));

export const defaultVaccinePrices: VaccinePrices = Object.fromEntries(
  vaccineNames.map(name => [name, name.startsWith('水痘疫苗') ? 180 : name === '流感疫苗' ? 80 : 0])
);

export function getVaccinePrices(): VaccinePrices {
  try {
    const stored = JSON.parse(localStorage.getItem(VACCINE_PRICE_STORAGE_KEY) || '{}') as VaccinePrices;
    return { ...defaultVaccinePrices, ...stored };
  } catch {
    return defaultVaccinePrices;
  }
}

export function getPlannedVaccineDate(birthday: string, monthOffset: number) {
  const parts = birthday.split('-').map(Number);
  if (parts.length !== 3 || parts.some(value => !Number.isFinite(value))) return '';
  const [year, month, day] = parts;
  const firstOfTargetMonth = new Date(year, month - 1 + monthOffset, 1);
  const lastDay = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
  const date = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), Math.min(day, lastDay));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
