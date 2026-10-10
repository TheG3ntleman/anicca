import assert from 'node:assert/strict';
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTask, editTask } from '../src/domain/tasks/operations';
import { addDays, localDate, validDate } from '../src/domain/tasks/dates';
import {
  needsReview,
  reviewTasks,
  todayTasks,
  layerTasks,
  planningLayer,
  tomorrowTasks,
} from '../src/domain/tasks/selectors';
import { applyReviewDecision } from '../src/domain/reviews/operations';
import { parseExport } from '../src/domain/transfer/validation';
import { importConflicts } from '../src/domain/transfer/merge';
import type { PlanningExport } from '../src/domain/transfer/types';
import { PlanningRepository } from '../src/storage/PlanningRepository';
import { PlanningStore } from '../src/state/PlanningStore';
import { Planning } from '../src/components/Planning/Planning';
import {
  ViewOverlay,
  type OverlayView,
} from '../src/components/ViewOverlay/ViewOverlay';
import type { Task } from '../src/domain/tasks/types';
import { STORES, request } from '../src/storage/database';
import { exampleTasks } from './fixtures';
import { TaskDetails } from '../src/components/TaskDetails/TaskDetails';
import { ReviewFlow } from '../src/components/Review/ReviewFlow';
import { viewportFrame, initializeViewport } from '../src/viewport';
import { runLogTests } from './logs.test';

const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, run: () => void | Promise<void>) =>
  tests.push([name, run]);
const today = localDate();
const input = (title = 'Write proposal') => ({
  title,
  finishCriteria: 'Send a complete draft.',
  description: '',
  plannedCompletionDate: today,
});
const repository = (name: string) =>
  new PlanningRepository(`test-${name}-${crypto.randomUUID()}`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('calendar dates use local days and reject impossible dates', () => {
  assert.equal(localDate(new Date(2026, 9, 10, 0, 1)), '2026-10-10');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(validDate('2026-02-29'), false);
  assert.equal(validDate('2026-04-31'), false);
});

test('representative task states select the right layers and review queue', () => {
  const tasks = exampleTasks(today);
  assert.deepEqual(
    todayTasks(tasks, today).map((task) => task.title),
    ['Buy groceries', 'Completed today', 'Read chapter'],
  );
  assert.equal(tasks.filter((task) => needsReview(task, today)).length, 2);
  assert.equal(todayTasks(tasks, addDays(today, 1)).length, 1);
  assert.equal(needsReview(tasks[0], addDays(today, 1)), true);
  assert.deepEqual(
    layerTasks(tasks, 'long', today).map((task) => task.title),
    ['Learn a language'],
  );
  assert.deepEqual(
    reviewTasks(tasks, today).map((task) => task.title),
    [
      'Buy groceries',
      'Deferred appointment',
      'Read chapter',
      'Unresolved yesterday',
    ],
  );
  assert.ok(
    reviewTasks(tasks, addDays(today, 1)).some(
      (task) => task.title === 'Call a friend',
    ),
  );
  const deferredFuture = editTask(tasks[2], { status: 'deferred' });
  assert.equal(needsReview(deferredFuture, today), false);
  assert.deepEqual(reviewTasks([deferredFuture], today), []);
});

test('task invariants and review decisions preserve intent without deadlines', () => {
  assert.throws(() => createTask({ ...input(), title: ' ' }));
  assert.throws(() => createTask({ ...input(), horizon: 'long' }));
  const task = createTask(input());
  const deferred = applyReviewDecision(task, { kind: 'defer' });
  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.plannedCompletionDate, null);
  assert.equal(needsReview(deferred, today), true);
  const tomorrow = applyReviewDecision(deferred, {
    kind: 'plan',
    date: addDays(today, 1),
  });
  assert.equal(tomorrow.status, 'pending');
  assert.equal(planningLayer(tomorrow, today), 'short');
  assert.equal(
    planningLayer(
      applyReviewDecision(task, { kind: 'plan', date: addDays(today, 10) }),
      today,
    ),
    'medium',
  );
  assert.equal(
    applyReviewDecision(task, { kind: 'unschedule' }).plannedCompletionDate,
    null,
  );
  assert.throws(() =>
    applyReviewDecision(task, { kind: 'plan', date: '2026-02-31' }),
  );
});

test('dates automatically move tasks between layers without changing records', () => {
  const date = '2026-12-31';
  const task = createTask({
    ...input(),
    plannedCompletionDate: addDays(date, 2),
  });
  const original = structuredClone(task);
  assert.deepEqual(layerTasks([task], 'medium', date), [task]);
  assert.deepEqual(layerTasks([task], 'medium', addDays(date, 1)), []);
  assert.deepEqual(tomorrowTasks([task], addDays(date, 1)), [task]);
  assert.deepEqual(todayTasks([task], addDays(date, 2)), [task]);
  assert.deepEqual(todayTasks([task], addDays(date, 3)), []);
  assert.equal(needsReview(task, addDays(date, 3)), true);
  for (const layer of ['short', 'medium', 'long'] as const)
    assert.deepEqual(layerTasks([task], layer, addDays(date, 3)), []);
  assert.deepEqual(task, original);

  const deferred = applyReviewDecision(task, { kind: 'defer' });
  assert.deepEqual(layerTasks([deferred], 'long', date), []);
  assert.deepEqual(reviewTasks([deferred], today), [deferred]);
  assert.equal(
    needsReview(editTask(deferred, { title: 'Revised task' }), date),
    true,
  );
  const scheduled = editTask(deferred, { plannedCompletionDate: date });
  assert.equal(scheduled.status, 'pending');
  assert.deepEqual(todayTasks([scheduled], date), [scheduled]);
  const unscheduled = applyReviewDecision(deferred, { kind: 'unschedule' });
  assert.deepEqual(layerTasks([unscheduled], 'long', date), [unscheduled]);
  assert.equal(needsReview(unscheduled, date), false);
});

function legacyExport(data: PlanningExport) {
  const legacyTask = (task: Task) => ({
    ...task,
    // v1 could contain stale or mismatched layers. Keep the date unchanged.
    horizon:
      task.status === 'deferred'
        ? 'medium'
        : task.plannedCompletionDate
          ? 'short'
          : 'long',
  });
  return {
    format: data.format,
    exportedAt: data.exportedAt,
    reviews: data.reviews,
    notes: data.logLinks.map((link) => {
      const log = data.logs.find((log) => log.id === link.logId)!;
      return {
        id: log.id,
        taskId: link.targetId,
        text: log.text,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      };
    }),
    schemaVersion: 1,
    tasks: data.tasks.map(legacyTask),
    events: data.events.map((event) => ({
      ...event,
      before: event.before === null ? null : legacyTask(event.before),
      after: legacyTask(event.after),
    })),
  };
}

const LEGACY_STORES = ['tasks', 'notes', 'events', 'reviews'] as const;
type LegacyExport = ReturnType<typeof legacyExport>;
async function seedLegacyDatabase(name: string, data: LegacyExport) {
  await new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open(name, 1);
    opening.onupgradeneeded = () => {
      for (const store of LEGACY_STORES) {
        const collection = opening.result.createObjectStore(store, {
          keyPath: 'id',
        });
        for (const record of data[store]) collection.add(record);
      }
    };
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      opening.result.close();
      resolve();
    };
  });
}

