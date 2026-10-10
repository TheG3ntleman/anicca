import assert from 'node:assert/strict';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PlanningRepository } from '../src/storage/PlanningRepository';
import { PlanningStore } from '../src/state/PlanningStore';
import { createLog } from '../src/domain/logs/operations';
import { prepareAttachment, readBlob } from '../src/media/files';
import { MAX_ATTACHMENT_BYTES } from '../src/domain/logs/validation';
import { parseExport } from '../src/domain/transfer/validation';
import { importConflicts } from '../src/domain/transfer/merge';
import { LogComposer } from '../src/components/LogComposer/LogComposer';
import { StoredLogMedia } from '../src/components/LogMedia/LogMedia';
import { TaskDetails } from '../src/components/TaskDetails/TaskDetails';
import {
  STORES,
  MEDIA_STORE,
  request,
  completion,
} from '../src/storage/database';
import type { LogDraft } from '../src/media/types';

const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, run: () => void | Promise<void>) =>
  tests.push([name, run]);
const repo = () => new PlanningRepository(`test-logs-${crypto.randomUUID()}`);
const taskInput = {
  title: 'Document progress',
  finishCriteria: 'A useful result.',
  description: '',
  plannedCompletionDate: null,
};
const png = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=',
  ),
  (c) => c.charCodeAt(0),
);
const file = (name = 'photo.png', type = 'image/png', bytes: BlobPart = png) =>
  Object.assign(new Blob([bytes], { type }), { name });
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  throw new Error('Timed out waiting for log UI.');
}
function button(name: string): HTMLButtonElement {
  const result = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find(
    (button) =>
      (button.getAttribute('aria-label') ?? button.textContent?.trim()) ===
      name,
  );
  assert.ok(result, `Missing button: ${name}`);
  return result;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function text(value: string) {
  const field = document.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(field),
      'value',
    )!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function pick(label: string, files: Blob[]) {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  )!;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  await act(async () =>
    input.dispatchEvent(new Event('change', { bubbles: true })),
  );
  await waitFor(
    () => !document.body.textContent?.includes('Preparing attachments…'),
  );
}

test('logs accept text, media, or both and reject empty/unsupported/oversized inputs', async () => {
  assert.throws(
    () => createLog({ text: ' ', attachmentIds: [] }),
    /Write something/,
  );
  assert.equal(
    createLog({ text: '  A thought. ', attachmentIds: [] }).text,
    'A thought.',
  );
  assert.equal(createLog({ text: '', attachmentIds: ['image-id'] }).text, '');
  await assert.rejects(
    prepareAttachment(file('empty.png', 'image/png', '')),
    /nonempty/,
  );
  await assert.rejects(
    prepareAttachment(file('active.svg', 'image/svg+xml', '<svg/>')),
    /supported/,
  );
  await assert.rejects(
    prepareAttachment(
      file('large.jpg', 'image/jpeg', new Uint8Array(MAX_ATTACHMENT_BYTES + 1)),
    ),
    /20 MB/,
  );
  const inferred = await prepareAttachment(file('photo.PNG', '', png));
  assert.equal(inferred.metadata.mimeType, 'image/png');
  assert.deepEqual(new Uint8Array(await readBlob(inferred.blob)), png);
});

test('standalone and task logs persist; identical files share binary storage and backups', async () => {
  const name = `test-log-persistence-${crypto.randomUUID()}`;
  const first = new PlanningRepository(name);
  const image = await prepareAttachment(file());
  const imageAgain = await prepareAttachment(file('another-name.png'));
  const sound = await prepareAttachment(
    file('sound.m4a', 'audio/mp4', 'sound-bytes'),
  );
  const standalone = await first.createLog('A standalone log.', [image]);
  const task = await first.create(taskInput);
  const associated = await first.createLog('', [imageAgain, sound], {
    type: 'task',
    id: task.id,
  });
  await first.close();
  const reopened = new PlanningRepository(name);
  const target = repo();
  try {
    const data = await reopened.read();
    assert.equal(data.logs.length, 2);
    assert.equal(data.logLinks.length, 1);
    assert.equal(data.logLinks[0].logId, associated.id);
    assert.equal(data.logLinks[0].targetId, task.id);
    assert.equal(data.attachments.length, 3);
    assert.equal('media' in data, false);
    assert.equal(
      data.logs.find((log) => log.id === standalone.id)!.text,
      standalone.text,
    );
    const exported = parseExport(JSON.stringify(await reopened.export()));
    assert.equal(exported.media.length, 2);
    await target.import(exported, {});
    await target.import(exported, {});
    assert.deepEqual(await target.read(), data);
    for (const attachment of exported.attachments) {
      const original = await reopened.loadMedia(attachment);
      const restored = await target.loadMedia(attachment);
      assert.ok(original);
      assert.ok(restored);
      assert.equal(restored.type, attachment.mimeType);
      assert.deepEqual(await readBlob(restored), await readBlob(original));
    }
    assert.deepEqual((await target.export()).media, exported.media);
  } finally {
    await reopened.close();
    await target.close();
  }
});

