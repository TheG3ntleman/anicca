import { createTask, editTask } from '../src/domain/tasks/operations';
import { addDays } from '../src/domain/tasks/dates';
import type { Task } from '../src/domain/tasks/types';
export function exampleTasks(today: string): Task[] {
  const task = (title: string, horizon: Task['horizon'], date: string | null) =>
    createTask({
      title,
      horizon,
      plannedCompletionDate: date,
      finishCriteria: `Finish ${title.toLowerCase()}.`,
      description: '',
    });
  return [
    task('Read chapter', 'short', today),
    task('Buy groceries', 'short', today),
    task('Call a friend', 'short', addDays(today, 1)),
    task('Prepare presentation', 'medium', addDays(today, 8)),
    task('Learn a language', 'long', null),
    task('Unresolved yesterday', 'short', addDays(today, -1)),
    editTask(task('Completed today', 'short', today), { status: 'completed' }),
    editTask(task('Deferred appointment', 'medium', null), {
      status: 'deferred',
    }),
    editTask(task('Cancelled task', 'long', null), { status: 'cancelled' }),
    editTask(task('Archived task', 'long', null), { archived: true }),
  ];
}
