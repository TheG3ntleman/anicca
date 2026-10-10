import { useState } from 'react';
import type {
  Task,
  TaskInput,
  TaskEditInput,
  TaskStatus,
} from '../../domain/tasks/types';
import { SchedulePicker } from '../SchedulePicker/SchedulePicker';
import { useLocalDay } from '../../hooks/useLocalDay';
import { validateTaskInput } from '../../domain/tasks/validation';
import ui from '../../styles/controls.module.css';
import styles from './TaskForm.module.css';
interface Props {
  task?: Task;
  initialPlannedDate?: string | null;
  startReopening?: boolean;
  onSave: (input: TaskEditInput) => Promise<void>;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}
export function TaskForm({
  task,
  initialPlannedDate,
  onSave,
  onCancel,
  onBusyChange,
  startReopening = false,
}: Props) {
  const today = useLocalDay();
  const [input, setInput] = useState<TaskInput>(() =>
    task
      ? {
          title: task.title,
          finishCriteria: task.finishCriteria,
          description: task.description,
          plannedCompletionDate: task.plannedCompletionDate,
        }
      : {
          title: '',
          finishCriteria: '',
          description: '',
          plannedCompletionDate:
            initialPlannedDate === undefined ? today : initialPlannedDate,
        },
  );
  const [status, setStatus] = useState<TaskStatus>(
    startReopening ? 'pending' : (task?.status ?? 'pending'),
  );
  const [scheduleChosen, setScheduleChosen] = useState(false);
  const reopening =
    !!task &&
    ['completed', 'cancelled'].includes(task.status) &&
    ['pending', 'deferred'].includes(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (values: Partial<TaskInput>) =>
    setInput((current) => ({ ...current, ...values }));
  return (
    <form
      className={`${ui.stack} ${styles.form}`}
      onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        setBusy(true);
        onBusyChange?.(true);
        try {
          validateTaskInput(input);
          if (reopening && !scheduleChosen)
            throw new Error(
              'Choose a new timeline before reopening this task.',
            );
          if (
            reopening &&
            input.plannedCompletionDate &&
            input.plannedCompletionDate < today
          )
            throw new Error(
              'Choose today or a future date to reopen this task.',
            );
          await onSave(task ? { ...input, status } : input);
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
      {task && (
        <label className={ui.field}>
          Status
          <select
            disabled={busy}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TaskStatus);
              setScheduleChosen(false);
            }}
          >
            <option value="pending">
              {['completed', 'cancelled'].includes(task.status)
                ? 'Reopen task'
                : 'Pending'}
            </option>
            <option value="completed">Completed</option>
            <option value="deferred">Deferred</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      )}
      <SchedulePicker
        today={today}
        value={input.plannedCompletionDate}
        disabled={busy}
        confirmed={!reopening || scheduleChosen}
        futureOnly={reopening}
        hint="An intention, not a deadline. You can change it whenever you need."
        onChange={(date) => {
          update({ plannedCompletionDate: date });
          setScheduleChosen(true);
        }}
      />
      {reopening && (
        <p className={ui.muted}>Choose a new timeline to reopen this task.</p>
      )}
      {error && (
        <div className={ui.error} role="alert">
          {error}
        </div>
      )}
      <div className={styles.footer}>
        <button
          type="submit"
          disabled={busy}
          className={`${ui.button} ${ui.primary}`}
        >
          {busy
            ? 'Saving…'
            : reopening
              ? 'Reopen task'
              : task
                ? 'Save changes'
                : 'Add task'}
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
