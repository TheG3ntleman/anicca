import { useSyncExternalStore } from 'react';
import type { EntrySession } from './EntrySession';

export function useEntrySession(session: EntrySession) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
