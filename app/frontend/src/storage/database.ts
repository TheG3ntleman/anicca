export const DATABASE_VERSION = 1;
export const STORES = ['tasks', 'notes', 'events', 'reviews'] as const;
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
export function openDatabase(name = 'anicca-planning'): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Local storage is unavailable in this browser.'));
      return;
    }
    const opening = indexedDB.open(name, DATABASE_VERSION);
    let blocked = false;
    opening.onupgradeneeded = () => {
      // Migration v1: new planning records; no journal records are touched.
      for (const store of STORES)
        if (!opening.result.objectStoreNames.contains(store))
          opening.result.createObjectStore(store, { keyPath: 'id' });
    };
    opening.onblocked = () => {
      blocked = true;
      reject(
        new Error('Close other Anicca tabs to finish the database upgrade.'),
      );
    };
    opening.onerror = () =>
      reject(opening.error ?? new Error('Unable to open local storage.'));
    opening.onsuccess = () => {
      if (blocked) {
        opening.result.close();
        return;
      }
      opening.result.onversionchange = () => opening.result.close();
      resolve(opening.result);
    };
  });
}
