// Saves an intern's WordPress site (a zip of wp-content, database included)
// in their browser's IndexedDB, so it's still there next visit. Nothing is
// uploaded: a site is several MB, and keeping it in the browser costs the
// app no storage or bandwidth.

const DB = "grouh-wordpress-lab";
const STORE = "sites";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export type SavedSite = { zip: Uint8Array; savedAt: string };

export const loadSite = (key: string) =>
  run<SavedSite | undefined>("readonly", (store) => store.get(key)).catch(() => undefined);

export const saveSite = (key: string, zip: Uint8Array) =>
  run<IDBValidKey>("readwrite", (store) => store.put({ zip, savedAt: new Date().toISOString() } satisfies SavedSite, key));

export const deleteSite = (key: string) => run<undefined>("readwrite", (store) => store.delete(key)).catch(() => undefined);
