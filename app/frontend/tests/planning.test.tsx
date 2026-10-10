import assert from 'node:assert/strict';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { createTask, editTask } from '../src/domain/tasks/operations';
import { addDays, localDate, validDate } from '../src/domain/tasks/dates';
import {
  needsReview,
  reviewTasks,
  todayTasks,
  layerTasks,
} from '../src/domain/tasks/selectors';
import { applyReviewDecision } from '../src/domain/reviews/operations';
import { parseExport } from '../src/domain/transfer/validation';
import { importConflicts } from '../src/domain/transfer/merge';
import type { PlanningExport } from '../src/domain/transfer/types';
import { PlanningRepository } from '../src/storage/PlanningRepository';
import { PlanningStore } from '../src/state/PlanningStore';
import { Planning } from '../src/components/Planning/Planning';
import { exampleTasks } from './fixtures';

const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, run: () => void | Promise<void>) =>
  tests.push([name, run]);
const today = localDate();
const input = (title = 'Write proposal') => ({
  title,
  finishCriteria: 'Send a complete draft.',
  description: '',
  horizon: 'short' as const,
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
    layerTasks(tasks, 'long').map((task) => task.title),
    ['Learn a language'],
  );
  assert.equal(reviewTasks(tasks).length, 6);
});

test('task invariants and review decisions preserve intent without deadlines', () => {
  assert.throws(() => createTask({ ...input(), title: ' ' }));
  assert.throws(() => createTask({ ...input(), horizon: 'long' }));
  const task = createTask(input());
  const deferred = applyReviewDecision(task, { kind: 'defer' }, today);
  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.plannedCompletionDate, null);
  assert.equal(needsReview(deferred, today), true);
  const tomorrow = applyReviewDecision(
    deferred,
    { kind: 'plan', date: addDays(today, 1) },
    today,
  );
  assert.equal(tomorrow.status, 'pending');
  assert.equal(tomorrow.horizon, 'short');
  assert.equal(
    applyReviewDecision(task, { kind: 'plan', date: addDays(today, 10) }, today)
      .horizon,
    'medium',
  );
  assert.equal(
    applyReviewDecision(task, { kind: 'long' }, today).plannedCompletionDate,
    null,
  );
  assert.throws(() =>
    applyReviewDecision(task, { kind: 'plan', date: '2026-02-31' }, today),
  );
});

test('tasks, notes, and history survive closing and reopening the database', async () => {
  const name = `test-persistence-${crypto.randomUUID()}`;
  const first = new PlanningRepository(name);
  const task = await first.create(input());
  await first.addNote(task.id, 'Worked on the introduction.');
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
    assert.equal(data.notes[0].text, 'Worked on the introduction.');
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
    await assert.rejects(repo.addNote('missing-task', 'Note'));
    const data = await repo.read();
    assert.equal(data.tasks[0].title, task.title);
    assert.equal(data.events.length, 1);
    assert.equal(data.notes.length, 0);
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
    await source.note(task, 'A private note.');
    const reviewId = crypto.randomUUID();
    await source.decide(task, { kind: 'complete' }, reviewId);
    await source.finishReview(reviewId, [task.id], 'Another day has passed.');
    const exported = parseExport(JSON.stringify(await source.export()));
    await target.import(exported, {});
    await target.import(exported, {});
    const restored = await target.export();
    for (const key of ['tasks', 'notes', 'events', 'reviews'] as const)
      assert.deepEqual(restored[key], exported[key]);
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
      notes: [
        {
          id: crypto.randomUUID(),
          taskId: 'missing',
          text: 'Orphan',
          createdAt: data.exportedAt,
          updatedAt: data.exportedAt,
        },
      ],
    };
    await assert.rejects(store.import(broken, {}), /missing task/);
    assert.equal((await store.export()).notes.length, 0);
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
    await fill('Add a note', 'Made a start.');
    await click('Save note');
    await waitFor(() => store.getSnapshot().notes.length === 1);
    await click('Edit');
    await fill('Title', 'Edited task');
    await click('Save changes');
    await waitFor(
      () =>
        store.getSnapshot().tasks[0].title === 'Edited task' &&
        !document.querySelector('input'),
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
    await fill('Planned completion date', '');
    assert.equal(document.querySelector('select')!.value, 'long');
    await act(async () => {
      await sleep(360);
    });
    await click('Add task');
    await waitFor(() => store.getSnapshot().tasks.length === 1);
    assert.equal(store.getSnapshot().tasks[0].horizon, 'long');
    assert.equal(store.getSnapshot().tasks[0].plannedCompletionDate, null);
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
