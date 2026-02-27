
export type FileType = 'image' | 'video' | 'document' | 'other';

export interface VaultProfile {
  id: string;
  name: string;
  avatarColor: string;
  verification: {
    encryptedData: ArrayBuffer;
    iv: Uint8Array;
    salt: Uint8Array;
  };
  createdAt: number;
}

export interface StoredFile {
  id: string;
  vaultId: string; // Partition files by vault
  name: string;
  type: FileType;
  mimeType: string;
  size: number;           
  compressedSize: number; 
  isCompressed: boolean;
  encryptedData?: ArrayBuffer; // Optional if chunked
  iv: Uint8Array;
  salt: Uint8Array;
  isChunked?: boolean;
  chunkIds?: string[]; // IDs of chunks in the secure_files store
  chunkIvs?: Uint8Array[]; // IVs for each chunk
  createdAt: number;
}

export interface StorageStats {
  used: number;
  total: number;
  saved: number;
  imageCount: number;
  videoCount: number;
  docCount: number;
}

export interface VaultBackup {
  version: number;
  profiles: VaultProfile[];
  files: StoredFile[];
  exportedAt: number;
}
