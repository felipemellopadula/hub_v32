// Lightweight IndexedDB helper for storing image blobs
const DB_NAME = 'synergy_ai_image_db';
const STORE_NAME = 'images';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveImageBlob(id: string, dataUrl: string): Promise<Blob> {
  // Convert DataURL to Blob via fetch for simplicity
  const blob = await fetch(dataUrl).then(r => r.blob());
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return blob;
}

export async function loadImageBlobUrl(id: string): Promise<string | null> {
  const db = await openDB();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function pruneImages(keepIds: string[]): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const keysReq = store.getAllKeys();
    keysReq.onsuccess = () => {
      const keys = keysReq.result as IDBValidKey[];
      for (const key of keys) {
        const id = String(key);
        if (!keepIds.includes(id)) {
          store.delete(key);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
