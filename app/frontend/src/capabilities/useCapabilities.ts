import { useSyncExternalStore } from 'react';

const queries = {
  spacious: '(min-width: 900px)',
  finePointer: '(pointer: fine)',
  hover: '(hover: hover)',
} as const;

function getSnapshot(): string {
  return Object.values(queries)
    .map((query) => (window.matchMedia(query).matches ? '1' : '0'))
    .join('');
}

function subscribe(onChange: () => void): () => void {
  const media = Object.values(queries).map((query) => window.matchMedia(query));
  media.forEach((query) => query.addEventListener('change', onChange));
  return () => media.forEach((query) => query.removeEventListener('change', onChange));
}

export function useCapabilities() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => '000');
  const spacious = snapshot[0] === '1';
  const finePointer = snapshot[1] === '1';
  const hover = snapshot[2] === '1';

  return {
    spacious,
    finePointer,
    hover,
    // Layout policy, not device identification or proof of analysis availability.
    mode: spacious && finePointer && hover ? 'desktop' as const : 'phone' as const,
  };
}
