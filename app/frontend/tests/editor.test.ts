import assert from 'node:assert/strict';
import { EditorState, TextSelection, NodeSelection } from 'prosemirror-state';
import { history, undo } from 'prosemirror-history';
import { Fragment } from 'prosemirror-model';
import { EditorView } from 'prosemirror-view';
import { BoxView } from '../src/components/AniccaEditor/prosemirror/nodeViews/BoxView';
import { FieldView } from '../src/components/AniccaEditor/prosemirror/nodeViews/FieldView';
import { editorSchema as schema } from '../src/components/AniccaEditor/prosemirror/schema';
import { boxDepth, findBoxTrigger, insertBox, unwrapBox, leaveBox } from '../src/components/AniccaEditor/prosemirror/commands';
import { nestingLimit, documentDepth } from '../src/components/AniccaEditor/prosemirror/plugins/nestingLimit';
import { fromAniccaDocument, toAniccaDocument, boxToEditor } from '../src/components/AniccaEditor/prosemirror/conversion';
import { parseDocument, serializeDocument } from '../src/document/serialization';
import { boxDefinitions } from '../src/document/boxDefinitions';
import { BoxRegistry } from '../src/document/boxRegistry';
import { createBox } from '../src/document/boxInstances';
import { validateDocument, missingRequiredFields, getValidationIssues } from '../src/document/validation';
import { EntrySession, createEntry } from '../src/state/EntrySession';
import { EntryEditorAdapter } from '../src/components/AniccaEditor/prosemirror/adapter';
import { findBox } from '../src/document/operations';
import type { BoxDefinition, NarrativeDocument } from '../src/document/types';

// Deliberately includes multiple recursive fields and a scalar-only leaf type.
const custom: BoxDefinition = { id: 'user.compare', version: 1, selector: 'compare', label: 'Compare', fields: [
  { name: 'title', label: 'Title', kind: 'text', required: true },
  { name: 'before', label: 'Before', kind: 'freeform' },
  { name: 'after', label: 'After', kind: 'freeform' },
  { name: 'score', label: 'Score', kind: 'number', min: 0, max: 5, default: 2 },
] };
const leaf: BoxDefinition = { id: 'user.rating', version: 1, selector: 'rating', label: 'Rating', fields: [
  { name: 'value', label: null, kind: 'number' },
] };
const registry = new BoxRegistry([...boxDefinitions, custom, leaf]);
assert.equal(registry.matching('comp')[0].id, 'user.compare');
assert.throws(() => { registry.get(custom.id, 1).label = 'Mutated'; });
assert.throws(() => new BoxRegistry([...boxDefinitions, { ...custom, selector: 'emotion' }]));
assert.throws(() => new BoxRegistry([{ ...custom, fields: [{ name: '__proto__', label: null, kind: 'text' }] }]));
assert.throws(() => new BoxRegistry([{ ...custom, fields: [{ name: 'phase', label: null, kind: 'choice', options: ['a'], default: 'b' }] }]));
const updated = { ...custom, version: 2, label: 'New compare' };
const versions = new BoxRegistry([...registry.definitions, updated]);
assert.equal(versions.matching('compare')[0].version, 2);
assert.equal(versions.get(custom.id, 1).label, 'Compare');
assert.throws(() => registry.extend([{ ...custom, label: 'Changed in place' }]));
assert.equal(registry.extend([updated]).get(custom.id, 1).label, 'Compare');
console.log('PASS: custom definitions, defaults, immutable version lookup, and safe field constraints.');

const outer = createBox(custom);
outer.id = 'outer';
outer.fields.before = { kind: 'freeform', content: [{ type: 'text', text: 'literal @box{ } \\ " \n🙂' }, createBox(boxDefinitions[0])] };
outer.fields.after = { kind: 'freeform', content: [{ type: 'lineBreak' }, createBox(boxDefinitions[3])] };
assert.deepEqual(missingRequiredFields(outer, registry), ['title']);
const document: NarrativeDocument = { schemaVersion: 2, id: 'root', type: 'narrative', definitions: registry.definitions,
  content: [{ type: 'paragraph', content: [outer, createBox(leaf)] }, { type: 'paragraph', content: [] }] };