test('corrupt media and broken references cannot partially import, and metadata conflicts stay small', async () => {
  const source = repo();
  const target = repo();
  try {
    const image = await prepareAttachment(file());
    await source.createLog('A photo.', [image]);
    const exported = await source.export();
    const damaged = structuredClone(exported);
    damaged.media[0].dataBase64 = btoa('x'.repeat(image.metadata.size));
    await assert.rejects(target.import(damaged, {}), /checksum/);
    assert.equal((await target.read()).logs.length, 0);
    assert.throws(
      () => parseExport(JSON.stringify({ ...exported, media: [] })),
      /missing its media/,
    );
    const missing = structuredClone(exported);
    missing.logs[0].attachmentIds = ['missing'];
    assert.throws(
      () => parseExport(JSON.stringify(missing)),
      /missing attachment/,
    );
    const invalid = structuredClone(exported);
    invalid.media[0].dataBase64 = '???=';
    assert.throws(() => parseExport(JSON.stringify(invalid)), /encoding/);
    await target.import(exported, {});
    const renamed = structuredClone(exported);
    renamed.attachments[0].name = 'Renamed.png';
    const conflicts = importConflicts(await target.read(), renamed);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0].collection, 'attachments');
    assert.equal('dataBase64' in conflicts[0].incoming, false);
    await assert.rejects(target.import(renamed, {}), /every conflict/);
    await target.import(renamed, { [conflicts[0].key]: 'incoming' });
    assert.equal((await target.read()).attachments[0].name, 'Renamed.png');
  } finally {
    await source.close();
    await target.close();
  }
});

test('failed log writes roll back the log, task link, attachment metadata, and media together', async () => {
  const repository = repo();
  try {
    const image = await prepareAttachment(file());
    await assert.rejects(
      repository.createLog('No task.', [image], {
        type: 'task',
        id: 'missing',
      }),
      /no longer exists/,
    );
    const task = await repository.create(taskInput);
    await repository.createLog('First.', [image], {
      type: 'task',
      id: task.id,
    });
    const second = await prepareAttachment(
      file('sound.m4a', 'audio/mp4', 'sound'),
    );
    // Reusing an existing attachment ID forces a write failure after other writes were queued.
    await assert.rejects(
      repository.createLog('Should roll back.', [second, image], {
        type: 'task',
        id: task.id,
      }),
    );
    const data = await repository.read();
    assert.equal(data.logs.length, 1);
    assert.equal(data.logLinks.length, 1);
    assert.equal(data.attachments.length, 1);
    assert.equal(await repository.loadMedia(second.metadata), undefined);
    assert.equal((await repository.export()).media.length, 1);
  } finally {
    await repository.close();
  }
});

test('version 2 notes migrate to independent logs and links without losing IDs, timestamps, or text', async () => {
  const source = repo();
  const name = `test-log-v2-${crypto.randomUUID()}`;
  const upgraded = new PlanningRepository(name);
  try {
    const task = await source.create(taskInput);
    const current = await source.export();
    const oldNote = {
      id: 'old-note',
      taskId: task.id,
      text: 'Old words.',
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
    const legacy = {
      format: current.format,
      schemaVersion: 2,
      exportedAt: current.exportedAt,
      tasks: current.tasks,
      notes: [oldNote],
      events: current.events,
      reviews: current.reviews,
    };
    const migrated = parseExport(JSON.stringify(legacy));
    await new Promise<void>((resolve, reject) => {
      const opening = indexedDB.open(name, 2);
      opening.onupgradeneeded = () => {
        for (const key of ['tasks', 'notes', 'events', 'reviews'] as const) {
          const store = opening.result.createObjectStore(key, {
            keyPath: 'id',
          });
          legacy[key].forEach((record) => store.add(record));
        }
      };
      opening.onsuccess = () => {
        opening.result.close();
        resolve();
      };
      opening.onerror = () => reject(opening.error);
    });
    const data = await upgraded.read();
    assert.equal(data.logs[0].id, oldNote.id);
    assert.equal(data.logs[0].text, oldNote.text);
    assert.equal(data.logs[0].updatedAt, oldNote.updatedAt);
    assert.equal(data.logLinks[0].targetId, task.id);
    assert.equal(data.logLinks[0].logId, oldNote.id);
    for (const key of STORES) assert.deepEqual(data[key], migrated[key]);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const opening = indexedDB.open(name);
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
    });
    assert.equal(database.version, 3);
    assert.equal(database.objectStoreNames.contains('notes'), false);
    const transaction = database.transaction(MEDIA_STORE, 'readonly');
    const [count] = await Promise.all([
      request(transaction.objectStore(MEDIA_STORE).count()),
      completion(transaction),
    ]);
    assert.equal(count, 0);
    database.close();
  } finally {
    await source.close();
    await upgraded.close();
  }
});

