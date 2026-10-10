import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'https://example.test/anicca/',
});
for (const name of [
  'window',
  'document',
  'HTMLElement',
  'HTMLInputElement',
  'HTMLDialogElement',
  'HTMLSelectElement',
  'MutationObserver',
  'Option',
  'File',
  'Event',
  'MouseEvent',
]) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
// React's async act() creates MessagePorts; close them after the suite in Node.
const NativeMessageChannel = globalThis.MessageChannel;
const channels = [];
globalThis.MessageChannel = class extends NativeMessageChannel {
  constructor() {
    super();
    channels.push(this);
  }
};
// DOM tests model dialog open/close; they do not emulate iPhone rendering or focus traps.
dom.window.HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '');
};
dom.window.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute('open');
};
const directory = await mkdtemp(join(tmpdir(), 'anicca-planning-tests-'));
try {
  const outfile = join(directory, 'tests.mjs');
  await build({
    entryPoints: ['tests/planning.test.tsx'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    loader: { '.css': 'local-css' },
  });
  await import(pathToFileURL(outfile).href);
} finally {
  channels.forEach((channel) => {
    channel.port1.close();
    channel.port2.close();
  });
  dom.window.close();
  await rm(directory, { recursive: true, force: true });
}
