import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlanningStore } from '../../state/PlanningStore';
import { usePlanning } from '../../state/usePlanning';
import { useLocalDay } from '../../hooks/useLocalDay';
import { useCreateSwipe } from '../../hooks/useCreateSwipe';
import {
  alphabetical,
  layerTasks,
  needsReview,
  todayTasks,
  tomorrowTasks,
} from '../../domain/tasks/selectors';
import type { Task, TaskHorizon } from '../../domain/tasks/types';
import { TaskList } from '../TaskList/TaskList';
import { Modal } from '../Modal/Modal';
import { SlidePanel } from '../SlidePanel/SlidePanel';
import { TaskForm } from '../TaskForm/TaskForm';
import { TaskDetails } from '../TaskDetails/TaskDetails';
import { ReviewFlow } from '../Review/ReviewFlow';
import { Celebration } from '../Celebration/Celebration';
import { DataTools } from '../DataTools/DataTools';
import { Toast } from '../Toast/Toast';
import styles from './Planning.module.css';
import ui from '../../styles/controls.module.css';

type Overlay =
  | { kind: 'details'; taskId: string }
  | { kind: 'review' }
  | { kind: 'data' }
  | { kind: 'all' }
  | { kind: 'celebration'; message: string }
  | null;
const horizons: TaskHorizon[] = ['short', 'medium', 'long'];
const titles = ['Today', 'Medium term', 'Long term'];
export function Planning({ store }: { store: PlanningStore }) {
  const snapshot = usePlanning(store);
  const today = useLocalDay();
  const [layer, setLayer] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<{
    message: string;
    undo?: () => void;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [allQuery, setAllQuery] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef([0, 0, 0]);
  const dismissToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    void store.refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void store.refresh();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [store]);
  useEffect(() => {
    if (scroller.current)
      scroller.current.scrollTop = scrollPositions.current[layer];
  }, [layer]);
  const swipe = useCreateSwipe(
    !overlay && snapshot.ready && !snapshot.error && !busy,
  );
  const select = (task: Task) =>
    setOverlay({ kind: 'details', taskId: task.id });
  const toggle = async (task: Task) => {
    if (busy) return;
    setBusy(true);
    try {
      const completed = await store.status(
        task,
        task.status === 'completed' ? 'pending' : 'completed',
      );
      setToast({
        message:
          task.status === 'completed' ? 'Task reopened.' : 'Task completed.',
        undo:
          task.status === 'completed'
            ? undefined
            : () => {
                void store
                  .undoCompletion(completed)
                  .then(() => setToast({ message: 'Completion undone.' }))
                  .catch((error) => setToast({ message: error.message }));
              },
      });
    } catch (error) {
      setToast({
        message:
          error instanceof Error ? error.message : 'Unable to update task.',
      });
    } finally {
      setBusy(false);
    }
  };
  const tasks =
    layer === 0
      ? todayTasks(snapshot.tasks, today)
      : layerTasks(snapshot.tasks, horizons[layer]);
  const pendingReview = snapshot.tasks.filter((task) =>
    needsReview(task, today),
  );
  const tomorrow = tomorrowTasks(snapshot.tasks, today);
  const allTasks = alphabetical(
    snapshot.tasks.filter((task) =>
      task.title.toLocaleLowerCase().includes(allQuery.toLocaleLowerCase()),
    ),
  );
  return (
    <div className={styles.planning} {...swipe.bind}>
      <header className={styles.header}>
        <h1>Anicca</h1>
        <div className={ui.row}>
          <button
            className={styles.quiet}
            onClick={() => setOverlay({ kind: 'data' })}
            disabled={!snapshot.ready || Boolean(snapshot.error)}
          >
            Data
          </button>
          <button
            className={styles.add}
            aria-label="Create a new task"
            onClick={swipe.open}
            disabled={!snapshot.ready || Boolean(snapshot.error)}
          >
            ＋
          </button>
        </div>
      </header>
      <div
        ref={scroller}
        className={styles.scroller}
        onScroll={() => {
          scrollPositions.current[layer] = scroller.current?.scrollTop ?? 0;
        }}
      >
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Planning · {layer + 1} / 3</span>
          <h2>{titles[layer]}</h2>
          <p>
            {layer === 0
              ? new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : layer === 1
                ? 'Intentions with a planned date.'
                : 'Room for what comes later.'}
          </p>
        </div>
        {!snapshot.ready ? (
          <p role="status">Opening your local plan…</p>
        ) : snapshot.error ? (
          <div role="alert" className={ui.stack}>
            <p className={ui.error}>{snapshot.error}</p>
            <button className={ui.button} onClick={() => void store.refresh()}>
              Retry storage
            </button>
          </div>
        ) : (
          <>
            {layer === 0 && (
              <div className={styles.progress}>
                {tasks.filter((task) => task.status === 'completed').length} /{' '}
                {tasks.length} tasks complete
              </div>
            )}
            <TaskList
              tasks={tasks}
              today={today}
              onSelect={select}
              onToggle={toggle}
              empty={
                layer === 0
                  ? 'Nothing planned for today. Add a task, or choose one during review.'
                  : 'No objectives here yet. Add one when you’re ready.'
              }
            />
            {layer === 0 && (
              <>
                {pendingReview.length > 0 && (
                  <button
                    className={styles.reviewNotice}
                    onClick={() => setOverlay({ kind: 'review' })}
                  >
                    {pendingReview.length} unresolved{' '}
                    {pendingReview.length === 1 ? 'item needs' : 'items need'}{' '}
                    review →
                  </button>
                )}
                {tomorrow.length > 0 && (
                  <details className={styles.tomorrow}>
                    <summary>Tomorrow’s plan · {tomorrow.length}</summary>
                    <TaskList
                      tasks={tomorrow}
                      today={today}
                      onSelect={select}
                      onToggle={toggle}
                    />
                  </details>
                )}
                <section className={styles.habits}>
                  <h3>Habits</h3>
                  <p>
                    Weight, meals, sleep, water, medication, diet, exercise.
                  </p>
                  <span>
                    We’ll design their logs one at a time. Habit tracking comes
                    next.
                  </span>
                </section>
              </>
            )}
            <button
              className={styles.quiet}
              onClick={() => {
                setAllQuery('');
                setOverlay({ kind: 'all' });
              }}
            >
              Browse all tasks · completed, cancelled & archived
            </button>
            <p className={styles.gestureHint}>
              Swipe left to add a task, or use ＋.
            </p>
          </>
        )}
      </div>
      <footer className={styles.footer}>
        <button
          className={styles.arrow}
          aria-label="Previous planning layer"
          disabled={layer === 0}
          onClick={() => setLayer((layer) => layer - 1)}
        >
          ↑
        </button>
        <button
          className={styles.finish}
          disabled={!snapshot.ready || Boolean(snapshot.error)}
          onClick={() => setOverlay({ kind: 'review' })}
        >
          Finish day
        </button>
        <button
          className={styles.arrow}
          aria-label={layer === 2 ? 'Return to Today' : 'Next planning layer'}
          onClick={() => setLayer((layer) => (layer + 1) % 3)}
        >
          {layer === 2 ? '↺' : '↓'}
        </button>
      </footer>
      {toast && (
        <Toast
          message={toast.message}
          onUndo={toast.undo}
          onDismiss={dismissToast}
        />
      )}
      {swipe.phase !== 'idle' && (
        <SlidePanel
          title="New task"
          phase={swipe.phase}
          offset={swipe.offset}
          width={swipe.width}
          onClose={swipe.close}
          onSettled={swipe.settle}
          locked={busy}
        >
          <TaskForm
            onBusyChange={setBusy}
            initialHorizon={horizons[layer]}
            onCancel={swipe.close}
            onSave={async (input) => {
              await store.create(input);
              swipe.close();
              setToast({ message: 'Task saved locally.' });
            }}
          />
        </SlidePanel>
      )}
      {overlay?.kind === 'details' && (
        <TaskDetails
          key={overlay.taskId}
          taskId={overlay.taskId}
          store={store}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'review' && (
        <ReviewFlow
          store={store}
          onClose={() => setOverlay(null)}
          onComplete={(message) => setOverlay({ kind: 'celebration', message })}
        />
      )}
      {overlay?.kind === 'celebration' && (
        <Celebration
          message={overlay.message}
          onDone={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === 'data' && (
        <DataTools store={store} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === 'all' && (
        <Modal title="All tasks" onClose={() => setOverlay(null)}>
          <div className={ui.stack}>
            <label className={ui.field}>
              Search
              <input
                value={allQuery}
                onChange={(event) => setAllQuery(event.target.value)}
              />
            </label>
            {allTasks.map((task) => (
              <button
                key={task.id}
                className={ui.button}
                style={{ textAlign: 'left' }}
                onClick={() => select(task)}
              >
                {task.title}
                <br />
                <span className={ui.muted}>
                  {task.status}
                  {task.archived ? ' · Archived' : ''}
                </span>
              </button>
            ))}
            {!allTasks.length && <p className={ui.muted}>No matching tasks.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
