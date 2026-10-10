import { openDatabase, request, completion, STORES } from './database';
import type { PlanningData, ConflictChoices } from '../domain/transfer/types';
import type { Task, TaskInput, TaskNote } from '../domain/tasks/types';
import type {
  TaskEvent,
  ReviewAction,
  DayReview,
} from '../domain/reviews/types';
import { createTask } from '../domain/tasks/operations';
import { validateTask, validateNote } from '../domain/tasks/validation';
import { mergeData } from '../domain/transfer/merge';
import { validateExport } from '../domain/transfer/validation';

export class PlanningRepository {
  private database?: Promise<IDBDatabase>;
  constructor(private readonly name?: string) {}

  private getDatabase(): Promise<IDBDatabase> {
    // Retry after a failed open instead of caching a rejected connection forever.
    return (this.database ??= openDatabase(this.name).catch((error) => {
      this.database = undefined;
      throw error;
    }));
  }
  async read(): Promise<PlanningData> {
    const database = await this.getDatabase();
    const transaction = database.transaction([...STORES], 'readonly');
    const done = completion(transaction);
    const [tasks, notes, events, reviews] = await Promise.all(
      STORES.map((store) => request(transaction.objectStore(store).getAll())),
    );
    await done;
    return { tasks, notes, events, reviews };
  }
  async create(input: TaskInput): Promise<Task> {
    const task = createTask(input);
    await this.writeTask(task, null, 'created');
    return task;
  }
  async update(
    id: string,
    change: (task: Task) => Task,
    action: ReviewAction,
    reviewId: string | null = null,
    expectedUpdatedAt?: string,
  ): Promise<Task> {
    const database = await this.getDatabase();
    const transaction = database.transaction(['tasks', 'events'], 'readwrite');
    const done = completion(transaction);
    try {
      const before = await request<Task | undefined>(
        transaction.objectStore('tasks').get(id),
      );
      if (!before) throw new Error('This task no longer exists.');
      if (expectedUpdatedAt && before.updatedAt !== expectedUpdatedAt)
        throw new Error(
          'This task changed in another window. Reopen it before saving.',
        );
      const after = change(before);
      validateTask(after);
      if (after.id !== before.id)
        throw new Error('A task update cannot change its ID.');
      transaction.objectStore('tasks').put(after);
      transaction
        .objectStore('events')
        .add(this.event(before, after, action, reviewId));
      await done;
      return after;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        /* Already completed/aborted. */
      }
      await done.catch(() => {});
      throw error;
    }
  }
  private event(
    before: Task | null,
    after: Task,
    action: ReviewAction,
    reviewId: string | null,
  ): TaskEvent {
    return {
      id: crypto.randomUUID(),
      taskId: after.id,
      action,
      at: new Date().toISOString(),
      before,
      after,
      reviewId,
    };
  }
  private async writeTask(
    task: Task,
    before: Task | null,
    action: ReviewAction,
  ): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction(['tasks', 'events'], 'readwrite');
    const done = completion(transaction);
    transaction.objectStore('tasks').add(task);
    transaction
      .objectStore('events')
      .add(this.event(before, task, action, null));
    await done;
  }
  async addNote(taskId: string, text: string): Promise<void> {
    const now = new Date().toISOString();
    const note: TaskNote = {
      id: crypto.randomUUID(),
      taskId,
      text: text.trim(),
      createdAt: now,
      updatedAt: now,
    };
    validateNote(note);
    const database = await this.getDatabase();
    const transaction = database.transaction(['notes', 'tasks'], 'readwrite');
    const done = completion(transaction);
    try {
      if (!(await request(transaction.objectStore('tasks').get(taskId))))
        throw new Error('Task no longer exists.');
      transaction.objectStore('notes').add(note);
      await done;
    } catch (error) {
      try {
        transaction.abort();
      } catch {}
      await done.catch(() => {});
      throw error;
    }
  }
  async finishReview(review: DayReview): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction('reviews', 'readwrite');
    const done = completion(transaction);
    transaction.objectStore('reviews').add(review);
    await done;
  }
  async import(
    incoming: PlanningData,
    choices: ConflictChoices,
  ): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction([...STORES], 'readwrite');
    const done = completion(transaction);
    try {
      const [tasks, notes, events, reviews] = await Promise.all(
        STORES.map((store) => request(transaction.objectStore(store).getAll())),
      );
      const merged = mergeData(
        { tasks, notes, events, reviews },
        incoming,
        choices,
      );
      validateExport({
        ...merged,
        format: 'anicca-planning',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
      });
      for (const store of STORES)
        for (const record of merged[store])
          transaction.objectStore(store).put(record);
      await done;
    } catch (error) {
      try {
        transaction.abort();
      } catch {}
      await done.catch(() => {});
      throw error;
    }
  }
  async close(): Promise<void> {
    if (this.database) (await this.database).close();
  }
}
