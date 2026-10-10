import { useState } from 'react';
import type { PlanningStore } from '../../state/PlanningStore';
import { usePlanning } from '../../state/usePlanning';
import { reviewTasks, isDailyReviewTask } from '../../domain/tasks/selectors';
import { formatDate, localDate } from '../../domain/tasks/dates';
import type { ReviewDecision } from '../../domain/reviews/operations';
import { Modal } from '../Modal/Modal';
import { ReviewActions } from './ReviewActions';
import ui from '../../styles/controls.module.css';
import styles from './Review.module.css';
import { reviewOutcome } from '../../domain/reviews/outcomes';
import { useLocalDay } from '../../hooks/useLocalDay';
export function ReviewFlow({
  store,
  onClose,
  onComplete,
}: {
  store: PlanningStore;
  onClose: () => void;
  onComplete: (message: string) => void;
}) {
  const snapshot = usePlanning(store);
  const today = useLocalDay();
  const [reviewId] = useState(() => crypto.randomUUID());
  const [ids] = useState(() =>
    reviewTasks(store.getSnapshot().tasks, today).map((task) => task.id),
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const task = snapshot.tasks.find((task) => task.id === ids[index]);
  const outcomes = snapshot.events
    .filter((event) => event.reviewId === reviewId)
    .sort((a, b) => a.at.localeCompare(b.at));
  const decide = async (decision: ReviewDecision) => {
    if (!task || !isDailyReviewTask(task, today) || busy) return;
    setBusy(true);
    setError('');
    try {
      await store.decide(task, decision, reviewId);
      setIndex((index) => index + 1);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to record this review.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Finish day" onClose={onClose} locked={busy}>
      <div className={ui.stack}>
        <div className={styles.progress} aria-hidden="true">
          <span
            style={{
              width: `${ids.length ? (index / ids.length) * 100 : 100}%`,
            }}
          />
        </div>
        {index < ids.length && task && isDailyReviewTask(task, today) ? (
          <>
            <p className={ui.muted}>
              {index + 1} of {ids.length} ·{' '}
              {formatDate(task.plannedCompletionDate)} · {task.status}
            </p>
            <h3 style={{ margin: 0 }}>{task.title}</h3>
            <p
              className={styles.explanation}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {task.finishCriteria}
            </p>
            <ReviewActions
              key={task.id}
              today={today}
              busy={busy}
              onDecision={(decision) => void decide(decision)}
            />
          </>
        ) : index < ids.length ? (
          <>
            <p>This item no longer needs review.</p>
            <button className={ui.button} onClick={() => setIndex(index + 1)}>
              Continue
            </button>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0 }}>You’ve checked through your plan.</h3>
            <p className={styles.explanation}>
              {outcomes.length
                ? `${outcomes.length} ${outcomes.length === 1 ? 'item' : 'items'} reviewed.`
                : 'No tasks need review today.'}{' '}
              Your decisions are saved. Anything left unresolved stays available
              for review.
            </p>
            {outcomes.length > 0 && (
              <ul
                className={styles.summary}
                aria-label="Review outcomes"
                tabIndex={0}
              >
                {outcomes.map((event) => (
                  <li key={event.id}>
                    <strong>{event.after.title}</strong>
                    <span>{reviewOutcome(event, localDate())}</span>
                    <small>
                      Previously: {event.before?.status} ·{' '}
                      {formatDate(event.before?.plannedCompletionDate ?? null)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            <button
              className={`${ui.button} ${ui.primary}`}
              disabled={busy}
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                setError('');
                const messages = [
                  'Good job.',
                  'Another day has passed.',
                  'You’ll get there!',
                ];
                const message =
                  messages[snapshot.reviews.length % messages.length];
                try {
                  await store.finishReview(
                    reviewId,
                    outcomes.map((event) => event.taskId),
                    message,
                  );
                  onComplete(message);
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : 'Unable to finish review.',
                  );
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Saving…' : 'Finish review'}
            </button>
          </>
        )}
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
