import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock3 } from 'lucide-react';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  mode?: 'date' | 'datetime';
  placeholder?: string;
  className?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

const toDateValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toDateTimeValue = (date: Date) => `${toDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseValue = (value: string) => {
  const parsed = value ? new Date(value.length === 10 ? `${value}T12:00` : value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatValue = (value: string, mode: 'date' | 'datetime', placeholder: string) => {
  if (!value) return placeholder;
  const [date, time = ''] = value.split('T');
  return mode === 'date' ? date.replaceAll('-', '/') : `${date.replaceAll('-', '/')} ${time.slice(0, 5)}`;
};

function TimeWheel({ value, count, label, onChange }: { value: number; count: number; label: string; onChange: (value: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: value * 36, behavior: 'auto' });
  }, [value]);
  const handleScroll = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const next = Math.max(0, Math.min(count - 1, Math.round((ref.current?.scrollTop ?? 0) / 36)));
      onChange(next);
      ref.current?.scrollTo({ top: next * 36, behavior: 'smooth' });
    }, 70);
  };
  return <div className="date-time-wheel" ref={ref} onScroll={handleScroll} role="listbox" aria-label={label}>
    <span aria-hidden="true" />
    {Array.from({ length: count }, (_, item) => <button type="button" role="option" aria-selected={item === value} className={item === value ? 'selected' : ''} key={item} onClick={() => onChange(item)}>{pad(item)}</button>)}
    <span aria-hidden="true" />
  </div>;
}

export function DateTimePicker({ value, onChange, label, mode = 'datetime', placeholder = '请选择', className = '' }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseValue(value));
  const [shownMonth, setShownMonth] = useState(() => {
    const date = parseValue(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [calendarMode, setCalendarMode] = useState<'days' | 'years' | 'months'>('days');
  const yearListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const date = parseValue(value);
    setDraft(date);
    setShownMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setCalendarMode('days');
  }, [open, value]);

  useEffect(() => {
    if (calendarMode !== 'years') return;
    window.requestAnimationFrame(() => yearListRef.current?.querySelector('.selected')?.scrollIntoView({ block: 'center' }));
  }, [calendarMode]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const days = useMemo(() => {
    const firstWeekday = shownMonth.getDay();
    const first = new Date(shownMonth.getFullYear(), shownMonth.getMonth(), 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(first);
      day.setDate(first.getDate() + index);
      return day;
    });
  }, [shownMonth]);

  const chooseDay = (day: Date) => {
    setDraft(current => new Date(day.getFullYear(), day.getMonth(), day.getDate(), current.getHours(), current.getMinutes()));
    setShownMonth(new Date(day.getFullYear(), day.getMonth(), 1));
  };

  const setTime = (unit: 'hour' | 'minute', value: number) => {
    setDraft(current => {
      const next = new Date(current);
      if (unit === 'hour') next.setHours(value);
      else next.setMinutes(value);
      return next;
    });
  };

  const years = useMemo(() => Array.from({ length: new Date().getFullYear() - 1879 }, (_, index) => 1900 + index), []);

  const selectCurrent = () => {
    const now = new Date();
    setDraft(now);
    setShownMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const confirm = () => {
    onChange(mode === 'date' ? toDateValue(draft) : toDateTimeValue(draft));
    setOpen(false);
  };

  return (
    <>
      <button type="button" className={`custom-date-trigger ${mode === 'datetime' ? 'datetime-picker' : ''} ${className}`.trim()} onClick={() => setOpen(true)} aria-label={label}>
        <span className={!value ? 'placeholder' : ''}>{formatValue(value, mode, placeholder)}</span>
      </button>
      {open && createPortal(
        <div className="date-picker-layer" role="presentation" onClick={() => setOpen(false)}>
          <section className="date-picker-panel" role="dialog" aria-modal="true" aria-label={label} onClick={event => event.stopPropagation()}>
            <header className="date-picker-header">
              <button type="button" onClick={() => setShownMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="上个月"><ChevronDown className="picker-arrow-left" size={20} /></button>
              <div className="date-picker-period">
                <button type="button" className={calendarMode === 'years' ? 'active' : ''} onClick={() => setCalendarMode(current => current === 'years' ? 'days' : 'years')}>{shownMonth.getFullYear()}年</button>
                <button type="button" className={calendarMode === 'months' ? 'active' : ''} onClick={() => setCalendarMode(current => current === 'months' ? 'days' : 'months')}>{shownMonth.getMonth() + 1}月</button>
              </div>
              <button type="button" onClick={() => setShownMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="下个月"><ChevronDown className="picker-arrow-right" size={20} /></button>
            </header>
            {calendarMode === 'years' ? <div className="date-picker-years" ref={yearListRef}>
              {years.map(year => <button type="button" className={year === shownMonth.getFullYear() ? 'selected' : ''} key={year} onClick={() => { setShownMonth(current => new Date(year, current.getMonth(), 1)); setCalendarMode('days'); }}>{year}</button>)}
            </div> : calendarMode === 'months' ? <div className="date-picker-months">
              {Array.from({ length: 12 }, (_, month) => <button type="button" className={month === shownMonth.getMonth() ? 'selected' : ''} key={month} onClick={() => { setShownMonth(current => new Date(current.getFullYear(), month, 1)); setCalendarMode('days'); }}>{month + 1}月</button>)}
            </div> : <><div className="date-picker-weekdays">{['日', '一', '二', '三', '四', '五', '六'].map(day => <span key={day}>{day}</span>)}</div>
            <div className="date-picker-days">
              {days.map(day => {
                const selected = toDateValue(day) === toDateValue(draft);
                const outside = day.getMonth() !== shownMonth.getMonth();
                const today = toDateValue(day) === toDateValue(new Date());
                return <button type="button" key={toDateValue(day)} className={`${selected ? 'selected' : ''} ${outside ? 'outside' : ''} ${today ? 'today' : ''}`.trim()} onClick={() => chooseDay(day)}>{day.getDate()}</button>;
              })}
            </div></>}
            {mode === 'datetime' && (
              <div className="date-picker-time">
                <Clock3 size={17} />
                <TimeWheel value={draft.getHours()} count={24} label="小时" onChange={next => setTime('hour', next)} />
                <b>:</b>
                <TimeWheel value={draft.getMinutes()} count={60} label="分钟" onChange={next => setTime('minute', next)} />
              </div>
            )}
            <footer className="date-picker-actions">
              <button type="button" className="date-picker-now" onClick={selectCurrent}>{mode === 'date' ? '今天' : '现在'}</button>
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>取消</button>
              <button type="button" className="btn-primary" onClick={confirm}>确定</button>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
