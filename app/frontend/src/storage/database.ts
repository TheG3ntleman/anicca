import {
  migrateTaskV1,
  migrateTaskEventV1,
} from '../domain/migrations/planningV2';

import { migrateNoteV2 } from '../domain/migrations/planningV3';
import { COLLECTIONS } from '../domain/transfer/types';
export const DATABASE_VERSION = 3;
export const STORES = COLLECTIONS;
export const MEDIA_STORE = 'media';
export function request<T>(operation: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}
export function completion(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Database transaction aborted.'));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Database write failed.'));
  });
}
export function openDatabase(
  name = 'anicca-planning',
  onVersionChange?: () => void,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local storage is unavailable in this browser.'));
      return;
    }
    const opening = indexedDB.open(name, DATABASE_VERSION);
    let blocked = false;
    let migrationError: unknown;
    opening.onupgradeneeded = (event) => {
      // Migration v1: new planning records; no journal records are touched.
      for (const store of [...STORES, MEDIA_STORE])
        if (!opening.result.objectStoreNames.contains(store))
          opening.result.createObjectStore(store, { keyPath: 'id' });
      if (event.oldVersion === 1) {
        // Upgrade tasks and every history snapshot in the same transaction.
        // Keep IDs, dates, notes, reviews, timestamps, and event relationships.
        const transaction = opening.transaction!;
        for (const [store, migrate] of [
          ['tasks', migrateTaskV1],
          ['events', migrateTaskEventV1],
        ] as const) {
          const cursorRequest = transaction.objectStore(store).openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;
            try {
              cursor.update(migrate(cursor.value));
              cursor.continue();
            } catch (error) {
              migrationError = error;
              transaction.abort();
            }
          };
        }
      }
      if (event.oldVersion > 0 && event.oldVersion < 3) {
        const transaction = opening.transaction!;
        const notes = transaction.objectStore('notes').openCursor();
        notes.onsuccess = () => {
          const cursor = notes.result;
          if (!cursor) {
            opening.result.deleteObjectStore('notes');
            return;
          }
          try {
            const { log, link } = migrateNoteV2(cursor.value);
            transaction.objectStore('logs').add(log);
            transaction.objectStore('logLinks').add(link);
            cursor.continue();
          } catch (error) {
            migrationError = error;
            transaction.abort();
          }
        };
      }
    };
    opening.onblocked = () => {
      blocked = true;
      reject(
        new Error('Close other Anicca tabs to finish the database upgrade.'),
      );
    };
    opening.onerror = () =>
      reject(
        migrationError ??
          opening.error ??
          new Error('Unable to open local storage.'),
      );
    opening.onsuccess = () => {
      if (blocked) {
        opening.result.close();
        return;
      }
      opening.result.onversionchange = () => {
        opening.result.close();
        onVersionChange?.();
      };
      resolve(opening.result);
    };
  });
}
