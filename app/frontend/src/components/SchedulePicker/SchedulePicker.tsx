import { useState } from 'react';
import { addDays } from '../../domain/tasks/dates';
import ui from '../../styles/controls.module.css';
import styles from './SchedulePicker.module.css';

export function SchedulePicker({
  today,
  value,
  onChange,
  disabled = false,
  confirmed = true,
  futureOnly = false,
  label = 'When would you like to finish this?',
  hint,
}: {
  today: string;
  value: string | null;
  onChange: (date: string | null) => void;
  disabled?: boolean;
  confirmed?: boolean;
  futureOnly?: boolean;
  label?: string;
  hint?: string;
}) {
  const tomorrow = addDays(today, 1);
  const [custom, setCustom] = useState(false);
  const showDate =
    custom || (value !== null && ![today, tomorrow].includes(value));
  const choose = (date: string | null) => {
    setCustom(false);
    onChange(date);
  };
  return (
    <fieldset className={ui.choiceGroup} disabled={disabled}>
      <legend>
        {label}
        {hint && (
          <>
            {' '}
            <span className={ui.muted}>({hint})</span>
          </>
        )}
      </legend>
      <div className={styles.choices}>
        <button
          type="button"
          className={ui.button}
          aria-pressed={confirmed && !showDate && value === today}
          onClick={() => choose(today)}
        >
          Today
        </button>
        <button
          type="button"
          className={ui.button}
          aria-pressed={confirmed && !showDate && value === tomorrow}
          onClick={() => choose(tomorrow)}
        >
          Tomorrow
        </button>
        <button
          type="button"
          className={ui.button}
          aria-pressed={confirmed && showDate}
          onClick={() => setCustom(true)}
        >
          Choose a date
        </button>
        <button
          type="button"
          className={ui.button}
          aria-pressed={confirmed && !showDate && value === null}
          onClick={() => choose(null)}
        >
          Not scheduled yet
        </button>
      </div>
      {showDate && (
        <label className={ui.field}>
          Planned completion date
          <div className={ui.dateControl}>
            <input
              type="date"
              required={futureOnly}
              min={futureOnly ? today : undefined}
              value={value ?? ''}
              onChange={(event) => onChange(event.target.value || null)}
            />
          </div>
        </label>
      )}
    </fieldset>
  );
}