test('version 1 database and export migrations preserve every record and history snapshot', async () => {
  const source = new PlanningStore(repository('migration-source'), false);
  const name = `test-v1-upgrade-${crypto.randomUUID()}`;
  const upgraded = new PlanningStore(new PlanningRepository(name), false);
  const restored = new PlanningStore(repository('v1-import'), false);
  try {
    const task = await source.create({
      ...input(),
      plannedCompletionDate: addDays(today, 8),
    });
    await source.createLog('Preserve this note.', [], {
      type: 'task',
      id: task.id,
    });
    const reviewId = crypto.randomUUID();
    await source.decide(task, { kind: 'defer' }, reviewId);
    await source.finishReview(reviewId, [task.id], 'Good job.');
    const expected = await source.export();
    const legacy = legacyExport(expected);
    assert.deepEqual(parseExport(JSON.stringify(legacy)), expected);
    await seedLegacyDatabase(name, legacy);
    const migrated = await upgraded.export();
    assert.equal(migrated.schemaVersion, 3);
    for (const store of STORES)
      assert.deepEqual(migrated[store], expected[store]);
    assert.equal(needsReview(migrated.tasks[0], today), true);
    await upgraded.close();
    const reopened = new PlanningRepository(name);
    try {
      assert.deepEqual(await reopened.read(), {
        tasks: expected.tasks,
        logs: expected.logs,
        logLinks: expected.logLinks,
        attachments: expected.attachments,
        events: expected.events,
        reviews: expected.reviews,
      });
    } finally {
      await reopened.close();
    }
    await restored.import(parseExport(JSON.stringify(legacy)), {});
    await restored.import(parseExport(JSON.stringify(legacy)), {});
    for (const store of STORES)
      assert.deepEqual((await restored.export())[store], expected[store]);
    const malformed = structuredClone(legacy);
    malformed.events[0].after.horizon = 'invalid';
    assert.throws(
      () => parseExport(JSON.stringify(malformed)),
      /version 1 planning layer/,
    );
  } finally {
    await source.close();
    await upgraded.close();
    await restored.close();
  }
});

test('a failed version 1 upgrade rolls back instead of partially migrating data', async () => {
  const source = new PlanningStore(
    repository('migration-rollback-source'),
    false,
  );
  const name = `test-v1-rollback-${crypto.randomUUID()}`;
  const upgraded = new PlanningRepository(name);
  try {
    await source.create(input());
    const legacy = legacyExport(await source.export());
    // Tasks can be migrated before the malformed history cursor aborts the upgrade.
    legacy.events[0].after.horizon = 'invalid';
    await seedLegacyDatabase(name, legacy);
    await assert.rejects(upgraded.read(), /version 1 planning layer/);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(name, 1);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    try {
      assert.equal(database.version, 1);
      const transaction = database.transaction([...LEGACY_STORES], 'readonly');
      const records = await Promise.all(
        LEGACY_STORES.map((store) =>
          request(transaction.objectStore(store).getAll()),
        ),
      );
      LEGACY_STORES.forEach((store, index) =>
        assert.deepEqual(records[index], legacy[store]),
      );
    } finally {
      database.close();
    }
  } finally {
    await source.close();
    await upgraded.close();
  }
});

test('tasks, notes, and history survive closing and reopening the database', async () => {
  const name = `test-persistence-${crypto.randomUUID()}`;
  const first = new PlanningRepository(name);
  const task = await first.create(input());
  await first.createLog('Worked on the introduction.', [], {
    type: 'task',
    id: task.id,
  });
  const completed = await first.update(
    task.id,
    (current) => editTask(current, { status: 'completed' }),
    'complete',
  );
  await first.close();
  const reopened = new PlanningRepository(name);
  try {
    const data = await reopened.read();
    assert.equal(data.tasks[0].status, 'completed');
    assert.equal(data.tasks[0].completedAt, completed.completedAt);
    assert.equal(data.logs[0].text, 'Worked on the introduction.');
    assert.equal(data.events.length, 2);
    const event = data.events.find((event) => event.action === 'complete')!;
    assert.equal(event.before!.status, 'pending');
    assert.equal(event.after.status, 'completed');
  } finally {
    await reopened.close();
  }
});

test('stale edits and undo never overwrite newer work', async () => {
  const store = new PlanningStore(repository('concurrency'), false);
  try {
    const original = await store.create(input());
    const completed = await store.status(original, 'completed');
    await store.edit(completed, { ...input('Revised proposal') });
    await assert.rejects(store.undoCompletion(completed), /changed/);
    await assert.rejects(store.edit(original, input('Stale draft')), /changed/);
    assert.equal((await store.export()).tasks[0].title, 'Revised proposal');
    assert.equal(store.getSnapshot().events.length, 3);
    const current = store.getSnapshot().tasks[0];
    await store.undoCompletion(current);
    assert.equal(store.getSnapshot().tasks[0].status, 'pending');
    assert.equal(store.getSnapshot().tasks[0].completedAt, null);
  } finally {
    await store.close();
  }
});

test('storage can recover after an unavailable database without reloading', async () => {
  const database = globalThis.indexedDB;
  const store = new PlanningStore(repository('retry'), false);
  try {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
    await store.refresh();
    assert.match(store.getSnapshot().error!, /unavailable/);
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: database,
    });
    await store.refresh();
    assert.equal(store.getSnapshot().error, null);
    await store.create(input());
    assert.equal(store.getSnapshot().tasks.length, 1);
  } finally {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: database,
    });
    await store.close();
  }
});

test('failed writes roll back task and event records together', async () => {
  const repo = repository('rollback');
  try {
    const task = await repo.create(input());
    await assert.rejects(
      repo.update(task.id, (current) => ({ ...current, title: '' }), 'edited'),
    );
    await assert.rejects(
      repo.createLog('Note', [], { type: 'task', id: 'missing-task' }),
    );
    const data = await repo.read();
    assert.equal(data.tasks[0].title, task.title);
    assert.equal(data.events.length, 1);
    assert.equal(data.logs.length, 0);
  } finally {
    await repo.close();
  }
});

test('review decisions persist before finishing and completed reviews are unique', async () => {
  const store = new PlanningStore(repository('review'), false);
  try {
    const task = await store.create(input());
    const reviewId = crypto.randomUUID();
    await store.decide(
      task,
      { kind: 'plan', date: addDays(today, 1) },
      reviewId,
    );
    const interrupted = parseExport(JSON.stringify(await store.export()));
    assert.equal(interrupted.reviews.length, 0);
    assert.equal(interrupted.tasks[0].plannedCompletionDate, addDays(today, 1));
    assert.equal(
      interrupted.events.find((event) => event.reviewId === reviewId)!.action,
      'reschedule',
    );
    await store.finishReview(reviewId, [task.id], 'Good job.');
    await assert.rejects(store.finishReview(reviewId, [task.id], 'Good job.'));
    assert.equal((await store.export()).reviews.length, 1);
  } finally {
    await store.close();
  }
});

