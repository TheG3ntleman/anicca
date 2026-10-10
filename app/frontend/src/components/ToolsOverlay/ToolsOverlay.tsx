import { useState } from 'react';
import type { PlanningStore } from '../../state/PlanningStore';
import { ViewOverlay } from '../ViewOverlay/ViewOverlay';
import { TaskBrowser } from '../TaskBrowser/TaskBrowser';
import { TaskDetails } from '../TaskDetails/TaskDetails';
import { DataTools } from '../DataTools/DataTools';

export function ToolsOverlay({
  store,
  onClose,
}: {
  store: PlanningStore;
  onClose: () => void;
}) {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <ViewOverlay
        title="Tasks and import/export"
        onClose={onClose}
        locked={busy || taskId !== null}
        views={[
          {
            id: 'tasks',
            label: 'Tasks',
            content: (
              <TaskBrowser
                store={store}
                onSelect={(task) => setTaskId(task.id)}
              />
            ),
          },
          {
            id: 'transfer',
            label: 'Import/export',
            content: <DataTools store={store} onBusyChange={setBusy} />,
          },
        ]}
      />
      {taskId && (
        <TaskDetails
          taskId={taskId}
          store={store}
          onClose={() => setTaskId(null)}
        />
      )}
    </>
  );
}