assert.deepEqual(parseDocument(serializeDocument(document)), document);
assert.deepEqual(toAniccaDocument(fromAniccaDocument(document, schema), 'root', registry.definitions), document);
const shuffled = structuredClone(document);
const shuffledBox = shuffled.content[0].content[0] as any;
shuffledBox.fields = Object.fromEntries(Object.entries(shuffledBox.fields).reverse());
assert.deepEqual(toAniccaDocument(fromAniccaDocument(shuffled, schema), 'root', registry.definitions), document);
assert.throws(() => parseDocument(serializeDocument(document) + 'garbage'));
const invalid = structuredClone(document);
(invalid.content[0].content[0] as any).definitionId = 'missing';
assert.throws(() => validateDocument(invalid));
const invalidNumber = structuredClone(document);
(invalidNumber.content[0].content[0] as any).fields.score.value = 99;
validateDocument(invalidNumber);
assert.ok(getValidationIssues(invalidNumber).some((issue) => issue.code === 'range'));
assert.deepEqual(parseDocument(serializeDocument(invalidNumber)), invalidNumber);
console.log('PASS: custom multi-field trees, scalar leaves, incomplete drafts, and raw/editor round trips.');

const legacy = '@document("old",1){@paragraph{@text("hello")@freeform("old-box","freeform"){@text("world")}}}';
const migrated = parseDocument(legacy);
assert.equal(migrated.schemaVersion, 2);
assert.equal((migrated.content[0].content[1] as any).definitionId, 'builtin.freeform');
assert.deepEqual(parseDocument(serializeDocument(migrated)), migrated);
console.log('PASS: previous raw records migrate without losing content or IDs.');

let state = EditorState.create({ schema, plugins: [nestingLimit(() => 3, () => registry), history()] });
const dispatch = (transaction: any) => { state = state.applyTransaction(transaction).state; };
const type = (text: string) => dispatch(state.tr.insertText(text));
const insert = (definition = boxDefinitions[0]) => {
  const trigger = findBoxTrigger(state); assert.ok(trigger);
  return insertBox(trigger, definition, 3)(state, dispatch);
};
for (let depth = 1; depth <= 3; depth++) {
  type('@freeform'); assert.equal(insert(), true);
  assert.equal(boxDepth(state), depth);
  assert.equal(documentDepth(state.doc), depth);
}
type('@freeform'); assert.equal(insert(), false);
const previous = state.doc;
dispatch(state.tr.replaceSelectionWith(boxToEditor(createBox(custom), schema)));
assert.equal(state.doc, previous);
assert.equal(leaveBox(1)(state, dispatch), true);
assert.equal(boxDepth(state), 2);
console.log('PASS: generic recursive insertion and transaction depth validation.');

state = EditorState.create({ schema, plugins: [nestingLimit(() => 3, () => registry), history()] });
type('@emotion'); insert(boxDefinitions[1]); type('keep comment');
const originalId = state.doc.firstChild!.firstChild!.attrs.id;
let labelPosition = -1;
state.doc.descendants((node, position) => { if (node.type.name === 'box_field' && node.attrs.name === 'label') labelPosition = position; });
const labelNode = state.doc.nodeAt(labelPosition)!;
dispatch(state.tr.setNodeMarkup(labelPosition, undefined, { ...labelNode.attrs, value: 'happy' }));
dispatch(state.tr.setSelection(NodeSelection.create(state.doc, 1)));
assert.equal(unwrapBox(state, dispatch), true);
assert.equal(state.doc.textContent, '@emotion label="happy" comment: keep comment');
assert.equal(undo(state, dispatch), true);
assert.equal(state.doc.firstChild!.firstChild!.attrs.id, originalId);
assert.equal(state.doc.firstChild!.firstChild!.firstChild!.attrs.value, 'happy');
console.log('PASS: populated scalar and recursive fields survive reversal and undo.');

state = EditorState.create({ schema, plugins: [nestingLimit(() => 3, () => registry), history()] });
type('@freeform'); insert(); type('abc');
dispatch(state.tr.setSelection(TextSelection.create(state.doc, 4)));
assert.equal(unwrapBox(state, dispatch), false);
dispatch(state.tr.setSelection(TextSelection.create(state.doc, 3)));
assert.equal(unwrapBox(state, dispatch), true);
assert.equal(state.doc.textContent, '@freeform abc');
console.log('PASS: beginning-of-box reversal leaves ordinary text deletion alone.');

