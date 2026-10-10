import { useState } from 'react';
import type { Task, TaskInput, TaskHorizon } from '../../domain/tasks/types';
import { addDays, localDate } from '../../domain/tasks/dates';
import { validateTaskInput } from '../../domain/tasks/validation';
import ui from '../../styles/controls.module.css';
interface Props {
  task?: Task;
  initialHorizon?: TaskHorizon;
  onSave: (input: TaskInput) => Promise<void>;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}
export function TaskForm({
  task,
  initialHorizon = 'short',
  onSave,
  onCancel,
  onBusyChange,
}: Props) {
  const today = localDate();
  const [input, setInput] = useState<TaskInput>(() =>
    task
      ? {
          title: task.title,
          finishCriteria: task.finishCriteria,
          description: task.description,
          horizon: task.horizon,
          plannedCompletionDate: task.plannedCompletionDate,
        }
      : {
          title: '',
          finishCriteria: '',
          description: '',
          horizon: initialHorizon,
          plannedCompletionDate:
            initialHorizon === 'long'
              ? null
              : initialHorizon === 'short'
                ? today
                : addDays(today, 7),
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (values: Partial<TaskInput>) =>
    setInput((current) => ({ ...current, ...values }));
  const setHorizon = (horizon: TaskHorizon) => {
    const date = input.plannedCompletionDate;
    update({
      horizon,
      plannedCompletionDate:
        horizon === 'long'
          ? null
          : horizon === 'short'
            ? date && date <= addDays(today, 1)
              ? date
              : today
            : date && date > addDays(today, 1)
              ? date
              : addDays(today, 7),
    });
  };
  const plan = (date: string) =>
    update({
      plannedCompletionDate: date,
      horizon: date <= addDays(today, 1) ? 'short' : 'medium',
    });
  return (
    <form
      className={ui.stack}
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        setBusy(true);
        onBusyChange?.(true);
        try {
          validateTaskInput(input);
          await onSave(input);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Unable to save.');
        } finally {
          setBusy(false);
          onBusyChange?.(false);
        }
      }}
    >
      <label className={ui.field}>
        Title
        <input
          required
          maxLength={500}
          value={input.title}
          onChange={(event) => update({ title: event.target.value })}
        />
      </label>
      <label className={ui.field}>
        What does finished look like?
        <textarea
          required
          maxLength={10000}
          value={input.finishCriteria}
          onChange={(event) => update({ finishCriteria: event.target.value })}
        />
      </label>
      <label className={ui.field}>
        Planning layer
        <select
          value={input.horizon}
          onChange={(event) => setHorizon(event.target.value as TaskHorizon)}
        >
          <option value="short">Short term</option>
          <option value="medium">Medium term</option>
          <option value="long">Long term · not scheduled</option>
        </select>
      </label>
      {input.horizon !== 'long' && (
        <>
          <div className={ui.row}>
            <button
              type="button"
              className={ui.button}
              onClick={() => plan(today)}
            >
              Today
            </button>
            <button
              type="button"
              className={ui.button}
              onClick={() => plan(addDays(today, 1))}
            >
              Tomorrow
            </button>
            <button
              type="button"
              className={ui.button}
              onClick={() =>
                update({ horizon: 'long', plannedCompletionDate: null })
              }
            >
              Unscheduled
            </button>
          </div>
          <label className={ui.field}>
            Planned completion date
            <input
              type="date"
              value={input.plannedCompletionDate ?? ''}
              onChange={(event) =>
                event.target.value
                  ? plan(event.target.value)
                  : update({ horizon: 'long', plannedCompletionDate: null })
              }
            />
          </label>
          <span className={ui.muted}>
            An intention, not a deadline. You can change it whenever you need.
          </span>
        </>
      )}
      <label className={ui.field}>
        Description · optional
        <textarea
          maxLength={100000}
          value={input.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      </label>
      {error && (
        <div className={ui.error} role="alert">
          {error}
        </div>
      )}
      <div className={ui.row}>
        <button
          type="submit"
          disabled={busy}
          className={`${ui.button} ${ui.primary}`}
        >
          {busy ? 'Saving…' : task ? 'Save changes' : 'Add task'}
        </button>
        <button
          type="button"
          disabled={busy}
          className={ui.button}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
