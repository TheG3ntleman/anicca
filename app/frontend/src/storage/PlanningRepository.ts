import {
  openDatabase,
  request,
  completion,
  STORES,
  MEDIA_STORE,
} from './database';
import type {
  PlanningData,
  PlanningExport,
  ConflictChoices,
} from '../domain/transfer/types';
import type { Task, TaskInput } from '../domain/tasks/types';
import type { Attachment, LogTarget } from '../domain/logs/types';
import type { PendingAttachment, StoredMedia } from '../media/types';
import { createLog, linkLog } from '../domain/logs/operations';
import { validateAttachment, MAX_LOG_BYTES } from '../domain/logs/validation';
import { readBlob, sha256 } from '../media/files';
import { encodeMedia, decodeMedia } from '../media/transfer';
import type {
  TaskEvent,
  ReviewAction,
  DayReview,
} from '../domain/reviews/types';
import { createTask } from '../domain/tasks/operations';
import { validateTask } from '../domain/tasks/validation';
import { mergeData } from '../domain/transfer/merge';
import {
  validateExport,
  validatePlanningData,
} from '../domain/transfer/validation';

export class PlanningRepository {
  private database?: Promise<IDBDatabase>;
  constructor(private readonly name?: string) {}

  private getDatabase(): Promise<IDBDatabase> {
    // Retry after a failed open instead of caching a rejected connection forever.
    return (this.database ??= openDatabase(this.name, () => {
      this.database = undefined;
    }).catch((error) => {
      this.database = undefined;
      throw error;
    }));
  }
  async read(): Promise<PlanningData> {
    const database = await this.getDatabase();
    const transaction = database.transaction([...STORES], 'readonly');
    const [data] = await Promise.all([
      this.readCollections(transaction),
      completion(transaction),
    ]);
    return data;
  }
  private async readCollections(
    transaction: IDBTransaction,
  ): Promise<PlanningData> {
    const [tasks, logs, logLinks, attachments, events, reviews] =
      await Promise.all(
        STORES.map((store) => request(transaction.objectStore(store).getAll())),
      );
    return { tasks, logs, logLinks, attachments, events, reviews };
  }
  async loadMedia(attachment: Attachment): Promise<Blob | undefined> {
    const database = await this.getDatabase();
    const transaction = database.transaction(MEDIA_STORE, 'readonly');
    const [media] = await Promise.all([
      request<StoredMedia | undefined>(
        transaction.objectStore(MEDIA_STORE).get(attachment.sha256),
      ),
      completion(transaction),
    ]);
    return media?.blob.slice(0, media.blob.size, attachment.mimeType);
  }
  async export(): Promise<PlanningExport> {
    const database = await this.getDatabase();
    const transaction = database.transaction(
      [...STORES, MEDIA_STORE],
      'readonly',
    );
    const [data, files] = await Promise.all([
      this.readCollections(transaction),
      request<StoredMedia[]>(transaction.objectStore(MEDIA_STORE).getAll()),
      completion(transaction),
    ]);
    const byHash = new Map(files.map((file) => [file.id, file]));
    const media: PlanningExport['media'] = [];
    for (const hash of new Set(
      data.attachments.map((attachment) => attachment.sha256),
    )) {
      const file = byHash.get(hash);
      if (!file)
        throw new Error('An attachment is missing from local storage.');
      media.push(await encodeMedia(file));
    }
    const exported: PlanningExport = {
      ...data,
      format: 'anicca-planning',
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      media,
    };
    validateExport(exported);
    return exported;
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
  async createLog(
    text: string,
    files: PendingAttachment[] = [],
    target?: LogTarget,
  ) {
    const log = createLog({
      text,
      attachmentIds: files.map((file) => file.metadata.id),
    });
    const link = target ? linkLog(log, target) : null;
    if (
      files.reduce((sum, file) => sum + file.metadata.size, 0) > MAX_LOG_BYTES
    )
      throw new Error('A log can contain up to 50 MB of media.');
    for (const file of files) {
      validateAttachment(file.metadata);
      if (
        file.blob.size !== file.metadata.size ||
        file.blob.type !== file.metadata.mimeType ||
        (await sha256(await readBlob(file.blob))) !== file.metadata.sha256
      )
        throw new Error('Attachment data does not match its metadata.');
    }
    const database = await this.getDatabase();
    const transaction = database.transaction(
      ['logs', 'logLinks', 'attachments', MEDIA_STORE, 'tasks'],
      'readwrite',
    );
    const done = completion(transaction);
    try {
      if (
        target &&
        !(await request(transaction.objectStore('tasks').get(target.id)))
      )
        throw new Error('Task no longer exists.');
      transaction.objectStore('logs').add(log);
      if (link) transaction.objectStore('logLinks').add(link);
      for (const file of files) {
        transaction.objectStore('attachments').add(file.metadata);
        transaction
          .objectStore(MEDIA_STORE)
          .put({ id: file.metadata.sha256, blob: file.blob });
      }
      await done;
      return log;
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
    incoming: PlanningExport,
    choices: ConflictChoices,
  ): Promise<void> {
    validateExport(incoming);
    const files = await decodeMedia(incoming.media, incoming.attachments);
    const database = await this.getDatabase();
    const transaction = database.transaction(
      [...STORES, MEDIA_STORE],
      'readwrite',
    );
    const done = completion(transaction);
    try {
      const local = await this.readCollections(transaction);
      const merged = mergeData(local, incoming, choices);
      validatePlanningData(merged);
      for (const store of STORES)
        for (const record of merged[store])
          transaction.objectStore(store).put(record);
      for (const file of files) transaction.objectStore(MEDIA_STORE).put(file);
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
