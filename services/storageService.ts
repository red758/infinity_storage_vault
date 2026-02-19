
import { StoredFile, VaultBackup, VaultProfile } from '../types';

const DB_NAME = 'LocalVaultDB';
const STORE_NAME = 'secure_files';
const META_STORE = 'vault_meta'; 

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 4);
    request.onupgradeneeded = (e: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const fileStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        fileStore.createIndex('vaultId', 'vaultId', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const requestPersistence = async (): Promise<boolean> => {
  if (navigator.storage && navigator.storage.persist) {
    return await navigator.storage.persist();
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
  return new Promise((resolve) => {
    const transaction = db.transaction(META_STORE, 'readonly');
    const request = transaction.objectStore(META_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const saveVaultProfile = async (profile: VaultProfile): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(META_STORE, 'readwrite');
  transaction.objectStore(META_STORE).put(profile);
};

export const deleteVaultProfile = async (id: string): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([META_STORE, STORE_NAME], 'readwrite');
    
    // 1. Delete the profile metadata
    transaction.objectStore(META_STORE).delete(id);
    
    // 2. Delete all files associated with this vault
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
    transaction.onerror = () => {
      console.error('Vault deletion failed:', transaction.error);
      reject(transaction.error);
    };
  });
};

// FILE OPERATIONS
export const getFilesByVault = async (vaultId: string): Promise<StoredFile[]> => {
  const db = await initDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('vaultId');
    const request = index.getAll(IDBKeyRange.only(vaultId));
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const saveFile = async (file: StoredFile): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put(file);
};

export const updateFile = async (file: StoredFile): Promise<void> => {
  const db = await initDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  transaction.objectStore(STORE_NAME).put(file);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteFile = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onerror = (e) => {
        console.error('Delete request failed:', e);
        reject(new Error('Failed to delete file from store'));
      };

      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = (e) => {
        console.error('Delete transaction failed:', e);
        reject(new Error('Transaction failed during deletion'));
      };
    } catch (err) {
      console.error('Failed to initiate delete transaction:', err);
      reject(err);
    }
  });
};

// BACKUP OPERATIONS
export const exportFullBackup = async (): Promise<VaultBackup> => {
  const db = await initDB();
  const profiles = await getVaultProfiles();
  const fileTransaction = db.transaction(STORE_NAME, 'readonly');
  const files: StoredFile[] = await new Promise((res) => {
    fileTransaction.objectStore(STORE_NAME).getAll().onsuccess = (e: any) => res(e.target.result);
  });

  return {
    version: 2,
    profiles,
    files,
    exportedAt: Date.now()
  };
};

export const importFullBackup = async (backup: VaultBackup): Promise<void> => {
  const db = await initDB();
  
  // Restore profiles
  const metaTx = db.transaction(META_STORE, 'readwrite');
  const metaStore = metaTx.objectStore(META_STORE);
  for (const p of backup.profiles) metaStore.put(p);
  
  // Restore files
  const fileTx = db.transaction(STORE_NAME, 'readwrite');
  const fileStore = fileTx.objectStore(STORE_NAME);
  for (const f of backup.files) fileStore.put(f);
};
