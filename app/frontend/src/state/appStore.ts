import { PlanningStore } from './PlanningStore';

// One connection per app instance, independent of React's StrictMode mounts.
export const planningStore = new PlanningStore();

if (import.meta.hot) {
  import.meta.hot.dispose(() => void planningStore.close());
}
