import type { BoxDefinition } from './types';
export const DEFAULT_MAX_DEPTH = 3;

export const boxDefinitions: BoxDefinition[] = [
  { id: 'builtin.freeform', version: 1, selector: 'freeform', label: null,
    fields: [{ name: 'content', kind: 'freeform', required: true, label: null }] },
  { id: 'builtin.emotion', version: 1, selector: 'emotion', label: 'Emotion', fields: [
    { name: 'label', kind: 'text', label: 'Emotion', required: true },
    { name: 'intensity', kind: 'number', label: 'Intensity', min: 0, max: 10 },
    { name: 'comment', kind: 'freeform', label: 'Comment' },
  ] },
  { id: 'builtin.physiological', version: 1, selector: 'physiological', label: 'Physiological signal', fields: [
    { name: 'label', kind: 'text', label: 'Sensation', required: true },
    { name: 'intensity', kind: 'number', label: 'Intensity', min: 0, max: 10 },
    { name: 'comment', kind: 'freeform', label: 'Comment' },
  ] },
  { id: 'builtin.behaviour', version: 1, selector: 'behaviour', label: 'Behaviour', fields: [
    { name: 'label', kind: 'text', label: 'Behaviour', required: true },
    { name: 'phase', kind: 'choice', label: 'Phase', options: ['start', 'mid', 'end'] },
    { name: 'comment', kind: 'freeform', label: 'Comment' },
  ] },
];