test('export restores every collection and repeated imports do not duplicate records', async () => {
  const source = new PlanningStore(repository('source'), false);
  const target = new PlanningStore(repository('target'), false);
  try {
    const task = await source.create(input());
    await source.createLog('A private note.', [], {
      type: 'task',
      id: task.id,
    });
    const reviewId = crypto.randomUUID();
    await source.decide(task, { kind: 'complete' }, reviewId);
    await source.finishReview(reviewId, [task.id], 'Another day has passed.');
    const exported = parseExport(JSON.stringify(await source.export()));
    await target.import(exported, {});
    await target.import(exported, {});
    const restored = await target.export();
    for (const key of STORES) assert.deepEqual(restored[key], exported[key]);
  } finally {
    await source.close();
    await target.close();
  }
});

test('imports require conflict decisions and retain both histories', async () => {
  const store = new PlanningStore(repository('merge'), false);
  try {
    const task = await store.create(input());
    const older = await store.export();
    await store.edit(task, input('New local title'));
    const conflicts = importConflicts(await store.export(), older);
    assert.equal(conflicts.length, 1);
    await assert.rejects(store.import(older, {}), /every conflict/);
    assert.equal(store.getSnapshot().tasks[0].title, 'New local title');
    await store.import(older, { [conflicts[0].key]: 'local' });
    assert.equal(store.getSnapshot().tasks[0].title, 'New local title');
    await store.import(older, { [conflicts[0].key]: 'incoming' });
    assert.equal(store.getSnapshot().tasks[0].title, task.title);
    assert.equal(store.getSnapshot().events.length, 2);
  } finally {
    await store.close();
  }
});

test('malformed or future exports are rejected before import writes', async () => {
  const store = new PlanningStore(repository('invalid-import'), false);
  try {
    await store.create(input());
    const data = await store.export();
    assert.throws(() => parseExport('{broken'));
    assert.throws(() =>
      parseExport(JSON.stringify({ ...data, schemaVersion: 99 })),
    );
    assert.throws(() =>
      parseExport(
        JSON.stringify({ ...data, tasks: [...data.tasks, data.tasks[0]] }),
      ),
    );
    const broken: PlanningExport = {
      ...data,
      logs: [
        {
          id: 'orphan-log',
          text: 'Orphan',
          attachmentIds: [],
          createdAt: data.exportedAt,
          updatedAt: data.exportedAt,
        },
      ],
      logLinks: [
        {
          id: crypto.randomUUID(),
          logId: 'orphan-log',
          targetType: 'task',
          targetId: 'missing',
          createdAt: data.exportedAt,
        },
      ],
    };
    await assert.rejects(store.import(broken, {}), /missing task/);
    assert.equal((await store.export()).logs.length, 0);
  } finally {
    await store.close();
  }
});

