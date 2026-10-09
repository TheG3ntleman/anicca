import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'MutationObserver', 'Option']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const directory = await mkdtemp(join(tmpdir(), 'anicca-tests-'));
try {
  const model = await build({ entryPoints: ['src/state/EntrySession.ts'], bundle: true, write: false, metafile: true, platform: 'node', format: 'esm' });
  if (Object.keys(model.metafile.inputs).some((path) => path.includes('node_modules/') || path.includes('components/'))) {
    throw new Error('EntrySession must not depend on an editor, UI, or React.');
  }
  console.log('PASS: primary entry state has no editor or UI dependencies.');
  const outfile = join(directory, 'editor-tests.mjs');
  await build({ entryPoints: ['tests/editor.test.ts'], outfile, bundle: true, platform: 'node', format: 'esm', loader: { '.css': 'local-css' } });
  await import(pathToFileURL(outfile).href);
} finally {
  dom.window.close();
  await rm(directory, { recursive: true, force: true });
}
