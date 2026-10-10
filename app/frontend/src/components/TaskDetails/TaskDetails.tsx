import { useState } from 'react';
import type { Task } from '../../domain/tasks/types';
import type { PlanningStore } from '../../state/PlanningStore';
import { usePlanning } from '../../state/usePlanning';
import { Modal } from '../Modal/Modal';
import { TaskForm } from '../TaskForm/TaskForm';
import { ReviewActions } from '../Review/ReviewActions';
import { formatDate, localDate } from '../../domain/tasks/dates';
import type { ReviewDecision } from '../../domain/reviews/operations';
import ui from '../../styles/controls.module.css';
export function TaskDetails({
  taskId,
  store,
  onClose,
}: {
  taskId: string;
  store: PlanningStore;
  onClose: () => void;
}) {
  const snapshot = usePlanning(store);
  const task = snapshot.tasks.find((task) => task.id === taskId);
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!task) return null;
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  };
  const notes = snapshot.notes
    .filter((note) => note.taskId === taskId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = snapshot.events
    .filter((event) => event.taskId === taskId)
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Modal
      title={editing ? 'Edit task' : task.title}
      onClose={onClose}
      locked={busy}
    >
      {editing ? (
        <TaskForm
          key={task.updatedAt}
          task={task}
          onSave={async (input) => {
            await store.edit(task, input);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onBusyChange={setBusy}
        />
      ) : (
        <div className={ui.stack}>
          <p className={ui.muted}>
            {task.horizon} term · {task.status}
            {task.archived ? ' · Archived' : ''} ·{' '}
            {formatDate(task.plannedCompletionDate)}
          </p>
          <div>
            <strong>Finished means</strong>
            <p style={{ whiteSpace: 'pre-wrap' }}>{task.finishCriteria}</p>
          </div>
          {task.description && (
            <p style={{ whiteSpace: 'pre-wrap' }}>{task.description}</p>
          )}
          <div className={ui.row}>
            <button
              className={ui.button}
              disabled={busy}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
            <button
              className={ui.button}
              disabled={busy}
              onClick={() => setReviewing(!reviewing)}
            >
              Review
            </button>
            <button
              className={ui.button}
              disabled={busy}
              onClick={() =>
                void run(() => store.archive(task, !task.archived))
              }
            >
              {task.archived ? 'Restore from archive' : 'Archive'}
            </button>
            {['completed', 'cancelled'].includes(task.status) && (
              <button
                className={ui.button}
                disabled={busy}
                onClick={() => void run(() => store.status(task, 'pending'))}
              >
                Reopen
              </button>
            )}
          </div>
          {reviewing && (
            <ReviewActions
              today={localDate()}
              busy={busy}
              onDecision={(decision: ReviewDecision) =>
                void run(() => store.decide(task, decision))
              }
            />
          )}
          <form
            className={ui.stack}
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await store.note(task, note);
                setNote('');
              });
            }}
          >
            <label className={ui.field}>
              Add a note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={100000}
              />
            </label>
            <button
              type="submit"
              className={ui.button}
              disabled={busy || !note.trim()}
            >
              Save note
            </button>
          </form>
          {error && (
            <div className={ui.error} role="alert">
              {error}
            </div>
          )}
          {notes.length > 0 && (
            <section>
              <h3>Notes</h3>
              {notes.map((note) => (
                <article key={note.id}>
                  <small className={ui.muted}>
                    {new Date(note.createdAt).toLocaleString()}
                  </small>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{note.text}</p>
                </article>
              ))}
            </section>
          )}
          <details>
            <summary>Task history ({events.length})</summary>
            {events.map((event) => (
              <p key={event.id} className={ui.muted}>
                {new Date(event.at).toLocaleString()} · {event.action}
              </p>
            ))}
          </details>
        </div>
      )}
    </Modal>
  );
}
