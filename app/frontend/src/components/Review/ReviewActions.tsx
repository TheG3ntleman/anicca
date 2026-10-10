import { useState } from 'react';
import type { ReviewDecision } from '../../domain/reviews/operations';
import { addDays } from '../../domain/tasks/dates';
import ui from '../../styles/controls.module.css';
export function ReviewActions({
  today,
  busy,
  onDecision,
}: {
  today: string;
  busy: boolean;
  onDecision: (decision: ReviewDecision) => void;
}) {
  const [date, setDate] = useState(addDays(today, 1));
  return (
    <div className={ui.stack}>
      <div className={ui.row}>
        <button
          className={`${ui.button} ${ui.primary}`}
          disabled={busy}
          onClick={() => onDecision({ kind: 'plan', date: addDays(today, 1) })}
        >
          Plan tomorrow
        </button>
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => onDecision({ kind: 'plan', date: today })}
        >
          Plan today
        </button>
      </div>
      <div className={ui.row}>
        <label className={ui.field}>
          Another date
          <input
            aria-label="Review planned completion date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <button
          className={ui.button}
          disabled={busy || !date}
          onClick={() => onDecision({ kind: 'plan', date })}
        >
          Plan this date
        </button>
      </div>
      <div className={ui.row}>
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => onDecision({ kind: 'complete' })}
        >
          Complete
        </button>
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => onDecision({ kind: 'defer' })}
        >
          Defer
        </button>
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => onDecision({ kind: 'long' })}
        >
          Move to long term
        </button>
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => onDecision({ kind: 'cancel' })}
        >
          Cancel task
        </button>
        <button
          className={ui.button}
          disabled={busy}
          onClick={() => onDecision({ kind: 'leave' })}
        >
          Leave unresolved
        </button>
      </div>
    </div>
  );
}
