import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronDown, Clock3 } from 'lucide-react';

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

export function DateTimePicker({ value, onChange, label, mode = 'datetime', placeholder = '请选择', className = '' }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseValue(value));
  const [shownMonth, setShownMonth] = useState(() => {
    const date = parseValue(value);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    const date = parseValue(value);
    setDraft(date);
    setShownMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [open, value]);

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

  const adjustTime = (unit: 'hour' | 'minute', amount: number) => {
    setDraft(current => {
      const next = new Date(current);
      if (unit === 'hour') next.setHours((next.getHours() + amount + 24) % 24);
      else next.setMinutes((next.getMinutes() + amount + 60) % 60);
      return next;
    });
  };

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
        {mode === 'date' ? <Calendar size={16} /> : <Clock3 size={16} />}
        <span className={!value ? 'placeholder' : ''}>{formatValue(value, mode, placeholder)}</span>
      </button>
      {open && createPortal(
        <div className="date-picker-layer" role="presentation" onClick={() => setOpen(false)}>
          <section className="date-picker-panel" role="dialog" aria-modal="true" aria-label={label} onClick={event => event.stopPropagation()}>
            <header className="date-picker-header">
              <button type="button" onClick={() => setShownMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="上个月"><ChevronDown className="picker-arrow-left" size={20} /></button>
              <strong>{shownMonth.getFullYear()}年 {shownMonth.getMonth() + 1}月</strong>
              <button type="button" onClick={() => setShownMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="下个月"><ChevronDown className="picker-arrow-right" size={20} /></button>
            </header>
            <div className="date-picker-weekdays">{['日', '一', '二', '三', '四', '五', '六'].map(day => <span key={day}>{day}</span>)}</div>
            <div className="date-picker-days">
              {days.map(day => {
                const selected = toDateValue(day) === toDateValue(draft);
                const outside = day.getMonth() !== shownMonth.getMonth();
                const today = toDateValue(day) === toDateValue(new Date());
                return <button type="button" key={toDateValue(day)} className={`${selected ? 'selected' : ''} ${outside ? 'outside' : ''} ${today ? 'today' : ''}`.trim()} onClick={() => chooseDay(day)}>{day.getDate()}</button>;
              })}
            </div>
            {mode === 'datetime' && (
              <div className="date-picker-time">
                <Clock3 size={17} />
                <div className="date-time-stepper">
                  <button type="button" onClick={() => adjustTime('hour', 1)} aria-label="小时加一"><ChevronDown className="picker-arrow-up" size={18} /></button>
                  <strong>{pad(draft.getHours())}</strong>
                  <button type="button" onClick={() => adjustTime('hour', -1)} aria-label="小时减一"><ChevronDown size={18} /></button>
                </div>
                <b>:</b>
                <div className="date-time-stepper">
                  <button type="button" onClick={() => adjustTime('minute', 1)} aria-label="分钟加一"><ChevronDown className="picker-arrow-up" size={18} /></button>
                  <strong>{pad(draft.getMinutes())}</strong>
                  <button type="button" onClick={() => adjustTime('minute', -1)} aria-label="分钟减一"><ChevronDown size={18} /></button>
                </div>
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
