import type { MetadataFile } from './types';

/**
 * Minimal FileStore implementing File System Access API with IndexedDB fallback.
 * This implementation intentionally keeps logic compact and avoids parallel writes.
 */
export class FileStore {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;
  constructor(private options: { allowLocalFileSystem?: boolean; autoSaveMetadata?: boolean } = {}) {}

  async init(): Promise<void> {
    if (!this.options.allowLocalFileSystem) return;
    try {
      const db = await this.openDB();
      const tx = db.transaction('handles');
      const req = tx.objectStore('handles').get('dir');
      await new Promise<void>(resolve => {
        req.onsuccess = async () => {
          const handle = req.result as FileSystemDirectoryHandle | undefined;
          if (handle && (await this.verifyPermission(handle))) {
            this.dirHandle = handle;
            await this.setupDirectory();
          }
          resolve();
        };
        req.onerror = () => resolve();
      });
    } catch {
      /* ignore */
    }
  }

  async requestFolderPermission(): Promise<boolean> {
    if (!this.options.allowLocalFileSystem || !('showDirectoryPicker' in window)) {
      return false;
    }
    try {
      const handle = await (window as any).showDirectoryPicker();
      if (!(await this.verifyPermission(handle))) return false;
      this.dirHandle = handle;
      await this.setupDirectory();
      const db = await this.openDB();
      const tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(this.dirHandle, 'dir');
        await (tx as any).done?.catch(() => {});
      return true;
    } catch {
      this.dirHandle = null;
      return false;
    }
  }

  hasAccess() {
    return !!this.dirHandle;
  }

  private async verifyPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    const mode: any = 'readwrite';
    const perm = await (handle as any).queryPermission?.({ mode });
    if (perm === 'granted') return true;
    if (perm === 'prompt') {
      const res = await (handle as any).requestPermission?.({ mode });
      return res === 'granted';
    }
    return false;
  }

  private async setupDirectory() {
    if (!this.dirHandle) return;
    const system = await this.dirHandle.getDirectoryHandle('gestor', { create: true });
    await system.getDirectoryHandle('system', { create: true })
      .then(async sys => {
        await sys.getDirectoryHandle('audios', { create: true });
        await sys.getDirectoryHandle('temp', { create: true });
        const dataDir = await sys.getDirectoryHandle('data', { create: true });
        try {
          await dataDir.getFileHandle('metadata.json');
        } catch {
            const file = await dataDir.getFileHandle('metadata.json', { create: true });
            const writable = await (file as any).createWritable();
          await writable.write(JSON.stringify({ schema_version: 1, nodes: {} }, null, 2));
          await writable.close();
        }
      });
  }

  private async openDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open('audio-layer', 3);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('audios')) db.createObjectStore('audios');
          if (!db.objectStoreNames.contains('metadata')) db.createObjectStore('metadata');
          if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
          if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return this.dbPromise;
  }
  async readConfig<T = any>(): Promise<T | null> {
    if (this.dirHandle) {
      try {
        const dataDir = await this.getDataDir();
        const file = await dataDir.getFileHandle('config.json');
        const text = await (await file.getFile()).text();
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    } else {
      const db = await this.openDB();
      return new Promise(resolve => {
        const tx = db.transaction('config');
        const req = tx.objectStore('config').get('singleton');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }
  }

  async writeConfig<T = any>(cfg: T): Promise<void> {
    if (this.dirHandle) {
      const dataDir = await this.getDataDir();
      const tmp = await dataDir.getFileHandle('config.tmp.json', { create: true });
      const writable = await (tmp as any).createWritable();
      await writable.write(JSON.stringify(cfg));
      await writable.close();
      await dataDir.removeEntry?.('config.json').catch(() => {});
      await (tmp as any).move?.('config.json');
    } else {
      const db = await this.openDB();
      const tx = db.transaction('config', 'readwrite');
      tx.objectStore('config').put(cfg, 'singleton');
      await (tx as any).done?.catch(() => {});
    }
  }

  async writeAudio(extId: string, blob: Blob, ext = 'webm'): Promise<void> {
    if (this.dirHandle) {
      const file = await this.getAudioFileHandle(extId, ext, true);
      const writable = await file.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const db = await this.openDB();
      const tx = db.transaction('audios', 'readwrite');
      tx.objectStore('audios').put({ blob, mime: blob.type, ext }, extId);
      await tx.done?.catch(() => {});
    }
  }


  async readAudio(extId: string, ext = 'webm'): Promise<Blob | null> {
    if (this.dirHandle) {
      try {
        const file = await this.getAudioFileHandle(extId, ext, false);
        const blob = await file.getFile();
        return blob;
      } catch {
        return null;
      }
    } else {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('audios');
        const req = tx.objectStore('audios').get(extId);
        req.onsuccess = () => resolve(req.result?.blob || null);
        req.onerror = () => resolve(null);
      });
    }
  }

  async deleteAudio(extId: string, ext = 'webm'): Promise<void> {
  if (this.dirHandle) {
    try {
      const file = await this.getAudioFileHandle(extId, ext, false);
      await file.remove?.();
    } catch {
      /* ignore */
    }
  } else {
    const db = await this.openDB();
    const tx = db.transaction('audios', 'readwrite');
    tx.objectStore('audios').delete(extId);
    await (tx as any).done?.catch(() => {});
  }
  }

  async readMeta(): Promise<MetadataFile> {
    if (this.dirHandle) {
      const dataDir = await this.getDataDir();
      const file = await dataDir.getFileHandle('metadata.json');
      const text = await (await file.getFile()).text();
      return JSON.parse(text) as MetadataFile;
    } else {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('metadata');
        const req = tx.objectStore('metadata').get('singleton');
        req.onsuccess = () => resolve(req.result || { schema_version: 1, nodes: {} });
        req.onerror = () => resolve({ schema_version: 1, nodes: {} });
      });
    }
  }

  async writeMeta(meta: MetadataFile): Promise<void> {
    if (this.dirHandle) {
      const dataDir = await this.getDataDir();
        const tmp = await dataDir.getFileHandle('metadata.tmp.json', { create: true });
        const writable = await (tmp as any).createWritable();
      await writable.write(JSON.stringify(meta));
      await writable.close();
        await dataDir.removeEntry?.('metadata.json').catch(() => {});
        await (tmp as any).move?.('metadata.json');
    } else {
      const db = await this.openDB();
        const tx = db.transaction('metadata', 'readwrite');
        tx.objectStore('metadata').put(meta, 'singleton');
        await (tx as any).done?.catch(() => {});
    }
  }

  private async getAudioFileHandle(extId: string, ext: string, create: boolean) {
    const audios = await this.getAudiosDir();
    const safe = extId.replace(/[^A-Za-z0-9 .,_-]/g, '_');
    return audios.getFileHandle(`${safe}.${ext}`, { create });
  }

  getDirName(): string | null {
    return this.dirHandle?.name ?? null;
  }

  private async getAudiosDir() {
    if (!this.dirHandle) throw new Error('no dir');
    const gestor = await this.dirHandle.getDirectoryHandle('gestor');
    const system = await gestor.getDirectoryHandle('system');
    return system.getDirectoryHandle('audios');
  }

  private async getDataDir() {
    if (!this.dirHandle) throw new Error('no dir');
    const gestor = await this.dirHandle.getDirectoryHandle('gestor');
    const system = await gestor.getDirectoryHandle('system');
    return system.getDirectoryHandle('data');
  }
}
