
import { StoredFile, VaultBackup, VaultProfile } from '../types';

const DB_NAME = 'LocalVaultDB_v2'; // Changed name to ensure fresh start if corrupted
const STORE_NAME = 'secure_files';
const CHUNK_STORE = 'file_chunks';
const META_STORE = 'vault_meta'; 
const DB_VERSION = 11; // Incremented for chunk store

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e: any) => {
      const db = request.result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const fileStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        fileStore.createIndex('vaultId', 'vaultId', { unique: false });
      }
      
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        db.createObjectStore(CHUNK_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      
      // Handle unexpected closes
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      alert("Please close other tabs of this app to update the security vault.");
    };
  });
};

export const requestPersistence = async (): Promise<boolean> => {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    }
  } catch (e) {
    console.error("Persistence error", e);
  }
  return false;
};

export const checkPersistence = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persisted) {
    return await navigator.storage.persisted();
  }
  return false;
};

// PROFILE OPERATIONS
export const getVaultProfiles = async (): Promise<VaultProfile[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE, 'readonly');
    const store = transaction.objectStore(META_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveVaultProfile = async (profile: VaultProfile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(META_STORE, 'readwrite');
    const store = transaction.objectStore(META_STORE);
    store.put(profile);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteVaultProfile = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([META_STORE, STORE_NAME], 'readwrite');
    transaction.objectStore(META_STORE).delete(id);
    
    const fileStore = transaction.objectStore(STORE_NAME);
    const index = fileStore.index('vaultId');
    const request = index.openCursor(IDBKeyRange.only(id));
    
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// FILE OPERATIONS
export const getFilesByVault = async (vaultId: string): Promise<StoredFile[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    // Safety check for index
    if (!store.indexNames.contains('vaultId')) {
       console.warn("Index 'vaultId' missing, attempting fallback scan...");
       const fallbackReq = store.getAll();
       fallbackReq.onsuccess = () => {
         const all = fallbackReq.result as StoredFile[];
         resolve(all.filter(f => f.vaultId === vaultId));
       };
       return;
    }

    const index = store.index('vaultId');
    const request = index.getAll(IDBKeyRange.only(vaultId));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveFile = async (file: StoredFile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(file);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const updateFile = async (file: StoredFile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(file);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteFile = async (id: string): Promise<void> => {
  const db = await initDB();
  const file = await new Promise<StoredFile | undefined>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, CHUNK_STORE], 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    
    if (file?.isChunked && file.chunkIds) {
      const chunkStore = transaction.objectStore(CHUNK_STORE);
      for (const chunkId of file.chunkIds) {
        chunkStore.delete(chunkId);
      }
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const saveChunk = async (id: string, data: ArrayBuffer): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, 'readwrite');
    const store = transaction.objectStore(CHUNK_STORE);
    store.put({ id, data });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getChunk = async (id: string): Promise<ArrayBuffer> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, 'readonly');
    const store = transaction.objectStore(CHUNK_STORE);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result?.data);
    request.onerror = () => reject(request.error);
  });
};

export const exportFullBackup = async (): Promise<VaultBackup> => {
  const db = await initDB();
  const profiles = await getVaultProfiles();
  return new Promise((resolve, reject) => {
    const fileTransaction = db.transaction(STORE_NAME, 'readonly');
    const store = fileTransaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      resolve({
        version: 2,
        profiles,
        files: request.result || [],
        exportedAt: Date.now()
      });
    };
    request.onerror = () => reject(request.error);
  });
};

export const importFullBackup = async (backup: VaultBackup): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([META_STORE, STORE_NAME], 'readwrite');
    const metaStore = transaction.objectStore(META_STORE);
    const fileStore = transaction.objectStore(STORE_NAME);
    
    for (const p of backup.profiles) metaStore.put(p);
    for (const f of backup.files) fileStore.put(f);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
