import { useSyncExternalStore } from 'react';
import type { PlanningStore } from './PlanningStore';
export function usePlanning(store: PlanningStore) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}
