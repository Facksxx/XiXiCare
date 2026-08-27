import { useMemo, useState } from 'react';
import { Activity, Calendar, CheckCircle2, Clock3, HelpCircle } from 'lucide-react';
import type { BabyInfo } from '../types/baby';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getPlannedVaccineDate, getVaccinePrices, vaccineSchedule, VACCINE_SELECTION_STORAGE_PREFIX } from '../utils/vaccines';

type StatusFilter = 'all' | 'pending' | 'done';
type VaccineStatus = Record<string, boolean>;

const dateStatus = (plannedDate: string, done: boolean) => {
  if (done) return { key: 'done', label: '已完成' } as const;
  const days = Math.ceil((new Date(`${plannedDate}T00:00:00`).getTime() - Date.now()) / 86400000);
  if (days > 30) return { key: 'future', label: '未到月龄' } as const;
  if (days >= 0) return { key: 'soon', label: '即将接种' } as const;
  return { key: 'pending', label: '待接种' } as const;
};

export function VaccineSchedule({ baby }: { baby: BabyInfo }) {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [status, setStatus] = useLocalStorage<VaccineStatus>(`babycare_vaccines_${baby.id}`, {});
  const [selections, setSelections] = useLocalStorage<Record<string, string>>(`${VACCINE_SELECTION_STORAGE_PREFIX}${baby.id}`, {});
  const prices = getVaccinePrices();

  const rows = useMemo(() => vaccineSchedule.map(item => {
    const choice = item.choices.find(option => option.id === selections[item.id]) ?? item.choices[0];
    const done = Boolean(status[`schedule:${item.id}`] || item.legacyNames?.some(name => Object.entries(status).some(([key, value]) => value && key.endsWith(`:${name}`))));
    const plannedDate = getPlannedVaccineDate(baby.birthday, choice.month ?? item.month);
    const price = choice.kind === 'paid' ? prices[choice.priceKey] ?? choice.defaultPrice : 0;
    return { item, choice, done, plannedDate, price, level: dateStatus(plannedDate, done) };
  }), [baby.birthday, prices, selections, status]);

  const selectedRows = rows.filter(row => filter === 'all' || (filter === 'done' ? row.done : !row.done));
  const completed = rows.filter(row => row.done).length;
  const total = rows.reduce((sum, row) => sum + row.price, 0);
  const remaining = rows.reduce((sum, row) => sum + (row.done ? 0 : row.price), 0);

  return (
    <div className="container vaccine-page">
      <section className="vaccine-overview">
        <div><span><Activity size={18} /></span><p>接种进度<strong>{completed}/{rows.length}</strong></p></div>
        <div><span><Activity size={18} /></span><p>方案总价<strong>¥{total.toFixed(2)}</strong></p></div>
        <div><span><Clock3 size={18} /></span><p>待支付<strong>¥{remaining.toFixed(2)}</strong></p></div>
      </section>

      <div className="vaccine-filter" role="tablist" aria-label="疫苗接种状态">
        {([['all', '全部'], ['pending', '待接种'], ['done', '已完成']] as const).map(([key, label]) => (
          <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} key={key}>{label}</button>
        ))}
      </div>

      <section className="vaccine-table" aria-label="儿童疫苗接种程序表">
        <header><span>月龄</span><span>疫苗方案</span><span>状态</span></header>
        {selectedRows.map(({ item, choice, done, plannedDate, level }) => (
          <article className={`vaccine-table-row ${level.key}`} key={item.id}>
            <div className="vaccine-table-age"><strong>{item.ageLabel}</strong><small>{plannedDate}</small></div>
            <div className="vaccine-table-main">
              <h3>{item.doseLabel}</h3>
              <div className="vaccine-kind-labels">
                {item.choices.some(option => option.kind === 'free') && <span className="free">免规免费</span>}
                {item.choices.some(option => option.kind === 'paid') && <span className="paid">自愿自费</span>}
              </div>
              <div className="vaccine-choice-list">
                {item.choices.map(option => {
                  const optionPrice = option.kind === 'paid' ? prices[option.priceKey] ?? option.defaultPrice : 0;
                  return <button type="button" className={choice.id === option.id ? 'active' : ''} onClick={() => setSelections({ ...selections, [item.id]: option.id })} key={option.id}>
                    <b>{option.brand || (option.kind === 'free' ? '免费方案' : option.name)}</b>
                    <small>{option.brand ? option.name : ''}{option.kind === 'paid' ? ` · ¥${optionPrice.toFixed(2)}` : ''}</small>
                  </button>;
                })}
              </div>
              {item.note && <p>{item.note}</p>}
            </div>
            <button type="button" className="vaccine-table-status" aria-label={`${item.doseLabel}${done ? '取消已接种' : '标记已接种'}`} onClick={() => setStatus({ ...status, [`schedule:${item.id}`]: !done })}>
              {done ? <CheckCircle2 size={19} /> : <HelpCircle size={19} />}
              <span>{level.label}</span>
            </button>
          </article>
        ))}
        {selectedRows.length === 0 && <div className="vaccine-table-empty">当前分类暂无接种项目</div>}
      </section>
      <p className="vaccine-page-note"><Calendar size={13} /> 日期按出生日期自动推算，疫苗安排与价格请以当地接种门诊为准。</p>
    </div>
  );
}