state = EditorState.create({ doc: fromAniccaDocument(document, schema), plugins: [nestingLimit(() => 3, () => registry), history()] });
dispatch(state.tr.setSelection(NodeSelection.create(state.doc, 1)));
assert.equal(unwrapBox(state, dispatch), true);
assert.equal(undo(state, dispatch), true);
assert.deepEqual(toAniccaDocument(state.doc, 'root', registry.definitions), document);
console.log('PASS: generic multi-field reversal restores the exact nested tree.');

state = EditorState.create({ schema, plugins: [nestingLimit(() => 3, () => registry)] });
const duplicate = boxToEditor(createBox(custom), schema);
dispatch(state.tr.insert(1, [duplicate, duplicate]));
const ids: string[] = [];
state.doc.descendants((node) => { if (node.type.name === 'box') ids.push(node.attrs.id); });
assert.equal(new Set(ids).size, 2);
const corrupt = duplicate.copy(Fragment.from(schema.nodes.box_field.create({ name: 'wrong', kind: 'text', value: '' })));
const beforeCorrupt = state.doc;
dispatch(state.tr.insert(1, corrupt));
assert.equal(state.doc, beforeCorrupt);
console.log('PASS: pasted duplicate IDs repaired; invalid field structures rejected.');

// Verify the actual generic DOM renderer, not just its data conversion.
const host = globalThis.document.createElement('div');
globalThis.document.body.append(host);
const view = new EditorView(host, {
  state: EditorState.create({ doc: fromAniccaDocument(document, schema), plugins: [nestingLimit(() => 3, () => registry), history()] }),
  nodeViews: {
    box: (node) => new BoxView(node, () => registry),
    box_field: (node, view, getPos) => new FieldView(node, view, getPos, registry),
  },
  dispatchTransaction(transaction) { view.updateState(view.state.applyTransaction(transaction).state); },
});
const titleInput = host.querySelector<HTMLInputElement>('input[aria-label="Title"]')!;
assert.ok(titleInput);
assert.equal(titleInput.getAttribute('aria-required'), 'true');
titleInput.value = 'My comparison';
titleInput.dispatchEvent(new window.Event('input', { bubbles: true }));
let snapshot = toAniccaDocument(view.state.doc, 'root', registry.definitions);
assert.equal((snapshot.content[0].content[0] as any).fields.title.value, 'My comparison');
const phaseInput = host.querySelector<HTMLSelectElement>('select[aria-label="Phase"]')!;
assert.ok(phaseInput);
phaseInput.value = 'start';
phaseInput.dispatchEvent(new window.Event('input', { bubbles: true }));
snapshot = toAniccaDocument(view.state.doc, 'root', registry.definitions);
assert.deepEqual(parseDocument(serializeDocument(snapshot)), snapshot);
const score = host.querySelector<HTMLInputElement>('input[aria-label="Score"]')!;
assert.equal(score.min, '0'); assert.equal(score.max, '5'); assert.equal(score.value, '2');
assert.ok(host.textContent!.includes('Before'));
assert.ok(host.textContent!.includes('After'));
view.destroy(); host.remove();
console.log('PASS: generic DOM fields render required labels, multiple editable slots, constraints, and live scalar updates.');

const session = new EntrySession(createEntry(registry.definitions), 3);
let notices = 0;
const unsubscribe = session.subscribe(() => notices++);
const customInstance = createBox(custom);
session.apply({ type: 'insertBox', target: { paragraph: 0 }, index: 0, box: customInstance });
assert.equal(session.getSnapshot().revision, 1);
assert.ok(session.getSnapshot().issues.some((issue) => issue.code === 'required'));
assert.throws(() => { session.getSnapshot().document.id = 'mutated'; });
session.apply({ type: 'setField', boxId: customInstance.id, field: 'score', value: { kind: 'number', value: 99 } });
assert.ok(session.getSnapshot().issues.some((issue) => issue.code === 'range'));
assert.deepEqual(parseDocument(serializeDocument(session.getSnapshot().document)), session.getSnapshot().document);
const committed = session.getSnapshot();
assert.throws(() => session.apply({ type: 'setField', boxId: customInstance.id, field: 'score', value: { kind: 'text', value: 'wrong' } }));
assert.equal(session.getSnapshot(), committed);
assert.equal(notices, 2);
unsubscribe();
console.log('PASS: independent immutable session accepts incomplete/value-invalid drafts and atomically rejects structural errors.');

