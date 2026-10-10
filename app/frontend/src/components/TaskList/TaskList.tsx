import type { Task } from '../../domain/tasks/types';
import { formatDate } from '../../domain/tasks/dates';
import { needsReview } from '../../domain/tasks/selectors';
import styles from './TaskList.module.css';
export function TaskList({
  tasks,
  today,
  onSelect,
  onToggle,
  empty = 'Nothing here yet.',
}: {
  tasks: Task[];
  today: string;
  onSelect: (task: Task) => void;
  onToggle: (task: Task) => Promise<void>;
  empty?: string;
}) {
  return tasks.length ? (
    <ul className={styles.list}>
      {tasks.map((task) => (
        <li
          key={task.id}
          className={styles.item}
          data-complete={task.status === 'completed'}
        >
          <button
            type="button"
            className={styles.check}
            aria-label={`${task.status === 'completed' ? 'Reopen' : 'Complete'} ${task.title}`}
            aria-pressed={task.status === 'completed'}
            onClick={() => void onToggle(task)}
          >
            {task.status === 'completed' ? '✓' : '○'}
          </button>
          <button
            type="button"
            data-swipe-surface
            className={styles.content}
            onClick={() => onSelect(task)}
          >
            <span className={styles.title}>{task.title}</span>
            <span className={styles.meta}>
              {formatDate(task.plannedCompletionDate, today)}
              {task.status === 'deferred' ? ' · Deferred' : ''}
              {needsReview(task, today) ? ' · Needs review' : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  ) : (
    <p className={styles.empty}>{empty}</p>
  );
}
