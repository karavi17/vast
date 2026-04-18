export type OfflineDownloadMeta = {
  id: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  language?: string;
  quality?: string;
  createdAt: number;
  mimeType: string;
  size: number;
};

type OfflineDownloadRecord = OfflineDownloadMeta & {
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
};

const DB_NAME = 'app-offline-downloads';
const DB_VERSION = 1;
const STORE_DOWNLOADS = 'downloads';
const STORE_KEYS = 'keys';

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_DOWNLOADS)) {
        const store = db.createObjectStore(STORE_DOWNLOADS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('videoId', 'videoId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const db = await openDb();
  const tx = db.transaction(STORE_KEYS, 'readwrite');
  const store = tx.objectStore(STORE_KEYS);

  const existing = await promisifyRequest<{ id: string; jwk: JsonWebKey } | undefined>(
    store.get('device-aes-gcm')
  );
  if (existing?.jwk) {
    return crypto.subtle.importKey('jwk', existing.jwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const jwk = await crypto.subtle.exportKey('jwk', key);
  store.put({ id: 'device-aes-gcm', jwk });
  await waitForTx(tx);
  return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptBytes(plaintext: ArrayBuffer): Promise<{ iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const key = await getOrCreateDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv, ciphertext };
}

async function decryptBytes(iv: ArrayBuffer, ciphertext: ArrayBuffer): Promise<ArrayBuffer> {
  const key = await getOrCreateDeviceKey();
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, ciphertext);
}

export async function saveOfflineDownload(input: {
  id: string;
  videoId: string;
  title: string;
  thumbnail?: string;
  language?: string;
  quality?: string;
  mimeType: string;
  bytes: ArrayBuffer;
}): Promise<OfflineDownloadMeta> {
  const { iv, ciphertext } = await encryptBytes(input.bytes);
  const record: OfflineDownloadRecord = {
    id: input.id,
    videoId: input.videoId,
    title: input.title,
    thumbnail: input.thumbnail,
    language: input.language,
    quality: input.quality,
    createdAt: Date.now(),
    mimeType: input.mimeType,
    size: ciphertext.byteLength,
    iv: iv.slice().buffer,
    ciphertext,
  };

  const db = await openDb();
  const tx = db.transaction(STORE_DOWNLOADS, 'readwrite');
  tx.objectStore(STORE_DOWNLOADS).put(record);
  await waitForTx(tx);

  return {
    id: record.id,
    videoId: record.videoId,
    title: record.title,
    thumbnail: record.thumbnail,
    language: record.language,
    quality: record.quality,
    createdAt: record.createdAt,
    mimeType: record.mimeType,
    size: record.size,
  };
}

export async function listOfflineDownloads(): Promise<OfflineDownloadMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE_DOWNLOADS, 'readonly');
  const store = tx.objectStore(STORE_DOWNLOADS);
  const all = await promisifyRequest<OfflineDownloadRecord[]>(store.getAll());
  return all
    .map((r) => ({
      id: r.id,
      videoId: r.videoId,
      title: r.title,
      thumbnail: r.thumbnail,
      language: r.language,
      quality: r.quality,
      createdAt: r.createdAt,
      mimeType: r.mimeType,
      size: r.size,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getOfflineDownloadMeta(id: string): Promise<OfflineDownloadMeta | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_DOWNLOADS, 'readonly');
  const store = tx.objectStore(STORE_DOWNLOADS);
  const record = await promisifyRequest<OfflineDownloadRecord | undefined>(store.get(id));
  if (!record) return null;
  return {
    id: record.id,
    videoId: record.videoId,
    title: record.title,
    thumbnail: record.thumbnail,
    language: record.language,
    quality: record.quality,
    createdAt: record.createdAt,
    mimeType: record.mimeType,
    size: record.size,
  };
}

export async function getOfflineDownloadBlobUrl(id: string): Promise<{ url: string; revoke: () => void } | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_DOWNLOADS, 'readonly');
  const store = tx.objectStore(STORE_DOWNLOADS);
  const record = await promisifyRequest<OfflineDownloadRecord | undefined>(store.get(id));
  if (!record) return null;

  const plaintext = await decryptBytes(record.iv, record.ciphertext);
  const blob = new Blob([plaintext], { type: record.mimeType });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export async function deleteOfflineDownload(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_DOWNLOADS, 'readwrite');
  tx.objectStore(STORE_DOWNLOADS).delete(id);
  await waitForTx(tx);
}
