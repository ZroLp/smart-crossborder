function createSuccessRequest<T>(value: T) {
  let handler: ((event: Event) => void) | null = null;
  return {
    get result() { return value; },
    get onsuccess() { return handler; },
    set onsuccess(fn: ((event: Event) => void) | null) {
      handler = fn;
      if (fn) fn(new Event('success'));
    },
    onerror: null as ((event: Event) => void) | null,
    error: null as Error | null,
  };
}

function createMockObjectStore(keyPath: string) {
  const data = new Map<string, unknown>();
  return {
    keyPath,
    _data: data,
    put(value: unknown) {
      const key = (value as Record<string, unknown>)[keyPath] as string;
      data.set(key, value);
      return createSuccessRequest(value);
    },
    get(key: string) {
      return createSuccessRequest(data.get(key) ?? undefined);
    },
    getAll() {
      return createSuccessRequest(Array.from(data.values()));
    },
    clear() {
      data.clear();
      return createSuccessRequest(undefined);
    },
    delete(key: string) {
      data.delete(key);
      return createSuccessRequest(undefined);
    },
  };
}

function createMockDatabase(storeNames: string[]) {
  const stores = new Map<string, ReturnType<typeof createMockObjectStore>>();
  for (const name of storeNames) {
    stores.set(name, createMockObjectStore('key'));
  }

  return {
    objectStoreNames: {
      contains(name: string) {
        return stores.has(name);
      },
    },
    createObjectStore(name: string) {
      const store = createMockObjectStore('key');
      stores.set(name, store);
      return store;
    },
    transaction(names: string[], _mode: string) {
      const tx = {
        objectStore(name: string) {
          return stores.get(name)!;
        },
        get oncomplete() { return null; },
        set oncomplete(fn: (() => void) | null) {
          if (fn) fn();
        },
        onerror: null as (() => void) | null,
        error: null as Error | null,
      };
      return tx;
    },
    close() {},
  };
}

function setupIndexedDBMock() {
  const db = createMockDatabase(['dashboard-data', 'tasks', 'messages']);

  const mockOpen = jest.fn().mockReturnValue({
    get result() { return db; },
    get onupgradeneeded() { return null; },
    set onupgradeneeded(_fn: ((event: Event) => void) | null) {},
    get onsuccess() { return null; },
    set onsuccess(fn: ((event: Event) => void) | null) {
      if (fn) fn(new Event('success'));
    },
    get onerror() { return null; },
    set onerror(_fn: ((event: Event) => void) | null) {},
    error: null as Error | null,
  });

  (global as Record<string, unknown>).indexedDB = {
    open: mockOpen,
  };

  return { db, mockOpen };
}

beforeEach(() => {
  jest.resetModules();
  delete (global as Record<string, unknown>).indexedDB;
});

afterEach(() => {
  delete (global as Record<string, unknown>).indexedDB;
});

async function getCacheManager() {
  setupIndexedDBMock();
  const mod = await import('@/lib/offline/cache-manager');
  return mod;
}

