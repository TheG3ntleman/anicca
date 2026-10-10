import type {
  PlanningData,
  Collection,
  ImportConflict,
  ConflictChoices,
} from './types';
import { COLLECTIONS } from './types';
export const collections: readonly Collection[] = COLLECTIONS;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function importConflicts(
  local: PlanningData,
  incoming: PlanningData,
): ImportConflict[] {
  return collections.flatMap((collection) => {
    const current = new Map(
      local[collection].map((record) => [record.id, record]),
    );
    return incoming[collection].flatMap((record) => {
      const existing = current.get(record.id);
      return existing && canonical(existing) !== canonical(record)
        ? [
            {
              key: `${collection}:${record.id}`,
              collection,
              local: existing,
              incoming: record,
            },
          ]
        : [];
    });
  });
}
export function mergeData(
  local: PlanningData,
  incoming: PlanningData,
  choices: ConflictChoices,
): PlanningData {
  const conflicts = importConflicts(local, incoming);
  for (const conflict of conflicts)
    if (!['local', 'incoming'].includes(choices[conflict.key]))
      throw new Error('Choose which version to keep for every conflict.');
  const merged: PlanningData = {
    tasks: [],
    logs: [],
    logLinks: [],
    attachments: [],
    events: [],
    reviews: [],
  };
  for (const collection of collections) {
    const records = new Map(
      local[collection].map((record) => [record.id, record]),
    );
    for (const record of incoming[collection]) {
      if (
        !records.has(record.id) ||
        choices[`${collection}:${record.id}`] !== 'local'
      )
        records.set(record.id, record);
    }
    // Records stay typed by their originating collection.
    (merged[collection] as PlanningData[Collection][number][]) = [
      ...records.values(),
    ];
  }
  return merged;
}
