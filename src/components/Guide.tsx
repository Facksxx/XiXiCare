import { useState, useRef, useCallback } from 'react';
import { guideData } from '../data/guideData';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { BabyInfo } from '../types/baby';
import { getPlannedVaccineDate, getScheduleForStage, getVaccinePrices, vaccineSchedule, VACCINE_SELECTION_STORAGE_PREFIX } from '../utils/vaccines';
import { Utensils, Award, CheckCircle2, AlertTriangle, HelpCircle, Sparkles, Calendar, Activity } from 'lucide-react';

interface AllergenStatus {
  [key: string]: 'untested' | 'safe' | 'allergic';
}

interface VaccineStatus {
  [key: string]: boolean;
}

const getStageForBirthday = (birthday: string) => {
  const born = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(born.getTime())) return '1';
  const now = new Date();
  let months = (now.getFullYear() - born.getFullYear()) * 12 + now.getMonth() - born.getMonth();
  if (now.getDate() < born.getDate()) months -= 1;
  if (months < 1) return '1';
  if (months < 3) return '2';
  if (months < 6) return '3';
  if (months < 8) return '4';
  if (months < 12) return '5';
  if (months < 18) return '6';
  if (months < 24) return '7';
  return '8';
};

export function Guide({ baby }: { baby: BabyInfo }) {
  const babyId = baby.id;
  const [activeStageId, setActiveStageId] = useLocalStorage(`babycare_guide_stage_${babyId}`, getStageForBirthday(baby.birthday));
  const [allergenStatus, setAllergenStatus] = useLocalStorage<AllergenStatus>(`babycare_allergens_${babyId}`, {});
  const [vaccineStatus, setVaccineStatus] = useLocalStorage<VaccineStatus>(`babycare_vaccines_${babyId}`, {});
  const [vaccineSelections, setVaccineSelections] = useLocalStorage<Record<string, string>>(`${VACCINE_SELECTION_STORAGE_PREFIX}${babyId}`, {});
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const activeStage = guideData.find((stage) => stage.id === activeStageId) || guideData[0];
  const vaccinePrices = getVaccinePrices();
  const stageVaccines = getScheduleForStage(activeStageId);
  const selectedChoice = (item: (typeof vaccineSchedule)[number]) => item.choices.find(choice => choice.id === vaccineSelections[item.id]) ?? item.choices[0];
  const isVaccineDone = (item: (typeof vaccineSchedule)[number]) => Boolean(
    vaccineStatus[`schedule:${item.id}`] || item.legacyNames?.some(name => Object.entries(vaccineStatus).some(([key, done]) => done && key.endsWith(`:${name}`)))
  );
  const estimatedTotal = vaccineSchedule.reduce((sum, item) => {
    const choice = selectedChoice(item);
    return sum + (choice.kind === 'paid' ? vaccinePrices[choice.priceKey] ?? choice.defaultPrice : 0);
  }, 0);
  const completedTotal = vaccineSchedule.reduce((sum, item) => {
    if (!isVaccineDone(item)) return sum;
    const choice = selectedChoice(item);
    return sum + (choice.kind === 'paid' ? vaccinePrices[choice.priceKey] ?? choice.defaultPrice : 0);
  }, 0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollerRef.current.offsetLeft);
    setScrollLeft(scrollerRef.current.scrollLeft);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollerRef.current.scrollLeft = scrollLeft - walk;
  }, [isDragging, startX, scrollLeft]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const cycleAllergenStatus = (food: string) => {
    const current = allergenStatus[food] || 'untested';
    let next: 'untested' | 'safe' | 'allergic';
    
    if (current === 'untested') next = 'safe';
    else if (current === 'safe') next = 'allergic';
    else next = 'untested';

    setAllergenStatus({
      ...allergenStatus,
      [food]: next
    });
  };

  const getAllergenBadge = (status: 'untested' | 'safe' | 'allergic') => {
    switch (status) {
      case 'safe':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30">
            <CheckCircle2 size={12} className="text-emerald-500" /> 安全
          </span>
        );
      case 'allergic':
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30">
            <AlertTriangle size={12} className="text-rose-500" /> 过敏
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200 dark:bg-stone-800/40 dark:text-stone-400 dark:border-stone-700/30">
            <HelpCircle size={12} className="text-stone-400" /> 未排查
          </span>
        );
    }
  };

  const toggleVaccine = (vaccineKey: string) => {
    setVaccineStatus({
      ...vaccineStatus,
      [vaccineKey]: !vaccineStatus[vaccineKey]
    });
  };

  return (
    <div className="container guide-page">
      {/* Age Pill Scroller */}
      <div 
        className="guide-scroller"
        ref={scrollerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {guideData.map((stage) => (
          <button
            key={stage.id}
            className={`guide-pill ${activeStageId === stage.id ? 'active' : ''}`}
            onClick={() => setActiveStageId(stage.id)}
          >
            {stage.ageRange.split(' (')[0]}
          </button>
        ))}
      </div>

      {/* Feeding requirements */}
      <div className="card">
        <h3 className="card-title">
          <Utensils size={18} className="text-[var(--amber)]" />
          喂养建议 (乳类)
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] text-[var(--text-muted)]">推荐奶量</p>
            <p className="text-[14px] font-bold text-[var(--text-heading)] mt-1">{activeStage.milkRequirement.amountDesc}</p>
          </div>
          <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <p className="text-[11px] text-[var(--text-muted)]">喂养频次</p>
            <p className="text-[14px] font-bold text-[var(--text-heading)] mt-1">{activeStage.milkRequirement.frequencyDesc}</p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '13px', lineHeight: '1.5' }}>
          <p className="font-semibold text-[var(--text-heading)] mb-1" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            喂养指南要点:
          </p>
          <p className="text-[var(--text)]">{activeStage.milkRequirement.breastfeedingTips}</p>
        </div>
      </div>

      {/* Solids introduction (4-6 months onwards) */}
      {activeStage.solidsGuide && (
        <div className="card">
          <h3 className="card-title">
            <Utensils size={18} className="text-[var(--sage)]" />
            辅食引入计划
          </h3>

          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)' }}>
              {activeStage.solidsGuide.stageTitle}
            </h4>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              【推荐性状】{activeStage.solidsGuide.textureDesc}
            </p>
          </div>

          {/* Allergen Trial checklist */}
          <div style={{ marginTop: '16px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '8px' }}>
              过敏原排查清单（点击切换状态）:
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeStage.solidsGuide.allergenChecklist.map((food) => {
                const status = allergenStatus[food] || 'untested';
                return (
                  <div
                    key={food}
                    onClick={() => cycleAllergenStatus(food)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-heading)' }}>{food}</span>
                    {getAllergenBadge(status)}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontStyle: 'italic' }}>
              * 建议中午尝试新食物，连续观察3天，确认无红疹、呕吐或腹泻方可标记为“安全”。
            </p>
          </div>

          <div style={{ marginTop: '12px', fontSize: '13px', lineHeight: '1.5' }}>
            <p className="font-semibold text-[var(--text-heading)] mb-1" style={{ fontSize: '12px' }}>添加小贴士:</p>
            <p className="text-[var(--text)]">{activeStage.solidsGuide.tips}</p>
          </div>
        </div>
      )}

      {/* Vaccine Guide */}
      {stageVaccines.length > 0 && (
        <div className="card">
          <h3 className="card-title">
            <Sparkles size={18} className="text-[var(--rose)]" />
            疫苗接种计划
          </h3>
          <div className="vaccine-summary">
            <span><Calendar size={15} /><small>按出生日期推算</small><strong>{baby.birthday}</strong></span>
            <span><Activity size={15} /><small>预计总费用</small><strong>¥{estimatedTotal.toFixed(2)}</strong></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {stageVaccines.map((item) => {
              const vaccineKey = `schedule:${item.id}`;
              const isDone = isVaccineDone(item);
              const choice = selectedChoice(item);
              const plannedDate = getPlannedVaccineDate(baby.birthday, choice.month ?? item.month);
              const price = choice.kind === 'paid' ? vaccinePrices[choice.priceKey] ?? choice.defaultPrice : 0;
              return (
                <div
                  key={vaccineKey}
                  className={`vaccine-row ${isDone ? 'completed' : ''}`}
                >
                  <button type="button" className="vaccine-check" aria-label={isDone ? '标记为未接种' : '标记为已接种'} aria-pressed={isDone} onClick={() => toggleVaccine(vaccineKey)}>
                    {isDone ? <CheckCircle2 size={15} /> : <Sparkles size={12} />}
                  </button>
                  <span className="vaccine-content">
                    <span className="vaccine-title-row">
                      <span className="vaccine-name">{item.doseLabel}</span>
                      <span className="vaccine-age">{item.ageLabel}</span>
                    </span>
                    <span className="vaccine-plan">预计 {plannedDate} · {price > 0 ? `¥${price.toFixed(2)}` : '免费'}</span>
                    <span className="vaccine-choice-list">
                      {item.choices.map(option => {
                        const optionPrice = option.kind === 'paid' ? vaccinePrices[option.priceKey] ?? option.defaultPrice : 0;
                        return <button type="button" key={option.id} className={choice.id === option.id ? 'active' : ''} onClick={() => setVaccineSelections({ ...vaccineSelections, [item.id]: option.id })}>
                          <b>{option.brand || (option.kind === 'free' ? '免费方案' : option.name)}</b><small>{option.brand ? option.name : ''}{option.kind === 'paid' ? ` · ¥${optionPrice.toFixed(2)}` : ''}</small>
                        </button>;
                      })}
                    </span>
                    {item.note && <span className="vaccine-note">{item.note}</span>}
                  </span>
                  <span className="vaccine-status">{isDone ? '已接种' : '未接种'}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontStyle: 'italic' }}>
            * 已接种估算 ¥{completedTotal.toFixed(2)}，剩余估算 ¥{Math.max(0, estimatedTotal - completedTotal).toFixed(2)}。日期与价格仅供计划参考，请以当地接种门诊为准。
          </p>
        </div>
      )}

      {/* Developmental Milestones */}
      <div className="card">
        <h3 className="card-title">
          <Award size={18} className="text-[var(--lavender)]" />
          发育里程碑
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px' }}>
              大动作发育 (Gross Motor)
            </h4>
            <ul className="bullet-list">
              {activeStage.milestones.grossMotor.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px' }}>
              精细动作发育 (Fine Motor)
            </h4>
            <ul className="bullet-list">
              {activeStage.milestones.fineMotor.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', marginBottom: '6px' }}>
              语言与社交 (Language & Social)
            </h4>
            <ul className="bullet-list">
              {activeStage.milestones.languageSocial.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
