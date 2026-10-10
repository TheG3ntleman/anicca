import { createTask, editTask } from '../src/domain/tasks/operations';
import { addDays } from '../src/domain/tasks/dates';
import type { Task } from '../src/domain/tasks/types';
export function exampleTasks(today: string): Task[] {
  const task = (title: string, date: string | null) =>
    createTask({
      title,
      plannedCompletionDate: date,
      finishCriteria: `Finish ${title.toLowerCase()}.`,
      description: '',
    });
  return [
    task('Read chapter', today),
    task('Buy groceries', today),
    task('Call a friend', addDays(today, 1)),
    task('Prepare presentation', addDays(today, 8)),
    task('Learn a language', null),
    task('Unresolved yesterday', addDays(today, -1)),
    editTask(task('Completed today', today), { status: 'completed' }),
    editTask(task('Deferred appointment', null), {
      status: 'deferred',
    }),
    editTask(task('Cancelled task', null), { status: 'cancelled' }),
    editTask(task('Archived task', null), { archived: true }),
  ];
}
