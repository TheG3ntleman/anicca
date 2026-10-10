import { useState } from 'react';
import type { Task } from '../../domain/tasks/types';
import type { PlanningStore } from '../../state/PlanningStore';
import { usePlanning } from '../../state/usePlanning';
import { Modal } from '../Modal/Modal';
import { TaskForm } from '../TaskForm/TaskForm';
import { LogComposer } from '../LogComposer/LogComposer';
import { LogViewer } from '../LogViewer/LogViewer';
import { formatDate } from '../../domain/tasks/dates';
import { planningLayer } from '../../domain/tasks/selectors';
import { useLocalDay } from '../../hooks/useLocalDay';
import ui from '../../styles/controls.module.css';
export function TaskDetails({
  taskId,
  store,
  onClose,
  startEditing = false,
}: {
  taskId: string;
  store: PlanningStore;
  onClose: () => void;
  startEditing?: boolean;
}) {
  const snapshot = usePlanning(store);
  const today = useLocalDay();
  const task = snapshot.tasks.find((task) => task.id === taskId);
  const [editing, setEditing] = useState(startEditing);
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
  const logIds = new Set(
    snapshot.logLinks
      .filter((link) => link.targetType === 'task' && link.targetId === taskId)
      .map((link) => link.logId),
  );
  const logs = snapshot.logs
    .filter((log) => logIds.has(log.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = snapshot.events
    .filter((event) => event.taskId === taskId)
    .sort((a, b) => b.at.localeCompare(a.at));
  const layer = planningLayer(task, today);
  return (
    <Modal
      title={editing ? 'Edit task' : task.title}
      onClose={onClose}
      locked={busy}
    >
      {editing && (
        <TaskForm
          key={task.updatedAt}
          task={task}
          startReopening={startEditing}
          onSave={async (input) => {
            await store.edit(task, input);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          onBusyChange={setBusy}
        />
      )}
      <div
        className={ui.stack}
        style={editing ? { display: 'none' } : undefined}
        inert={editing}
      >
        <p className={ui.muted}>
          {layer === 'review' ? 'Needs review' : `${layer} term`} ·{' '}
          {task.status}
          {task.archived ? ' · Archived' : ''} ·{' '}
          {formatDate(task.plannedCompletionDate, today)}
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
            onClick={() => void run(() => store.archive(task, !task.archived))}
          >
            {task.archived ? 'Restore from archive' : 'Archive'}
          </button>
        </div>
        <LogComposer
          disabled={busy}
          onBusyChange={setBusy}
          onSave={async (draft) => {
            await store.createLog(draft.text, draft.attachments, {
              type: 'task',
              id: taskId,
            });
          }}
        />
        {error && (
          <div className={ui.error} role="alert">
            {error}
          </div>
        )}
        {logs.length > 0 && (
          <section>
            <h3>Logs</h3>
            {logs.map((log) => (
              <LogViewer
                key={log.id}
                log={log}
                attachments={snapshot.attachments}
                loadMedia={store.loadMedia}
              />
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
    </Modal>
  );
}