describe('CacheManager', () => {
  test('saves and retrieves data from dashboard-data store', async () => {
    const { saveData, getData } = await getCacheManager();
    const testData = { revenue: 12680, orders: 86 };

    await saveData('dashboard-data', 'today', testData);
    const result = await getData('dashboard-data', 'today');

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(testData);
    expect(typeof result!.timestamp).toBe('number');
  });

  test('saves and retrieves data from tasks store', async () => {
    const { saveData, getData } = await getCacheManager();
    const tasks = [{ title: 'Task 1', urgency: 'high' }];

    await saveData('tasks', 'pending', tasks);
    const result = await getData('tasks', 'pending');

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(tasks);
  });

  test('saves and retrieves data from messages store', async () => {
    const { saveData, getData } = await getCacheManager();
    const messages = [{ text: 'Hello', from: 'system' }];

    await saveData('messages', 'inbox', messages);
    const result = await getData('messages', 'inbox');

    expect(result).not.toBeNull();
    expect(result!.data).toEqual(messages);
  });

  test('returns null for non-existent key', async () => {
    const { getData } = await getCacheManager();
    const result = await getData('dashboard-data', 'nonexistent');
    expect(result).toBeNull();
  });

  test('overwrites existing entry on save', async () => {
    const { saveData, getData } = await getCacheManager();

    await saveData('dashboard-data', 'key1', { value: 1 });
    await saveData('dashboard-data', 'key1', { value: 2 });
    const result = await getData('dashboard-data', 'key1');

    expect(result!.data).toEqual({ value: 2 });
  });

  test('getAllData returns all entries in store', async () => {
    const { saveData, getAllData } = await getCacheManager();

    await saveData('dashboard-data', 'a', { name: 'a' });
    await saveData('dashboard-data', 'b', { name: 'b' });
    await saveData('dashboard-data', 'c', { name: 'c' });

    const all = await getAllData('dashboard-data');
    expect(all).toHaveLength(3);
    expect(all.map((e) => e.key).sort()).toEqual(['a', 'b', 'c']);
  });

  test('getAllData returns empty array for empty store', async () => {
    const { getAllData } = await getCacheManager();
    const all = await getAllData('tasks');
    expect(all).toEqual([]);
  });

  test('clearStore removes all entries from a single store', async () => {
    const { saveData, clearStore, getAllData, getData } = await getCacheManager();

    await saveData('dashboard-data', 'x', { val: 1 });
    await saveData('tasks', 'y', { val: 2 });
    await clearStore('dashboard-data');

    const dashboardAll = await getAllData('dashboard-data');
    expect(dashboardAll).toEqual([]);

    const tasksAll = await getAllData('tasks');
    expect(tasksAll).toHaveLength(1);

    const tasksResult = await getData('tasks', 'y');
    expect(tasksResult).not.toBeNull();
  });

  test('clearAll removes entries from all stores', async () => {
    const { saveData, clearAll, getAllData } = await getCacheManager();

    await saveData('dashboard-data', 'd1', { v: 1 });
    await saveData('tasks', 't1', { v: 2 });
    await saveData('messages', 'm1', { v: 3 });
    await clearAll();

    expect(await getAllData('dashboard-data')).toEqual([]);
    expect(await getAllData('tasks')).toEqual([]);
    expect(await getAllData('messages')).toEqual([]);
  });

  test('handles IndexedDB not available gracefully - getData returns null', async () => {
    delete (global as Record<string, unknown>).indexedDB;
    const { getData } = await import('@/lib/offline/cache-manager');
    const result = await getData('dashboard-data', 'key');
    expect(result).toBeNull();
  });

  test('handles IndexedDB not available gracefully - getAllData returns empty', async () => {
    delete (global as Record<string, unknown>).indexedDB;
    const { getAllData } = await import('@/lib/offline/cache-manager');
    const result = await getAllData('dashboard-data');
    expect(result).toEqual([]);
  });

  test('handles IndexedDB not available gracefully - saveData does not throw', async () => {
    delete (global as Record<string, unknown>).indexedDB;
    const { saveData } = await import('@/lib/offline/cache-manager');
    await expect(saveData('dashboard-data', 'k', { v: 1 })).resolves.toBeUndefined();
  });

  test('handles IndexedDB not available gracefully - clearStore does not throw', async () => {
    delete (global as Record<string, unknown>).indexedDB;
    const { clearStore } = await import('@/lib/offline/cache-manager');
    await expect(clearStore('dashboard-data')).resolves.toBeUndefined();
  });

  test('handles IndexedDB not available gracefully - clearAll does not throw', async () => {
    delete (global as Record<string, unknown>).indexedDB;
    const { clearAll } = await import('@/lib/offline/cache-manager');
    await expect(clearAll()).resolves.toBeUndefined();
  });

  test('timestamp is set correctly on save', async () => {
    const { saveData, getData } = await getCacheManager();
    const before = Date.now();

    await saveData('dashboard-data', 'ts-test', { value: 42 });
    const after = Date.now();
    const result = await getData('dashboard-data', 'ts-test');

    expect(result).not.toBeNull();
    expect(result!.timestamp).toBeGreaterThanOrEqual(before);
    expect(result!.timestamp).toBeLessThanOrEqual(after);
  });

  test('stores across different stores are independent', async () => {
    const { saveData, getData } = await getCacheManager();

    await saveData('dashboard-data', 'shared-key', { from: 'dashboard' });
    await saveData('tasks', 'shared-key', { from: 'tasks' });

    const dashResult = await getData('dashboard-data', 'shared-key');
    const taskResult = await getData('tasks', 'shared-key');

    expect(dashResult!.data).toEqual({ from: 'dashboard' });
    expect(taskResult!.data).toEqual({ from: 'tasks' });
  });

  test('handles complex nested data', async () => {
    const { saveData, getData } = await getCacheManager();
    const complexData = {
      nested: { deep: { value: 123 } },
      array: [1, 'two', false, null],
      boolean: true,
    };

    await saveData('dashboard-data', 'complex', complexData);
    const result = await getData('dashboard-data', 'complex');
    expect(result!.data).toEqual(complexData);
  });
});