const projectionHost = globalThis.document.createElement('div');
globalThis.document.body.append(projectionHost);
let adapter: EntryEditorAdapter;
const projection = new EditorView(projectionHost, {
  state: EditorState.create({ doc: fromAniccaDocument(session.getSnapshot().document, schema), plugins: [
    nestingLimit(() => session.maxDepth, () => session.registry, () => session.getSnapshot().document.id), history(),
  ] }),
  nodeViews: {
    box: (node) => new BoxView(node, () => session.registry),
    box_field: (node, view, getPos) => new FieldView(node, view, getPos, session.registry),
  },
  dispatchTransaction(transaction) { adapter.dispatch(transaction); },
});
adapter = new EntryEditorAdapter(projection, session);
const scoreInput = projectionHost.querySelector<HTMLInputElement>('input[aria-label="Score"]')!;
assert.equal(scoreInput.value, '99');
assert.equal(scoreInput.getAttribute('aria-invalid'), 'true');
scoreInput.value = '4'; scoreInput.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal((findBox(session.getSnapshot().document, customInstance.id)!.fields.score as any).value, 4);
assert.equal(scoreInput.getAttribute('aria-invalid'), 'false');
const beforeSelection = session.getSnapshot().revision;
projection.dispatch(projection.state.tr.setSelection(NodeSelection.create(projection.state.doc, 1)));
assert.equal(session.getSnapshot().revision, beforeSelection);
const selectionPosition = projection.state.selection.from;
session.apply({ type: 'setField', boxId: customInstance.id, field: 'title', value: { kind: 'text', value: 'External edit' } });
assert.equal(projectionHost.querySelector<HTMLInputElement>('input[aria-label="Title"]')!.value, 'External edit');
assert.equal(projection.state.selection.from, selectionPosition);
assert.deepEqual(toAniccaDocument(projection.state.doc, session.getSnapshot().document.id, session.registry.definitions), session.getSnapshot().document);
projectionHost.querySelector<HTMLInputElement>('input[aria-label="Title"]')!.value = 'Editor edit';
projectionHost.querySelector<HTMLInputElement>('input[aria-label="Title"]')!.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal((findBox(session.getSnapshot().document, customInstance.id)!.fields.title as any).value, 'Editor edit');
assert.equal(undo(projection.state, projection.dispatch), true);
assert.equal((findBox(session.getSnapshot().document, customInstance.id)!.fields.title as any).value, 'External edit');
session.addDefinitions([{ ...custom, id: 'user.new', selector: 'newbox' }]);
assert.ok(session.registry.matching('newbox').length);
session.apply({ type: 'unwrapBox', boxId: customInstance.id });
assert.deepEqual(toAniccaDocument(projection.state.doc, session.getSnapshot().document.id, session.registry.definitions), session.getSnapshot().document);
adapter.destroy(); projection.destroy(); projectionHost.remove();
console.log('PASS: adapter commits live fields and undo to primary AST, projects external edits, preserves selection, and adds definitions without remounting.');

// Session state continues to exist after the editor is destroyed.
const savedSnapshot = session.getSnapshot();
session.apply({ type: 'replaceContent', target: { paragraph: 0 }, content: [{ type: 'text', text: 'Still independent' }] });
assert.ok(session.getSnapshot().revision > savedSnapshot.revision);
assert.equal(session.getSnapshot().document.content[0].content[0].type, 'text');
const limitedSession = new EntrySession(createEntry(), 1);
const nestedOuter = createBox(boxDefinitions[0]);
(nestedOuter.fields.content as any).content = [createBox(boxDefinitions[0])];
assert.throws(() => limitedSession.apply({ type: 'insertBox', target: { paragraph: 0 }, index: 0, box: nestedOuter }));
assert.equal(limitedSession.getSnapshot().revision, 0);
console.log('PASS: session survives editor destruction and enforces depth without ProseMirror.');
