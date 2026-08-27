import { useMemo, useState } from 'react';
import { Activity, Calendar, CheckCircle2, Clock3, HelpCircle } from 'lucide-react';
import type { BabyInfo } from '../types/baby';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getPlannedVaccineDate, getVaccinePrices, vaccineSchedule, VACCINE_SELECTION_STORAGE_PREFIX } from '../utils/vaccines';
import { ConfirmModal } from './ConfirmModal';

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
  const [resetItemId, setResetItemId] = useState<string | null>(null);
  const [status, setStatus] = useLocalStorage<VaccineStatus>(`babycare_vaccines_${baby.id}`, {});
  const [selections, setSelections] = useLocalStorage<Record<string, string>>(`${VACCINE_SELECTION_STORAGE_PREFIX}${baby.id}`, {});
  const prices = getVaccinePrices();

  const completedItems = useMemo(() => new Map(vaccineSchedule.map(item => {
    const statusKey = `schedule:${item.id}`;
    const hasCurrentStatus = Object.prototype.hasOwnProperty.call(status, statusKey);
    const legacyDone = item.legacyNames?.some(name => Object.entries(status).some(([key, value]) => value && key.endsWith(`:${name}`))) ?? false;
    return [item.id, hasCurrentStatus ? Boolean(status[statusKey]) : legacyDone] as const;
  })), [status]);
  const lockedChoices = useMemo(() => {
    const result = new Map<string, (typeof vaccineSchedule)[number]['choices'][number]>();
    vaccineSchedule.forEach(item => {
      if (!completedItems.get(item.id)) return;
      const choice = item.choices.find(option => option.id === selections[item.id]) ?? item.choices[0];
      if (choice && !result.has(choice.name)) result.set(choice.name, choice);
    });
    return result;
  }, [completedItems, selections]);
  const rows = useMemo(() => vaccineSchedule.map(item => {
    const done = Boolean(completedItems.get(item.id));
    const storedChoice = item.choices.find(option => option.id === selections[item.id]);
    const freeChoice = item.choices.find(option => option.kind === 'free');
    const lockedChoice = item.choices.find(option => {
      const locked = lockedChoices.get(option.name);
      return locked && (!locked.brand || option.brand === locked.brand);
    });
    const choice = lockedChoice ?? storedChoice ?? freeChoice ?? (done ? item.choices[0] : undefined);
    const plannedDate = getPlannedVaccineDate(baby.birthday, choice?.month ?? item.month);
    const price = choice?.kind === 'paid' ? prices[choice.priceKey] ?? choice.defaultPrice : 0;
    const requiresStatus = Boolean(choice || freeChoice);
    return { item, choice, done, plannedDate, price, requiresStatus, level: dateStatus(plannedDate, done) };
  }), [baby.birthday, completedItems, lockedChoices, prices, selections]);

  const selectedRows = rows.filter(row => filter === 'all' || (filter === 'done' ? row.done : !row.done && row.requiresStatus));
  const groupedRows = useMemo(() => Array.from(selectedRows.reduce((groups, row) => {
    const key = `${row.item.month}:${row.item.ageLabel}`;
    const group = groups.get(key) ?? { key, ageLabel: row.item.ageLabel, plannedDate: row.plannedDate, rows: [] as typeof rows };
    group.rows.push(row);
    groups.set(key, group);
    return groups;
  }, new Map<string, { key: string; ageLabel: string; plannedDate: string; rows: typeof rows }>()).values()), [selectedRows]);
  const activeRows = rows.filter(row => row.requiresStatus || row.done);
  const completed = activeRows.filter(row => row.done).length;
  const total = rows.reduce((sum, row) => sum + row.price, 0);
  const remaining = rows.reduce((sum, row) => sum + (row.done ? 0 : row.price), 0);

  const toggleStatus = (itemId: string, done: boolean, isFuture: boolean) => {
    if (done) return setResetItemId(itemId);
    if (isFuture) return;
    setStatus({ ...status, [`schedule:${itemId}`]: true });
  };

  const selectChoice = (row: typeof rows[number], optionId: string, kind: 'free' | 'paid') => {
    const next = { ...selections };
    const selectedOption = row.item.choices.find(option => option.id === optionId);
    if (row.done || (selectedOption && lockedChoices.has(selectedOption.name))) return;
    const sameVaccineChoices = selectedOption
      ? rows.flatMap(candidate => {
          if (candidate.done) return [];
          const match = candidate.item.choices.find(option => option.name === selectedOption.name && (!selectedOption.brand || option.brand === selectedOption.brand));
          return match ? [{ itemId: candidate.item.id, choiceId: match.id }] : [];
        })
      : [];
    const hasUnsyncedDose = sameVaccineChoices.some(candidate => selections[candidate.itemId] !== candidate.choiceId);

    if (kind === 'paid' && row.choice?.id === optionId && !hasUnsyncedDose) {
      const freeChoice = row.item.choices.find(option => option.kind === 'free');
      if (freeChoice) next[row.item.id] = freeChoice.id;
      else {
        next[row.item.id] = '';
      }
    } else {
      next[row.item.id] = optionId;
      sameVaccineChoices.forEach(candidate => { next[candidate.itemId] = candidate.choiceId; });
    }
    setSelections(next);
  };

  const renderChoiceCell = (row: typeof rows[number], kind: 'free' | 'paid') => {
    const options = row.item.choices.filter(option => option.kind === kind);
    if (options.length === 0) return <span className="vaccine-cell-empty">—</span>;
    return <div className="vaccine-cell-content">
      <strong>{row.item.doseLabel}</strong>
      <div className="vaccine-brand-options">
        {options.map(option => {
          const optionPrice = kind === 'paid' ? prices[option.priceKey] ?? option.defaultPrice : 0;
          const lockedChoice = lockedChoices.get(option.name);
          const isLocked = row.done || Boolean(lockedChoice);
          const isActive = lockedChoice ? (!lockedChoice.brand || option.brand === lockedChoice.brand) : row.choice?.id === option.id;
          return <button type="button" disabled={isLocked} aria-label={`${option.brand || option.name}${isLocked ? '，方案已锁定' : ''}`} aria-pressed={isActive} className={isActive ? 'active' : ''} onClick={() => selectChoice(row, option.id, kind)} key={option.id}>
            {option.label && <b>{option.label}</b>}
            {option.brand && <b>{option.brand}</b>}
            <span>{option.brand ? `¥${optionPrice.toFixed(0)}` : (kind === 'free' ? '免费' : `¥${optionPrice.toFixed(0)}`)}</span>
          </button>;
        })}
      </div>
      {row.item.note && <small>{row.item.note}</small>}
    </div>;
  };

  return (
    <>
      <div className="container vaccine-page">
        <div className="vaccine-sticky">
          <section className="vaccine-overview">
            <div><span><Activity size={18} /></span><p>接种进度<strong>{completed}/{activeRows.length}</strong></p></div>
            <div><span><Activity size={18} /></span><p>方案总价<strong>¥{total.toFixed(2)}</strong></p></div>
            <div><span><Clock3 size={18} /></span><p>待支付<strong>¥{remaining.toFixed(2)}</strong></p></div>
          </section>

          <div className="vaccine-filter" role="tablist" aria-label="疫苗接种状态">
            {([['all', '全部'], ['pending', '待接种'], ['done', '已完成']] as const).map(([key, label]) => (
              <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} key={key}>{label}</button>
            ))}
          </div>
          <p className="vaccine-clinic-time"><Clock3 size={13} />接种时间:每周二至周六上午(夏令7:30-11:00;冬令8:00-11:00)</p>
        </div>

        <section className="vaccine-table" aria-label="儿童疫苗接种程序表">
          <header><span>月龄</span><span>免规疫苗（免费）</span><span>非免规疫苗（自费）</span><span>状态</span></header>
          {groupedRows.map(group => (
            <article className="vaccine-age-row" key={group.key}>
              <div className="vaccine-table-age"><strong>{group.ageLabel}</strong><small><span className="vaccine-date-full">{group.plannedDate}</span><span className="vaccine-date-month">{group.plannedDate.slice(0, 7)}</span></small></div>
              <div className="vaccine-age-items">
                {group.rows.map(row => <div className={`vaccine-vial-row ${row.level.key}`} key={row.item.id}>
                  <div className="vaccine-free-cell">{renderChoiceCell(row, 'free')}</div>
                  <div className="vaccine-paid-cell">{renderChoiceCell(row, 'paid')}</div>
                  <button type="button" disabled={!row.requiresStatus || (!row.done && row.level.key === 'future')} className={`vaccine-table-status${!row.requiresStatus ? ' unselected' : ''}`} aria-label={`${row.item.doseLabel}${!row.requiresStatus ? '未选择自费方案' : row.done ? '取消已接种' : row.level.key === 'future' ? '未到月龄不可标记' : '标记已接种'}`} onClick={() => toggleStatus(row.item.id, row.done, row.level.key === 'future')}>
                    {row.requiresStatus && (row.done ? <CheckCircle2 size={18} /> : <HelpCircle size={18} />)}
                    <span>{row.requiresStatus ? row.level.label : '未选择'}</span>
                  </button>
                </div>)}
              </div>
            </article>
          ))}
          {selectedRows.length === 0 && <div className="vaccine-table-empty">当前分类暂无接种项目</div>}
        </section>
        <p className="vaccine-page-note"><Calendar size={13} /> 日期按出生日期自动推算，疫苗安排与价格请以当地接种门诊为准。</p>
      </div>
      <ConfirmModal compact isOpen={Boolean(resetItemId)} title="取消接种标记" message="确定切换为未接种吗？" type="warning" confirmText="确认切换" onCancel={() => setResetItemId(null)} onConfirm={() => {
        if (resetItemId) setStatus({ ...status, [`schedule:${resetItemId}`]: false });
        setResetItemId(null);
      }} />
    </>
  );
}