// Exercise actual React forms and controls, in addition to domain/repository tests.
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await act(async () => {
      await sleep(10);
    });
  }
  throw new Error('Timed out waiting for UI update.');
}
function button(name: string): HTMLButtonElement {
  const result = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find(
    (element) =>
      (element.getAttribute('aria-label') ?? element.textContent?.trim()) ===
      name,
  );
  assert.ok(result, `Missing button: ${name}`);
  return result;
}
async function click(name: string) {
  await act(async () => {
    button(name).click();
  });
}
async function fill(label: string, value: string) {
  const field = [...document.querySelectorAll('label')]
    .find((element) => element.textContent?.startsWith(label))
    ?.querySelector('input,textarea,select') as HTMLInputElement;
  assert.ok(field, `Missing field: ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(field),
      'value',
    )!.set!.call(field, value);
    field.dispatchEvent(
      new Event(field.tagName === 'SELECT' ? 'change' : 'input', {
        bubbles: true,
      }),
    );
  });
}

test('UI creates, completes, undoes, edits, adds notes, navigates and reviews tasks', async () => {
  const store = new PlanningStore(repository('ui'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(<Planning store={store} />);
    });
    await waitFor(() => store.getSnapshot().ready);
    await click('Create a new task');
    await waitFor(
      () =>
        document.querySelector('dialog')?.getAttribute('data-phase') === 'open',
    );
    await fill('Title', 'Test task');
    await fill('What does finished look like?', 'A working result.');
    await click('Add task');
    await waitFor(
      () =>
        store.getSnapshot().tasks.length === 1 &&
        !document.querySelector('dialog'),
    );
    assert.equal(store.getSnapshot().tasks[0].title, 'Test task');
    await click('Complete Test task');
    await waitFor(() => store.getSnapshot().tasks[0].status === 'completed');
    await click('Undo');
    await waitFor(() => store.getSnapshot().tasks[0].status === 'pending');
    const title = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ].find((element) => element.textContent?.startsWith('Test task'))!;
    await act(async () => title.click());
    await fill('Write a log', 'Made a start.');
    await click('Save log');
    await waitFor(() => store.getSnapshot().logs.length === 1);
    await click('Edit');
    await fill('Title', 'Edited task');
    await click('Save changes');
    await waitFor(
      () =>
        store.getSnapshot().tasks[0].title === 'Edited task' &&
        !document.querySelector('legend'),
    );
    await click('Close');
    await click('Next planning layer');
    assert.equal(document.querySelector('h2')!.textContent, 'Medium term');
    await click('Next planning layer');
    assert.equal(document.querySelector('h2')!.textContent, 'Long term');
    await click('Return to Today');
    await click('Finish day');
    await click('Plan tomorrow');
    await waitFor(() =>
      Boolean(
        document.body.textContent?.includes(
          'You’ve checked through your plan.',
        ),
      ),
    );
    await click('Finish review');
    await waitFor(
      () =>
        store.getSnapshot().reviews.length === 1 &&
        [...document.querySelectorAll('[role="status"]')].some((element) =>
          element.textContent?.includes('Good job.'),
        ),
    );
    assert.equal(
      store.getSnapshot().tasks[0].plannedCompletionDate,
      addDays(today, 1),
    );
    assert.equal(
      document.querySelector('dialog')?.querySelectorAll('button').length,
      0,
    );
    await act(async () => {
      await sleep(2000);
    });
    assert.equal(document.querySelector('dialog'), null);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('UI distinguishes vertical scrolling from swipe-to-create and normalizes scheduling', async () => {
  const store = new PlanningStore(repository('swipe-ui'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const pointer = (target: Element, type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerType: { value: 'touch' },
      isPrimary: { value: true },
      clientX: { value: x },
      clientY: { value: y },
    });
    target.dispatchEvent(event);
  };
  try {
    await act(async () => root.render(<Planning store={store} />));
    await waitFor(() => store.getSnapshot().ready);
    const heading = document.querySelector('h2')!;
    await act(async () => {
      pointer(heading, 'pointerdown', 200, 100);
      pointer(heading, 'pointerup', 195, 300);
    });
    assert.equal(document.querySelector('dialog'), null);
    assert.equal(heading.textContent, 'Today');
    await act(async () => {
      pointer(heading, 'pointerdown', 200, 100);
      pointer(heading, 'pointerup', 50, 110);
    });
    assert.equal(
      document.querySelector('dialog')?.getAttribute('aria-label'),
      'New task',
    );
    await waitFor(
      () =>
        document.querySelector('dialog')?.getAttribute('data-phase') === 'open',
    );
    await fill('Title', 'An unscheduled idea');
    await fill('What does finished look like?', 'A future result.');
    await act(async () => {
      await sleep(360);
    });
    await click('Choose a date');
    await fill('Planned completion date', '');
    assert.equal(document.querySelector('select'), null);
    await click('Add task');
    await waitFor(() => store.getSnapshot().tasks.length === 1);
    assert.equal(planningLayer(store.getSnapshot().tasks[0], today), 'long');
    assert.equal(store.getSnapshot().tasks[0].plannedCompletionDate, null);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('UI schedules and reschedules using dates alone across all planning layers', async () => {
  const store = new PlanningStore(repository('date-ui'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const selectTask = async () => {
    const task = [
      ...container.querySelectorAll<HTMLButtonElement>('[data-swipe-surface]'),
    ].find((element) => element.textContent?.startsWith('Date-driven task'));
    assert.ok(task);
    await act(async () => task.click());
  };
  try {
    await act(async () => root.render(<Planning store={store} />));
    await waitFor(() => store.getSnapshot().ready);
    await click('Next planning layer');
    await click('Next planning layer');
    await click('Create a new task');
    await waitFor(
      () =>
        document.querySelector('dialog')?.getAttribute('data-phase') === 'open',
    );
    assert.equal(document.querySelector('select'), null);
    assert.equal(
      button('Not scheduled yet').getAttribute('aria-pressed'),
      'true',
    );
    await click('Today');
    assert.equal(button('Today').getAttribute('aria-pressed'), 'true');
    await click('Tomorrow');
    assert.equal(button('Tomorrow').getAttribute('aria-pressed'), 'true');
    await click('Not scheduled yet');
    assert.equal(
      button('Not scheduled yet').getAttribute('aria-pressed'),
      'true',
    );
    await fill('Title', 'Date-driven task');
    await fill('What does finished look like?', 'A result.');
    await click('Choose a date');
    await fill('Planned completion date', addDays(today, 3));
    await click('Add task');
    await waitFor(
      () =>
        store.getSnapshot().tasks.length === 1 &&
        !document.querySelector('dialog'),
    );
    assert.equal(planningLayer(store.getSnapshot().tasks[0], today), 'medium');
    assert.equal(container.querySelector('[data-swipe-surface]'), null);
    await click('Previous planning layer');
    await selectTask();
    await click('Edit');
    await click('Not scheduled yet');
    await click('Save changes');
    await waitFor(
      () =>
        store.getSnapshot().tasks[0].plannedCompletionDate === null &&
        !document.querySelector('legend'),
    );
    await click('Close');
    assert.equal(container.querySelector('[data-swipe-surface]'), null);
    await click('Next planning layer');
    await selectTask();
    await click('Edit');
    await click('Tomorrow');
    await click('Save changes');
    await waitFor(
      () =>
        store.getSnapshot().tasks[0].plannedCompletionDate ===
          addDays(today, 1) && !document.querySelector('legend'),
    );
    await click('Close');
    assert.equal(container.querySelector('[data-swipe-surface]'), null);
    await click('Return to Today');
    await selectTask();
    assert.deepEqual(
      tomorrowTasks(store.getSnapshot().tasks, today),
      store.getSnapshot().tasks,
    );
    assert.deepEqual(
      layerTasks(store.getSnapshot().tasks, 'medium', today),
      [],
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('creation panel follows slow drags, reverses, cancels, and settles open on release', async () => {
  const store = new PlanningStore(repository('interactive-swipe'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const pointer = (
    target: Element,
    type: string,
    x: number,
    y: number,
    at: number,
  ) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerType: { value: 'touch' },
      isPrimary: { value: true },
      pointerId: { value: 1 },
      clientX: { value: x },
      clientY: { value: y },
      timeStamp: { value: at },
    });
    target.dispatchEvent(event);
  };
  const dispatch = async (type: string, x: number, y: number, at: number) => {
    await act(async () =>
      pointer(container.querySelector('h2')!, type, x, y, at),
    );
  };
  try {
    await act(async () => root.render(<Planning store={store} />));
    await waitFor(() => store.getSnapshot().ready);
    // A vertical gesture never mounts a preview.
    await dispatch('pointerdown', 500, 100, 0);
    await dispatch('pointermove', 495, 180, 200);
    await dispatch('pointerup', 490, 250, 500);
    assert.equal(container.querySelector('dialog'), null);
    // Finger movement changes the actual panel transform before release.
    await dispatch('pointerdown', 500, 100, 1000);
    await dispatch('pointermove', 400, 102, 1400);
    const preview = container.querySelector('dialog')!;
    assert.equal(preview.getAttribute('data-phase'), 'dragging');
    assert.equal(preview.style.getPropertyValue('--panel-offset'), '520px');
    assert.equal(preview.querySelector('section')!.hasAttribute('inert'), true);
    await dispatch('pointermove', 300, 104, 1800);
    assert.equal(preview.style.getPropertyValue('--panel-offset'), '420px');
    // Reversing towards the starting point follows the finger, then returns closed.
    await dispatch('pointermove', 470, 103, 2200);
    assert.equal(preview.style.getPropertyValue('--panel-offset'), '590px');
    await dispatch('pointerup', 470, 103, 2400);
    assert.equal(preview.getAttribute('data-phase'), 'closing');
    await waitFor(() => !container.querySelector('dialog'));
    assert.equal(store.getSnapshot().tasks.length, 0);
    // Interrupted drags reset instead of leaving an orphaned preview.
    await dispatch('pointerdown', 500, 100, 3000);
    await dispatch('pointermove', 400, 100, 3400);
    await dispatch('pointercancel', 400, 100, 3500);
    await waitFor(() => !container.querySelector('dialog'));
    // A deliberately slow drag can open; there is no old 800ms timeout.
    await dispatch('pointerdown', 500, 100, 4000);
    await dispatch('pointermove', 250, 105, 6000);
    assert.equal(
      container.querySelector('dialog')!.getAttribute('data-phase'),
      'dragging',
    );
    await dispatch('pointerup', 250, 105, 6200);
    assert.equal(
      container.querySelector('dialog')!.getAttribute('data-phase'),
      'opening',
    );
    assert.equal(
      container
        .querySelector('dialog')!
        .style.getPropertyValue('--panel-offset'),
      '0px',
    );
    await waitFor(
      () =>
        container.querySelector('dialog')?.getAttribute('data-phase') ===
        'open',
    );
    await act(async () => {
      await sleep(360);
    });
    await click('Close');
    assert.equal(
      container.querySelector('dialog')!.getAttribute('data-phase'),
      'closing',
    );
    await waitFor(() => !container.querySelector('dialog'));
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('a creation swipe on a task suppresses the following task-detail click', async () => {
  const store = new PlanningStore(repository('swipe-click'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await store.create(input('Swipe surface'));
    await act(async () => root.render(<Planning store={store} />));
    const target = container.querySelector<HTMLButtonElement>(
      '[data-swipe-surface]',
    )!;
    await act(async () => {
      for (const [type, x] of [
        ['pointerdown', 300],
        ['pointermove', 150],
        ['pointerup', 150],
      ] as const) {
        const event = new Event(type, { bubbles: true });
        Object.defineProperties(event, {
          pointerType: { value: 'touch' },
          isPrimary: { value: true },
          pointerId: { value: 2 },
          clientX: { value: x },
          clientY: { value: 100 },
        });
        target.dispatchEvent(event);
      }
      target.click();
    });
    assert.equal(container.querySelectorAll('dialog').length, 1);
    assert.equal(
      container.querySelector('dialog')!.getAttribute('aria-label'),
      'New task',
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('closing a partial UI review keeps decisions without recording a finished review', async () => {
  const store = new PlanningStore(repository('partial-review-ui'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await store.create(input('A first task'));
    await store.create(input('B second task'));
    await act(async () => root.render(<Planning store={store} />));
    await click('Finish day');
    await click('Defer');
    await click('Save decision');
    await waitFor(() =>
      store.getSnapshot().tasks.some((task) => task.status === 'deferred'),
    );
    await click('Close');
    assert.equal(store.getSnapshot().reviews.length, 0);
    assert.equal(
      store.getSnapshot().events.filter((event) => event.reviewId).length,
      1,
    );
    assert.equal(
      store.getSnapshot().tasks.find((task) => task.title === 'A first task')!
        .status,
      'deferred',
    );
    assert.equal(document.querySelector('dialog'), null);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('tools open on all tasks, preserve search on return, and retain existing descriptions', async () => {
  const store = new PlanningStore(repository('tools-browser'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    const tasks = exampleTasks(today);
    const archived = tasks.find((task) => task.archived)!;
    archived.description = 'Keep this older description.';
    await store.import(
      {
        format: 'anicca-planning',
        schemaVersion: 3,
        exportedAt: new Date().toISOString(),
        tasks,
        logs: [],
        logLinks: [],
        attachments: [],
        media: [],
        events: [],
        reviews: [],
      },
      {},
    );
    await act(async () => root.render(<Planning store={store} />));
    await act(async () => store.refresh());
    await click('Open task browser and tools');
    const overlay = container.querySelector('dialog')!;
    assert.equal(overlay.getAttribute('data-current-view'), 'tasks');
    const page = overlay.querySelector<HTMLElement>(
      '[data-overlay-page="tasks"]',
    )!;
    assert.equal(
      page.querySelectorAll('[data-view-swipe-surface]').length,
      tasks.length,
    );
    assert.ok(page.textContent?.includes('Completed today'));
    assert.ok(page.textContent?.includes('Cancelled task'));
    assert.ok(page.textContent?.includes('Archived'));
    await fill('Search all tasks', 'Archived');
    page.scrollTop = 77;
    await act(async () =>
      page.querySelector<HTMLButtonElement>('button')!.click(),
    );
    assert.equal(container.querySelectorAll('dialog').length, 2);
    assert.equal(button('Close overlay').disabled, true);
    await click('Edit');
    assert.equal(
      [...container.querySelectorAll('label')].some((label) =>
        label.textContent?.startsWith('Description'),
      ),
      false,
    );
    assert.equal(
      container.querySelector('legend')?.textContent,
      'When would you like to finish this? (An intention, not a deadline. You can change it whenever you need.)',
    );
    await fill('Title', 'Archived revised task');
    await click('Save changes');
    await waitFor(
      () =>
        store
          .getSnapshot()
          .tasks.some((task) => task.title === 'Archived revised task') &&
        !container.querySelector('legend'),
    );
    assert.equal(
      store.getSnapshot().tasks.find((task) => task.id === archived.id)!
        .description,
      archived.description,
    );
    await click('Close');
    assert.equal(container.querySelectorAll('dialog').length, 1);
    assert.equal(page.querySelector('input')!.value, 'Archived');
    assert.equal(page.scrollTop, 77);
    await click('Import/export');
    assert.equal(overlay.getAttribute('data-current-view'), 'transfer');
    assert.equal(page.hasAttribute('inert'), true);
    await click('Tasks');
    assert.equal(page.querySelector('input')!.value, 'Archived');
    assert.equal(page.scrollTop, 77);
    await click('Close overlay');
    assert.equal(container.querySelector('dialog'), null);
    await click('Open task browser and tools');
    assert.equal(
      container.querySelector('dialog')?.getAttribute('data-current-view'),
      'tasks',
    );
    assert.equal(
      container
        .querySelector('[data-overlay-page="tasks"] input')!
        .getAttribute('value'),
      '',
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('circular pages and labels follow the pointer, wrap both ways, and respect scrolling and cancellation', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let selections = 0;
  const views = [
    {
      id: 'a',
      label: 'A',
      content: (
        <>
          <input aria-label="Text" />
          <button data-view-swipe-surface onClick={() => selections++}>
            Select item
          </button>
        </>
      ),
    },
    { id: 'b', label: 'B', content: <p>Second view</p> },
    { id: 'c', label: 'C', content: <p>Third view</p> },
  ] as [OverlayView, ...OverlayView[]];
  const pointer = async (
    target: Element,
    type: string,
    x: number,
    y: number,
    at: number,
  ) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, {
      pointerType: { value: 'touch' },
      isPrimary: { value: true },
      pointerId: { value: 4 },
      clientX: { value: x },
      clientY: { value: y },
      timeStamp: { value: at },
    });
    await act(async () => target.dispatchEvent(event));
  };
  try {
    await act(async () =>
      root.render(<ViewOverlay views={views} onClose={() => {}} />),
    );
    const overlay = container.querySelector('dialog')!;
    const page = container.querySelector('[data-overlay-page="a"]')!;
    const item = page.querySelector('button')!;
    await pointer(page, 'pointerdown', 600, 100, 0);
    await pointer(page, 'pointermove', 598, 200, 400);
    await pointer(page, 'pointerup', 598, 300, 600);
    assert.equal(overlay.getAttribute('data-current-view'), 'a');
    assert.equal(overlay.hasAttribute('data-dragging'), false);
    // Text controls keep their native interactions.
    await pointer(page.querySelector('input')!, 'pointerdown', 600, 100, 1000);
    await pointer(overlay, 'pointermove', 100, 100, 1400);
    await pointer(overlay, 'pointerup', 100, 100, 1600);
    assert.equal(overlay.getAttribute('data-current-view'), 'a');
    await pointer(item, 'pointerdown', 600, 100, 2000);
    await pointer(overlay, 'pointermove', 400, 102, 2400);
    assert.equal(
      page.getAttribute('style'),
      'transform: translateX(calc(0% + -200px));',
    );
    const currentLabel = overlay.querySelector<HTMLButtonElement>(
      'nav [aria-current="page"]',
    )!;
    assert.equal(
      currentLabel.style.getPropertyValue('--label-drag'),
      `${(-200 / window.innerWidth) * 100}%`,
    );
    assert.equal(page.hasAttribute('inert'), true);
    // Reverse towards the start, then snap back without changing views.
    await pointer(overlay, 'pointermove', 580, 101, 2800);
    await pointer(overlay, 'pointerup', 580, 101, 3000);
    await act(async () => item.click());
    assert.equal(selections, 0);
    assert.equal(overlay.getAttribute('data-current-view'), 'a');
    assert.equal(page.hasAttribute('inert'), false);
    await pointer(page, 'pointerdown', 600, 100, 4000);
    await pointer(overlay, 'pointermove', 100, 100, 4400);
    await pointer(overlay, 'pointercancel', 100, 100, 4500);
    assert.equal(overlay.getAttribute('data-current-view'), 'a');
    assert.equal(overlay.hasAttribute('data-dragging'), false);
    // Right from the first wraps to the last; left from the last wraps to the first.
    await pointer(page, 'pointerdown', 100, 100, 5000);
    await pointer(overlay, 'pointermove', 600, 100, 5400);
    await pointer(overlay, 'pointerup', 600, 100, 5600);
    assert.equal(overlay.getAttribute('data-current-view'), 'c');
    await pointer(overlay, 'pointerdown', 600, 100, 6000);
    await pointer(overlay, 'pointermove', 100, 100, 6400);
    await pointer(overlay, 'pointerup', 100, 100, 6600);
    assert.equal(overlay.getAttribute('data-current-view'), 'a');
    // Labels can be dragged too.
    await pointer(currentLabel, 'pointerdown', 600, 100, 7000);
    await pointer(overlay, 'pointermove', 100, 100, 7400);
    await pointer(overlay, 'pointerup', 100, 100, 7600);
    assert.equal(overlay.getAttribute('data-current-view'), 'b');
    await act(async () => {
      await sleep(360);
    });
    await click('C');
    assert.equal(overlay.getAttribute('data-current-view'), 'c');
    await act(async () =>
      overlay.querySelector('nav')!.dispatchEvent(
        new window.KeyboardEvent('keydown', {
          key: 'ArrowRight',
          bubbles: true,
        }),
      ),
    );
    assert.equal(overlay.getAttribute('data-current-view'), 'a');
    await pointer(page, 'pointerdown', 600, 100, 8000);
    await pointer(overlay, 'pointermove', 300, 100, 8400);
    await act(async () =>
      root.render(<ViewOverlay views={views} locked onClose={() => {}} />),
    );
    assert.equal(overlay.hasAttribute('data-dragging'), false);
    assert.equal(button('Close overlay').disabled, true);
    await pointer(overlay, 'pointerup', 100, 100, 8600);
    assert.equal(overlay.getAttribute('data-current-view'), 'a');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('import previews survive page changes and invalid replacement files clear the preview', async () => {
  const store = new PlanningStore(repository('tools-import'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await store.create(input());
    await act(async () => root.render(<Planning store={store} />));
    await act(async () => store.refresh());
    await click('Open task browser and tools');
    await click('Import/export');
    const picker =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const choose = async (text: string) => {
      Object.defineProperty(picker, 'files', {
        configurable: true,
        value: [{ size: text.length, text: async () => text }],
      });
      await act(async () =>
        picker.dispatchEvent(new Event('change', { bubbles: true })),
      );
      await waitFor(() => !button('Close overlay').disabled);
    };
    await choose(JSON.stringify(await store.export()));
    assert.ok(button('Confirm merge'));
    await click('Tasks');
    await fill('Search all tasks', 'Write');
    await click('Import/export');
    assert.ok(button('Confirm merge'));
    await choose('{bad-json');
    assert.equal(
      [...container.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('Confirm merge'),
      ),
      false,
    );
    assert.ok(
      container
        .querySelector('[role="alert"]')
        ?.textContent?.includes('not valid JSON'),
    );
    await choose(JSON.stringify(await store.export()));
    await click('Confirm merge');
    await waitFor(() => container.textContent!.includes('Import complete.'));
    assert.equal(store.getSnapshot().tasks.length, 1);
    await click('Tasks');
    assert.equal(
      container.querySelector<HTMLInputElement>(
        '[data-overlay-page="tasks"] input',
      )!.value,
      'Write',
    );
    await click('Close overlay');
    assert.equal(container.querySelector('dialog'), null);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('reopening a completed task opens Edit and requires an explicit new timeline', async () => {
  const store = new PlanningStore(repository('reopen-ui'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    const task = await store.create(input('Finished task'));
    await store.status(task, 'completed');
    await act(async () => root.render(<Planning store={store} />));
    await click('Reopen Finished task');
    assert.equal(
      document.querySelector('dialog')?.getAttribute('aria-label'),
      'Edit task',
    );
    assert.equal(
      document
        .querySelector('dialog')!
        .querySelectorAll('button[aria-pressed="true"]').length,
      0,
    );
    await click('Reopen task');
    assert.equal(store.getSnapshot().tasks[0].status, 'completed');
    assert.match(
      document.querySelector('[role="alert"]')!.textContent!,
      /Choose a new timeline/,
    );
    await click('Tomorrow');
    await click('Reopen task');
    await waitFor(() => store.getSnapshot().tasks[0].status === 'pending');
    assert.equal(
      store.getSnapshot().tasks[0].plannedCompletionDate,
      addDays(today, 1),
    );
    assert.equal(store.getSnapshot().tasks[0].completedAt, null);
    assert.equal(
      store.getSnapshot().events.filter((event) => event.action === 'reopen')
        .length,
      1,
    );
    assert.ok(
      ![...document.querySelectorAll('button')].some(
        (b) => b.textContent === 'Review',
      ),
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('cancelled archived tasks reopen from Edit with an explicit unscheduled choice; title edits preserve completion', async () => {
  const store = new PlanningStore(repository('cancelled-edit'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    let task = await store.create(input('Cancelled task'));
    await store.status(task, 'cancelled');
    task = store.getSnapshot().tasks[0];
    await store.archive(task, true);
    task = store.getSnapshot().tasks[0];
    await assert.rejects(store.status(task, 'pending'), /Open Edit/);
    await assert.rejects(
      store.edit(task, {
        ...input(),
        status: 'pending',
        plannedCompletionDate: addDays(today, -1),
      }),
      /timeline/,
    );
    await act(async () =>
      root.render(
        <TaskDetails taskId={task.id} store={store} onClose={() => {}} />,
      ),
    );
    await click('Edit');
    await fill('Status', 'pending');
    await click('Reopen task');
    assert.equal(store.getSnapshot().tasks[0].status, 'cancelled');
    await click('Not scheduled yet');
    await click('Reopen task');
    await waitFor(() => store.getSnapshot().tasks[0].status === 'pending');
    assert.equal(store.getSnapshot().tasks[0].archived, false);
    assert.equal(store.getSnapshot().tasks[0].plannedCompletionDate, null);
    await act(async () =>
      store.status(store.getSnapshot().tasks[0], 'completed'),
    );
    await click('Edit');
    await fill('Title', 'Still finished');
    await click('Save changes');
    await waitFor(
      () => store.getSnapshot().tasks[0].title === 'Still finished',
    );
    assert.equal(store.getSnapshot().tasks[0].status, 'completed');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('end-of-day summary lists saved outcomes and backups preserve those decisions', async () => {
  const store = new PlanningStore(repository('review-summary'), false);
  const restored = new PlanningStore(
    repository('review-summary-restore'),
    false,
  );
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let finished = '';
  try {
    for (const title of [
      'A completed',
      'B tomorrow',
      'C deferred',
      'D cancelled',
      'E unresolved',
      'F unscheduled',
    ])
      await store.create(input(title));
    await act(async () =>
      root.render(
        <ReviewFlow
          store={store}
          onClose={() => {}}
          onComplete={(message) => {
            finished = message;
          }}
        />,
      ),
    );
    await click('Completed');
    await click('Save decision');
    await waitFor(
      () => document.querySelector('h3')?.textContent === 'B tomorrow',
    );
    await click('Plan tomorrow');
    await waitFor(
      () => document.querySelector('h3')?.textContent === 'C deferred',
    );
    for (const [choice, next] of [
      ['Defer', 'D cancelled'],
      ['Cancel task', 'E unresolved'],
      ['Leave unresolved', 'F unscheduled'],
    ]) {
      await click(choice);
      await click('Save decision');
      await waitFor(() => document.querySelector('h3')?.textContent === next);
    }
    await click('Not scheduled yet');
    await click('Save without a date');
    await waitFor(
      () => !!document.querySelector('[aria-label="Review outcomes"]'),
    );
    const rows = [
      ...document.querySelectorAll('[aria-label="Review outcomes"] li'),
    ];
    assert.equal(rows.length, 6);
    assert.deepEqual(
      rows.map((row) => row.querySelector('strong')!.textContent),
      [
        'A completed',
        'B tomorrow',
        'C deferred',
        'D cancelled',
        'E unresolved',
        'F unscheduled',
      ],
    );
    assert.deepEqual(
      rows.map((row) => row.querySelector('span')!.textContent),
      [
        'Completed',
        'Planned for Tomorrow',
        'Deferred · Needs review',
        'Cancelled',
        'Left unresolved',
        'Not scheduled yet · Long term',
      ],
    );
    assert.equal(store.getSnapshot().reviews.length, 0);
    await click('Finish review');
    await waitFor(() => finished !== '');
    assert.equal(store.getSnapshot().reviews[0].taskIds.length, 6);
    await restored.import(await store.export(), {});
    assert.equal(
      restored
        .getSnapshot()
        .events.filter(
          (event) => event.reviewId === store.getSnapshot().reviews[0].id,
        ).length,
      6,
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
    await restored.close();
  }
});

test('tasks resolved elsewhere during a review are skipped and not counted as reviewed', async () => {
  const store = new PlanningStore(repository('review-skipped'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    const task = await store.create(input('Resolved elsewhere'));
    await act(async () =>
      root.render(
        <ReviewFlow store={store} onClose={() => {}} onComplete={() => {}} />,
      ),
    );
    await act(async () => store.status(task, 'completed'));
    assert.match(container.textContent!, /no longer needs review/);
    await click('Continue');
    assert.equal(
      container.querySelector('[aria-label="Review outcomes"]'),
      null,
    );
    assert.ok(!container.textContent?.includes('1 item reviewed'));
    await click('Finish review');
    await waitFor(() => store.getSnapshot().reviews.length === 1);
    assert.deepEqual(store.getSnapshot().reviews[0].taskIds, []);
    await assert.rejects(
      store.decide(store.getSnapshot().tasks[0], { kind: 'plan', date: today }),
      /Open Edit/,
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

function touchEvent(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  id = 7,
  multi = false,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const touch = { identifier: id, clientX: x, clientY: y };
  Object.defineProperties(event, {
    touches: {
      value:
        type === 'touchend' || type === 'touchcancel'
          ? []
          : multi
            ? [touch, { ...touch, identifier: id + 1 }]
            : [touch],
    },
    changedTouches: { value: [touch] },
  });
  target.dispatchEvent(event);
  return event;
}

function cancelledPointer(target: Element) {
  const event = new Event('pointercancel', { bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 7 });
  target.dispatchEvent(event);
}

test('native touch creation tracks the finger through pointer cancellation and keeps vertical scrolling native', async () => {
  const store = new PlanningStore(repository('native-touch-create'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <StrictMode>
          <Planning store={store} />
        </StrictMode>,
      ),
    );
    await waitFor(() => store.getSnapshot().ready);
    const heading = container.querySelector('h2')!;
    await act(async () => touchEvent(heading, 'touchstart', 600, 100));
    let vertical!: Event;
    await act(async () => {
      vertical = touchEvent(heading, 'touchmove', 597, 180);
    });
    assert.equal(vertical.defaultPrevented, false);
    assert.equal(container.querySelector('dialog'), null);
    await act(async () => touchEvent(heading, 'touchend', 597, 180));
    await act(async () => touchEvent(heading, 'touchstart', 600, 100));
    let horizontal!: Event;
    await act(async () => {
      horizontal = touchEvent(heading, 'touchmove', 500, 104);
    });
    assert.equal(horizontal.defaultPrevented, true);
    assert.equal(
      container.querySelector('dialog')?.getAttribute('data-phase'),
      'dragging',
    );
    const initial = container
      .querySelector<HTMLDialogElement>('dialog')!
      .style.getPropertyValue('--panel-offset');
    await act(async () => {
      cancelledPointer(heading);
      touchEvent(window, 'touchmove', 350, 105);
    });
    assert.equal(
      container.querySelector('dialog')?.getAttribute('data-phase'),
      'dragging',
    );
    assert.notEqual(
      container
        .querySelector<HTMLDialogElement>('dialog')!
        .style.getPropertyValue('--panel-offset'),
      initial,
    );
    await act(async () => touchEvent(window, 'touchend', 350, 105));
    await waitFor(
      () =>
        container.querySelector('dialog')?.getAttribute('data-phase') ===
        'open',
    );
    await act(async () => {
      await sleep(360);
    });
    await click('Close');
    await waitFor(() => !container.querySelector('dialog'));
    await act(async () => {
      touchEvent(heading, 'touchstart', 600, 100);
      touchEvent(heading, 'touchmove', 500, 104);
    });
    await act(async () => touchEvent(window, 'touchcancel', 500, 104));
    await waitFor(() => !container.querySelector('dialog'));
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('native touch circular pages wrap, ignore pointer cancellation, and cancel multi-touch', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <StrictMode>
          <ViewOverlay
            views={[
              { id: 'tasks', label: 'Tasks', content: <p>Task page</p> },
              {
                id: 'transfer',
                label: 'Import/export',
                content: <p>Transfer page</p>,
              },
            ]}
            onClose={() => {}}
          />
        </StrictMode>,
      ),
    );
    const dialog = container.querySelector('dialog')!;
    const page = dialog.querySelector('[data-overlay-page="tasks"] p')!;
    await act(async () => touchEvent(page, 'touchstart', 800, 100));
    let vertical!: Event;
    await act(async () => {
      vertical = touchEvent(page, 'touchmove', 795, 190);
    });
    assert.equal(vertical.defaultPrevented, false);
    await act(async () => touchEvent(page, 'touchend', 795, 190));
    await act(async () => touchEvent(page, 'touchstart', 800, 100));
    await act(async () => touchEvent(page, 'touchmove', 600, 104));
    assert.equal(dialog.getAttribute('data-dragging'), 'true');
    await act(async () => {
      cancelledPointer(page);
      touchEvent(window, 'touchmove', 300, 105);
    });
    await act(async () => touchEvent(window, 'touchend', 300, 105));
    assert.equal(dialog.getAttribute('data-current-view'), 'transfer');
    await act(async () => {
      await sleep(360);
    });
    const second = dialog.querySelector('[data-overlay-page="transfer"] p')!;
    await act(async () => touchEvent(second, 'touchstart', 200, 100));
    await act(async () => touchEvent(second, 'touchmove', 400, 104));
    await act(async () => touchEvent(window, 'touchmove', 500, 105, 7, true));
    assert.equal(dialog.hasAttribute('data-dragging'), false);
    assert.equal(dialog.getAttribute('data-current-view'), 'transfer');
    await act(async () => touchEvent(second, 'touchstart', 200, 100));
    await act(async () => touchEvent(window, 'touchmove', 700, 105));
    await act(async () => touchEvent(window, 'touchend', 700, 105));
    assert.equal(dialog.getAttribute('data-current-view'), 'tasks');
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('standalone viewport fills the screen despite safe-area under-reporting and stale visual offsets', () => {
  const metrics = {
    standalone: true,
    editing: false,
    layoutHeight: 852,
    layoutWidth: 393,
    visual: { height: 756, width: 393, offsetTop: 20, offsetLeft: 0 },
  };
  assert.deepEqual(viewportFrame(metrics), {
    height: '100dvh',
    width: '100vw',
    top: '0px',
    left: '0px',
    keyboard: false,
  });
  // Focus alone is not evidence of a keyboard; safe-area differences remain idle.
  assert.equal(viewportFrame({ ...metrics, editing: true }).height, '100dvh');
  const keyboard = viewportFrame({
    ...metrics,
    editing: true,
    visual: { ...metrics.visual, height: 430, offsetTop: 38 },
  });
  assert.equal(keyboard.height, '430px');
  assert.equal(keyboard.top, '38px');
  assert.equal(keyboard.keyboard, true);
  assert.equal(
    viewportFrame({ ...metrics, visual: { ...metrics.visual, height: 430 } })
      .height,
    '100dvh',
  );
  const landscape = viewportFrame({
    ...metrics,
    editing: true,
    layoutHeight: 393,
    visual: { height: 220, width: 852, offsetTop: 0, offsetLeft: 0 },
  });
  assert.equal(landscape.height, '220px');
  assert.equal(
    viewportFrame({ ...metrics, standalone: false }).height,
    '756px',
  );
  assert.equal(
    viewportFrame({ ...metrics, visual: undefined }).height,
    '100dvh',
  );
});

test('viewport initializes full-screen, follows keyboard focus, restores on blur/resume, and cleans listeners', async () => {
  const descriptors = Object.fromEntries(
    ['matchMedia', 'visualViewport', 'innerHeight'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(window, key),
    ]),
  );
  const style = document.documentElement.style;
  const originalStyle = style.cssText;
  const visual = document.createElement('div') as HTMLElement & {
    height: number;
    width: number;
  };
  Object.defineProperties(
    visual,
    Object.fromEntries(
      Object.entries({
        height: 756,
        width: 393,
        offsetTop: 0,
        offsetLeft: 0,
      }).map(([key, value]) => [
        key,
        { value, writable: true, configurable: true },
      ]),
    ),
  );
  const standalone = Object.assign(document.createElement('div'), {
    matches: true,
  });
  const coarse = Object.assign(document.createElement('div'), {
    matches: true,
  });
  const field = document.createElement('textarea');
  document.body.append(field);
  let dispose = () => {};
  try {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) =>
        query.includes('standalone') ? standalone : coarse,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visual,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 852,
    });
    dispose = initializeViewport();
    assert.equal(style.getPropertyValue('--viewport-height'), '100dvh');
    field.focus();
    await sleep(40);
    assert.equal(style.getPropertyValue('--viewport-height'), '100dvh');
    visual.height = 430;
    visual.offsetTop = 38;
    visual.dispatchEvent(new Event('resize'));
    await sleep(40);
    assert.equal(style.getPropertyValue('--viewport-height'), '430px');
    assert.equal(style.getPropertyValue('--viewport-top'), '38px');
    assert.equal(style.getPropertyValue('--app-safe-bottom'), '0px');
    field.blur();
    await sleep(40);
    // Restoration does not depend on Safari repairing its visual viewport first.
    assert.equal(style.getPropertyValue('--viewport-height'), '100dvh');
    assert.equal(style.getPropertyValue('--viewport-top'), '0px');
    window.dispatchEvent(new Event('pageshow'));
    await sleep(40);
    assert.equal(style.getPropertyValue('--viewport-height'), '100dvh');
    dispose();
    dispose = () => {};
    style.setProperty('--viewport-height', '123px');
    visual.dispatchEvent(new Event('resize'));
    field.focus();
    await sleep(40);
    assert.equal(style.getPropertyValue('--viewport-height'), '123px');
  } finally {
    dispose();
    field.remove();
    style.cssText = originalStyle;
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(window, key, descriptor);
      else Reflect.deleteProperty(window, key);
    }
  }
});

test('daily review excludes tomorrow and later plans, including after today is moved to tomorrow', async () => {
  const store = new PlanningStore(repository('daily-review-scope'), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    const current = await store.create(input('Today only'));
    const tomorrowTask = await store.create({
      ...input('Already tomorrow'),
      plannedCompletionDate: addDays(today, 1),
    });
    const laterTask = await store.create({
      ...input('Later this month'),
      plannedCompletionDate: addDays(today, 10),
    });
    await store.create({ ...input('Someday'), plannedCompletionDate: null });
    await act(async () =>
      root.render(
        <ReviewFlow store={store} onClose={() => {}} onComplete={() => {}} />,
      ),
    );
    assert.equal(container.querySelector('h3')?.textContent, 'Today only');
    assert.match(container.textContent!, /1 of 1/);
    assert.ok(!container.textContent?.includes('Already tomorrow'));
    await click('Plan tomorrow');
    await waitFor(
      () => !!container.querySelector('[aria-label="Review outcomes"]'),
    );
    assert.equal(
      container.querySelectorAll('[aria-label="Review outcomes"] li').length,
      1,
    );
    assert.deepEqual(
      store.getSnapshot().tasks.find((task) => task.id === tomorrowTask.id),
      tomorrowTask,
    );
    assert.deepEqual(
      store.getSnapshot().tasks.find((task) => task.id === laterTask.id),
      laterTask,
    );
    assert.deepEqual(
      store
        .getSnapshot()
        .events.filter((event) => event.reviewId)
        .map((event) => event.taskId),
      [current.id],
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

let passed = 0;
for (const [name, run] of tests) {
  try {
    await run();
    passed++;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
console.log(`\n${passed} planning tests passed.`);
await runLogTests();