test('composer supports media-only logs, pending removal, failed-save recovery, and cleans preview URLs', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let saved: LogDraft | undefined;
  let fail = true;
  const created: string[] = [];
  const revoked: string[] = [];
  const createUrl = URL.createObjectURL;
  const revokeUrl = URL.revokeObjectURL;
  URL.createObjectURL = (blob) => {
    const url = createUrl(blob);
    created.push(url);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    revoked.push(url);
    revokeUrl(url);
  };
  try {
    await act(async () =>
      root.render(
        <LogComposer
          onSave={async (draft) => {
            if (fail) throw new Error('Storage is full.');
            saved = draft;
          }}
        />,
      ),
    );
    assert.equal(button('Save log').disabled, true);
    await pick('Choose images', [file()]);
    assert.equal(button('Save log').disabled, false);
    assert.ok(container.querySelector('img'));
    await click('Remove photo.png');
    assert.equal(button('Save log').disabled, true);
    assert.equal(revoked.length, 1);
    await pick('Choose images', [file()]);
    await pick('Choose audio files', [file('sound.m4a', 'audio/mp4', 'sound')]);
    assert.ok(container.querySelector('audio[controls]'));
    await click('Save log');
    assert.ok(
      container
        .querySelector('[role="alert"]')
        ?.textContent?.includes('Storage is full'),
    );
    assert.equal(container.querySelectorAll('figure').length, 2);
    fail = false;
    await click('Save log');
    assert.equal(saved!.text, '');
    assert.equal(saved!.attachments.length, 2);
    assert.equal(container.querySelectorAll('figure').length, 0);
    assert.equal(button('Save log').disabled, true);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    assert.deepEqual([...revoked].sort(), [...created].sort());
  }
});

test('task details use the generic composer/viewer and keep a draft through task editing', async () => {
  const store = new PlanningStore(repo(), false);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    const task = await store.create(taskInput);
    await act(async () =>
      root.render(
        <TaskDetails taskId={task.id} store={store} onClose={() => {}} />,
      ),
    );
    await text('My draft.');
    await click('Edit');
    await click('Cancel');
    assert.equal(container.querySelector('textarea')!.value, 'My draft.');
    await pick('Choose images', [file()]);
    await click('Save log');
    await waitFor(
      () =>
        store.getSnapshot().logs.length === 1 &&
        container.querySelector('textarea')!.value === '',
    );
    assert.equal(store.getSnapshot().logLinks[0].targetId, task.id);
    await waitFor(() => Boolean(container.querySelector('article img')));
    await click('View photo.png');
    assert.equal(container.querySelectorAll('dialog').length, 2);
    const dialogs = container.querySelectorAll('dialog');
    await act(async () =>
      dialogs[1]
        .querySelector<HTMLButtonElement>('[aria-label="Close"]')!
        .click(),
    );
    assert.equal(container.querySelectorAll('dialog').length, 1);
    assert.ok(container.querySelector('a[download="photo.png"]'));
  } finally {
    await act(async () => root.unmount());
    container.remove();
    await store.close();
  }
});

