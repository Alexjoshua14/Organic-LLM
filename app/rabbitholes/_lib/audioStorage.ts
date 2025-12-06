const DB_NAME = "rabbit-hole-audio";
const DB_VERSION = 1;
const STORE_NAME = "audio";

interface AudioRecord {
  nodeId: string;
  audioUrl: string;
  generatedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: "nodeId",
        });
        objectStore.createIndex("generatedAt", "generatedAt", {
          unique: false,
        });
      }
    };
  });

  return dbPromise;
}

export async function getAudioForNode(nodeId: string): Promise<string | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(nodeId);

      request.onsuccess = () => {
        const record = request.result as AudioRecord | undefined;
        resolve(record?.audioUrl || null);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to get audio from IndexedDB:", error);
    return null;
  }
}

export async function saveAudioForNode(
  nodeId: string,
  audioData: Uint8Array
): Promise<string> {
  try {
    // Create blob and URL - create a new Uint8Array to ensure proper type
    const data = new Uint8Array(audioData);
    const blob = new Blob([data], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(blob);

    // Save to IndexedDB
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const record: AudioRecord = {
        nodeId,
        audioUrl,
        generatedAt: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => resolve(audioUrl);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to save audio to IndexedDB:", error);
    // Still return URL even if save fails
    const data = new Uint8Array(audioData);
    const blob = new Blob([data], { type: "audio/mpeg" });
    return URL.createObjectURL(blob);
  }
}

export async function cleanupOldAudio(
  maxAge: number = 7 * 24 * 60 * 60 * 1000
) {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("generatedAt");
    const cutoff = Date.now() - maxAge;

    return new Promise<void>((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const record = cursor.value as AudioRecord;
          // Revoke URL to free memory
          URL.revokeObjectURL(record.audioUrl);
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn("Failed to cleanup old audio:", error);
  }
}
