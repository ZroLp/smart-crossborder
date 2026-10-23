const DB_NAME = 'sumaitong-offline';
const DB_VERSION = 1;
const STORE_NAMES = ['dashboard-data', 'tasks', 'messages'] as const;

export type OfflineStoreName = (typeof STORE_NAMES)[number];

export interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
}

function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!isIndexedDBAvailable()) {
    return Promise.reject(new Error('IndexedDB not available'));
  }

  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const storeName of STORE_NAMES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'key' });
          }
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }

  return dbPromise;
}

function withStore<T>(
  storeName: OfflineStoreName,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return getDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = callback(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export async function saveData(
  storeName: OfflineStoreName,
  key: string,
  data: unknown
): Promise<void> {
  try {
    await withStore(storeName, 'readwrite', (store) =>
      store.put({ key, data, timestamp: Date.now() })
    );
  } catch {
    // IndexedDB not available or error, silently ignore
  }
}

export async function getData(
  storeName: OfflineStoreName,
  key: string
): Promise<CacheEntry | null> {
  try {
    const result = await withStore(storeName, 'readonly', (store) =>
      store.get(key)
    );
    return result || null;
  } catch {
    return null;
  }
}

export async function getAllData(
  storeName: OfflineStoreName
): Promise<CacheEntry[]> {
  try {
    const result = await withStore(storeName, 'readonly', (store) =>
      store.getAll()
    );
    return result || [];
  } catch {
    return [];
  }
}

export async function clearStore(
  storeName: OfflineStoreName
): Promise<void> {
  try {
    await withStore(storeName, 'readwrite', (store) => store.clear());
  } catch {
    // silently ignore
  }
}

export async function clearAll(): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAMES as unknown as string[], 'readwrite');
    for (const storeName of STORE_NAMES) {
      tx.objectStore(storeName).clear();
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // silently ignore
  }
}
