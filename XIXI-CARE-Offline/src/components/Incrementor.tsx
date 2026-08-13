import { useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useLongPress } from '../hooks/useLongPress';

interface IncrementorProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  quickOptions?: number[];
  label?: string;
}

export function Incrementor({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  unit = '',
  quickOptions,
  label,
}: IncrementorProps) {
  const decrement = useCallback(() => {
    onChange(Math.max(min, value - step));
  }, [value, step, min, onChange]);

  const increment = useCallback(() => {
    onChange(Math.min(max, value + step));
  }, [value, step, max, onChange]);

  const decrementPress = useLongPress(decrement);
  const incrementPress = useLongPress(increment);

  return (
    <div className="incrementor-wrapper">
      {label && <label className="form-label">{label}</label>}
      <div className="incrementor">
        <button
          type="button"
          className="incrementor-btn"
          {...decrementPress.handlers}
        >
          <Minus size={14} />
        </button>
        <span className="incrementor-value">
          {value}{unit && <span className="incrementor-unit"> {unit}</span>}
        </span>
        <button
          type="button"
          className="incrementor-btn"
          {...incrementPress.handlers}
        >
          <Plus size={14} />
        </button>
      </div>
      {quickOptions && quickOptions.length > 0 && (
        <div className="quick-options-row">
          {quickOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`quick-option-chip ${value === opt ? 'active' : ''}`}
              onClick={() => onChange(opt)}
            >
              {opt}{unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
