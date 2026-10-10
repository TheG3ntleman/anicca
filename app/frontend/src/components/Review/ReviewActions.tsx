import { useState } from 'react';
import type { ReviewDecision } from '../../domain/reviews/operations';
import { addDays } from '../../domain/tasks/dates';
import { SchedulePicker } from '../SchedulePicker/SchedulePicker';
import ui from '../../styles/controls.module.css';
import styles from './Review.module.css';
const options = [
  ['plan', 'Plan next'],
  ['complete', 'Completed'],
  ['defer', 'Defer'],
  ['cancel', 'Cancel task'],
  ['leave', 'Leave unresolved'],
] as const;
export function ReviewActions({
  today,
  busy,
  onDecision,
}: {
  today: string;
  busy: boolean;
  onDecision: (decision: ReviewDecision) => void;
}) {
  const [kind, setKind] = useState<(typeof options)[number][0]>('plan');
  const [date, setDate] = useState<string | null>(addDays(today, 1));
  const descriptions = {
    complete: 'Mark this task as finished.',
    defer: 'Set it aside. It will stay available for review.',
    cancel: 'Stop pursuing this task. Its history and logs are kept.',
    leave: 'Keep its current status and planned date.',
    plan: '',
  };
  const label =
    kind === 'plan'
      ? date === null
        ? 'Save without a date'
        : date === today
          ? 'Plan today'
          : date === addDays(today, 1)
            ? 'Plan tomorrow'
            : 'Plan this date'
      : 'Save decision';
  return (
    <form
      className={ui.stack}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy)
          onDecision(
            kind === 'plan'
              ? date === null
                ? { kind: 'unschedule' }
                : { kind: 'plan', date }
              : { kind },
          );
      }}
    >
      <fieldset className={ui.choiceGroup} disabled={busy}>
        <legend>What happens next?</legend>
        <div className={styles.outcomes}>
          {options.map(([value, text]) => (
            <button
              type="button"
              key={value}
              className={ui.button}
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
            >
              {text}
            </button>
          ))}
        </div>
      </fieldset>
      {kind === 'plan' ? (
        <SchedulePicker
          today={today}
          value={date}
          onChange={setDate}
          disabled={busy}
          label="Choose a timeline"
        />
      ) : (
        <p className={styles.explanation}>{descriptions[kind]}</p>
      )}
      <button
        className={`${ui.button} ${ui.primary}`}
        disabled={busy}
        type="submit"
      >
        {busy ? 'Saving…' : label}
      </button>
    </form>
  );
}