test('saved media waits until visible before reading large binary data', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'IntersectionObserver',
  );
  let enter: (() => void) | undefined;
  let reads = 0;
  let disconnected = 0;
  class FakeObserver {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
      enter = () => callback([{ isIntersecting: true }]);
    }
    observe() {}
    disconnect() {
      disconnected++;
    }
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    configurable: true,
    value: FakeObserver,
  });
  try {
    const image = await prepareAttachment(file());
    await act(async () =>
      root.render(
        <StoredLogMedia
          attachment={image.metadata}
          loadMedia={async () => {
            reads++;
            return image.blob;
          }}
        />,
      ),
    );
    assert.equal(reads, 0);
    await act(async () => enter!());
    await waitFor(() => Boolean(container.querySelector('img')));
    assert.equal(reads, 1);
    assert.ok(disconnected > 0);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    if (descriptor)
      Object.defineProperty(globalThis, 'IntersectionObserver', descriptor);
    else
      delete (globalThis as unknown as Record<string, unknown>)
        .IntersectionObserver;
  }
});

test('recording selects supported audio, attaches on stop/background, discards, and releases a late microphone grant', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const oldDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
  const oldRecorder = Object.getOwnPropertyDescriptor(
    globalThis,
    'MediaRecorder',
  );
  const oldVisibility = Object.getOwnPropertyDescriptor(
    document,
    'visibilityState',
  );
  let stops = 0;
  let recorder: FakeRecorder | undefined;
  let grant: ((stream: MediaStream) => void) | undefined;
  let delayed = false;
  const stream = {
    getTracks: () => [{ stop: () => stops++ }],
  } as unknown as MediaStream;
  class FakeRecorder {
    static isTypeSupported(type: string) {
      return type === 'audio/mp4';
    }
    state = 'inactive';
    mimeType: string;
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    onerror?: () => void;
    constructor(_stream: MediaStream, options: MediaRecorderOptions) {
      this.mimeType = options.mimeType!;
      recorder = this;
    }
    start() {
      this.state = 'recording';
    }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({
          data: new Blob(['recorded sound'], { type: this.mimeType }),
        });
        this.onstop?.();
      });
    }
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: () =>
        delayed
          ? new Promise<MediaStream>((resolve) => {
              grant = resolve;
            })
          : Promise.resolve(stream),
    },
  });
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: FakeRecorder,
  });
  let draft: LogDraft | undefined;
  try {
    await act(async () =>
      root.render(
        <LogComposer
          onSave={async (value) => {
            draft = value;
          }}
        />,
      ),
    );
    await click('● Record');
    assert.equal(recorder!.mimeType, 'audio/mp4');
    assert.ok(button('Stop and attach'));
    assert.equal(button('Save log').disabled, true);
    await click('Stop and attach');
    await waitFor(
      () =>
        Boolean(container.querySelector('audio')) &&
        !button('Save log').disabled,
    );
    assert.ok(stops > 0);
    await click('Save log');
    assert.equal(draft!.attachments[0].metadata.mimeType, 'audio/mp4');
    assert.equal(draft!.attachments[0].blob.size, 'recorded sound'.length);
    await click('● Record');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    await act(async () =>
      document.dispatchEvent(new Event('visibilitychange')),
    );
    await waitFor(
      () =>
        Boolean(container.querySelector('audio')) &&
        !button('Save log').disabled,
    );
    assert.ok(container.textContent?.includes('went into the background'));
    if (oldVisibility)
      Object.defineProperty(document, 'visibilityState', oldVisibility);
    else
      delete (document as unknown as Record<string, unknown>).visibilityState;
    await click('Save log');
    await click('● Record');
    await click('Discard recording');
    assert.equal(container.querySelector('audio'), null);
    delayed = true;
    await click('● Record');
    assert.ok(grant);
    const before = stops;
    await act(async () => root.unmount());
    await act(async () => {
      grant!(stream);
      await Promise.resolve();
    });
    assert.equal(stops, before + 1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    if (oldDevices)
      Object.defineProperty(navigator, 'mediaDevices', oldDevices);
    else delete (navigator as unknown as Record<string, unknown>).mediaDevices;
    if (oldRecorder)
      Object.defineProperty(globalThis, 'MediaRecorder', oldRecorder);
    else
      delete (globalThis as unknown as Record<string, unknown>).MediaRecorder;
    if (oldVisibility)
      Object.defineProperty(document, 'visibilityState', oldVisibility);
    else
      delete (document as unknown as Record<string, unknown>).visibilityState;
  }
});

export async function runLogTests() {
  for (const [name, run] of tests) {
    try {
      await run();
      console.log(`✓ ${name}`);
    } catch (error) {
      console.error(`✗ ${name}`);
      throw error;
    }
  }
  console.log(`\n${tests.length} log tests passed.`);
}
