import { useState } from 'react';
import type { PlanningStore } from '../../state/PlanningStore';
import { usePlanning } from '../../state/usePlanning';
import { reviewTasks } from '../../domain/tasks/selectors';
import { formatDate, localDate } from '../../domain/tasks/dates';
import type { ReviewDecision } from '../../domain/reviews/operations';
import { Modal } from '../Modal/Modal';
import { ReviewActions } from './ReviewActions';
import ui from '../../styles/controls.module.css';
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
  const [reviewId] = useState(() => crypto.randomUUID());
  const [ids] = useState(() =>
    reviewTasks(store.getSnapshot().tasks).map((task) => task.id),
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const task = snapshot.tasks.find((task) => task.id === ids[index]);
  const decide = async (decision: ReviewDecision) => {
    if (!task || busy) return;
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
        <p className={ui.muted}>
          Review items, not missed days. Each decision is saved immediately.
        </p>
        {index < ids.length && task ? (
          <>
            <p className={ui.muted}>
              {index + 1} of {ids.length} ·{' '}
              {formatDate(task.plannedCompletionDate)} · {task.status}
            </p>
            <h3 style={{ margin: 0 }}>{task.title}</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{task.finishCriteria}</p>
            <ReviewActions
              key={task.id}
              today={localDate()}
              busy={busy}
              onDecision={(decision) => void decide(decision)}
            />
          </>
        ) : index < ids.length ? (
          <>
            <p>This item is no longer available.</p>
            <button className={ui.button} onClick={() => setIndex(index + 1)}>
              Continue
            </button>
          </>
        ) : (
          <>
            <h3 style={{ margin: 0 }}>You’ve checked through your plan.</h3>
            <p>
              {ids.length
                ? `${ids.length} items reviewed.`
                : 'No unresolved short- or medium-term tasks.'}{' '}
              Tomorrow’s selections are saved. Anything left unresolved stays
              available for review.
            </p>
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
                  await store.finishReview(reviewId, ids, message);
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
