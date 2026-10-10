import { PlanningRepository } from '../storage/PlanningRepository';
import type {
  PlanningData,
  PlanningExport,
  ConflictChoices,
} from '../domain/transfer/types';
import type { Task, TaskInput, TaskStatus } from '../domain/tasks/types';
import type { ReviewAction } from '../domain/reviews/types';
import { editTask } from '../domain/tasks/operations';
import {
  applyReviewDecision,
  type ReviewDecision,
} from '../domain/reviews/operations';
import { localDate } from '../domain/tasks/dates';
export interface PlanningSnapshot extends PlanningData {
  ready: boolean;
  error: string | null;
}
export class PlanningStore {
  private snapshot: PlanningSnapshot = {
    tasks: [],
    notes: [],
    events: [],
    reviews: [],
    ready: false,
    error: null,
  };
  private listeners = new Set<() => void>();
  private channel?: BroadcastChannel;
  private sequence = 0;
  constructor(
    readonly repository = new PlanningRepository(),
    broadcast = true,
  ) {
    if (broadcast && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('anicca-planning-updates');
      this.channel.onmessage = () => void this.refresh();
    }
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  async refresh(): Promise<void> {
    const sequence = ++this.sequence;
    try {
      const data = await this.repository.read();
      if (sequence !== this.sequence) return;
      this.snapshot = { ...data, ready: true, error: null };
    } catch (error) {
      if (sequence !== this.sequence) return;
      this.snapshot = {
        ...this.snapshot,
        ready: true,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to read local storage.',
      };
    }
    this.listeners.forEach((listener) => listener());
  }
  private async changed() {
    await this.refresh();
    this.channel?.postMessage('changed');
  }
  async create(input: TaskInput) {
    const task = await this.repository.create(input);
    await this.changed();
    return task;
  }
  async edit(task: Task, input: TaskInput) {
    await this.repository.update(
      task.id,
      (current) => editTask(current, input),
      'edited',
      null,
      task.updatedAt,
    );
    await this.changed();
  }
  async status(task: Task, status: TaskStatus) {
    const result = await this.repository.update(
      task.id,
      (current) => editTask(current, { status }),
      status === 'completed'
        ? 'complete'
        : status === 'pending'
          ? 'reopen'
          : status === 'cancelled'
            ? 'cancel'
            : 'defer',
      null,
      task.updatedAt,
    );
    await this.changed();
    return result;
  }
  async undoCompletion(task: Task) {
    await this.repository.update(
      task.id,
      (current) => {
        if (current.status !== 'completed')
          throw new Error('This task has changed; reopen it to review.');
        return editTask(current, { status: 'pending' });
      },
      'reopen',
      null,
      task.updatedAt,
    );
    await this.changed();
  }
  async archive(task: Task, archived: boolean) {
    await this.repository.update(
      task.id,
      (current) => editTask(current, { archived }),
      'archive',
      null,
      task.updatedAt,
    );
    await this.changed();
  }
  async note(task: Task, text: string) {
    await this.repository.addNote(task.id, text);
    await this.changed();
  }
  async decide(
    task: Task,
    decision: ReviewDecision,
    reviewId: string | null = null,
  ) {
    const actions: Record<ReviewDecision['kind'], ReviewAction> = {
      complete: 'complete',
      cancel: 'cancel',
      defer: 'defer',
      leave: 'review',
      plan: 'reschedule',
      long: 'reschedule',
    };
    await this.repository.update(
      task.id,
      (current) => applyReviewDecision(current, decision, localDate()),
      actions[decision.kind],
      reviewId,
      task.updatedAt,
    );
    await this.changed();
  }
  async finishReview(id: string, taskIds: string[], message: string) {
    await this.repository.finishReview({
      id,
      date: localDate(),
      taskIds,
      message,
      completedAt: new Date().toISOString(),
    });
    await this.changed();
  }
  async export(): Promise<PlanningExport> {
    return {
      ...(await this.repository.read()),
      format: 'anicca-planning',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
    };
  }
  async import(data: PlanningData, choices: ConflictChoices) {
    await this.repository.import(data, choices);
    await this.changed();
  }
  async close() {
    this.channel?.close();
    await this.repository.close();
  }
}
