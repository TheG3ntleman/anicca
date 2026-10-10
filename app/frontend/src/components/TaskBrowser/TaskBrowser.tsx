import { useState } from 'react';
import type { PlanningStore } from '../../state/PlanningStore';
import type { Task } from '../../domain/tasks/types';
import { usePlanning } from '../../state/usePlanning';
import { alphabetical } from '../../domain/tasks/selectors';
import ui from '../../styles/controls.module.css';

export function TaskBrowser({
  store,
  onSelect,
}: {
  store: PlanningStore;
  onSelect: (task: Task) => void;
}) {
  const snapshot = usePlanning(store);
  const [query, setQuery] = useState('');
  const tasks = alphabetical(
    snapshot.tasks.filter((task) =>
      task.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ),
  );
  return (
    <div className={ui.stack}>
      <label className={ui.field}>
        Search all tasks
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {tasks.map((task) => (
        <button
          key={task.id}
          className={`${ui.button} ${ui.alignLeft}`}
          data-view-swipe-surface
          onClick={() => onSelect(task)}
        >
          {task.title}
          <br />
          <span className={ui.muted}>
            {task.status}
            {task.archived ? ' · Archived' : ''}
          </span>
        </button>
      ))}
      {!tasks.length && <p className={ui.muted}>No matching tasks.</p>}
    </div>
  );
}
