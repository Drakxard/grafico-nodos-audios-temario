import type { Metadata } from './types';

const DB_NAME = 'audio-layer';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('audios')) {
        db.createObjectStore('audios');
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata');
      }
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class FileStore {
  private systemHandle: FileSystemDirectoryHandle | null = null;
  private dbPromise = openDB();

  constructor(private options: { allowLocalFileSystem?: boolean } = {}) {}

  async requestFolderPermission() {
    if (!this.options.allowLocalFileSystem) {
      throw new Error('FSA disabled');
    }
    const root = await (window as any).showDirectoryPicker();
    const gestor = await root.getDirectoryHandle('gestor', { create: true });
    const system = await gestor.getDirectoryHandle('system', { create: true });
    await system.getDirectoryHandle('audios', { create: true });
    await system.getDirectoryHandle('temp', { create: true });
    const data = await system.getDirectoryHandle('data', { create: true });
    try {
      await data.getFileHandle('metadata.json');
    } catch {
      await this.atomicWriteJSON(data, 'metadata.json', {
        schema_version: 1,
        nodes: {},
      });
    }
    this.systemHandle = system;
    const db = await this.dbPromise;
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(system, 'root');
    await new Promise((res, rej) => {
      tx.oncomplete = () => res(undefined);
      tx.onerror = () => rej(tx.error);
    });
  }

  private async getAudiosHandle() {
    if (!this.systemHandle) throw new Error('No system handle');
    return this.systemHandle.getDirectoryHandle('audios');
  }

  private async getDataHandle() {
    if (!this.systemHandle) throw new Error('No system handle');
    return this.systemHandle.getDirectoryHandle('data');
  }

  async writeAudio(extId: string, blob: Blob) {
    const safe = sanitizeExtId(extId) + '.webm';
    if (this.systemHandle) {
      const audios = await this.getAudiosHandle();
      const fh = await audios.getFileHandle(safe, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
    } else {
      const db = await this.dbPromise;
      const tx = db.transaction('audios', 'readwrite');
      tx.objectStore('audios').put({ blob, mime: blob.type }, extId);
      await new Promise((res, rej) => {
        tx.oncomplete = () => res(undefined);
        tx.onerror = () => rej(tx.error);
      });
    }
  }

  async readAudio(extId: string): Promise<Blob | null> {
    const safe = sanitizeExtId(extId) + '.webm';
    if (this.systemHandle) {
      try {
        const audios = await this.getAudiosHandle();
        const fh = await audios.getFileHandle(safe);
        const file = await fh.getFile();
        return file;
      } catch {
        return null;
      }
    } else {
      const db = await this.dbPromise;
      const tx = db.transaction('audios');
      const req = tx.objectStore('audios').get(extId);
      return new Promise((res, rej) => {
        req.onsuccess = () => {
          const v = req.result;
          res(v ? v.blob : null);
        };
        req.onerror = () => rej(req.error);
      });
    }
  }

  async deleteAudio(extId: string) {
    const safe = sanitizeExtId(extId) + '.webm';
    if (this.systemHandle) {
      const audios = await this.getAudiosHandle();
      await audios.removeEntry(safe).catch(() => {});
    } else {
      const db = await this.dbPromise;
      const tx = db.transaction('audios', 'readwrite');
      tx.objectStore('audios').delete(extId);
      await new Promise((res, rej) => {
        tx.oncomplete = () => res(undefined);
        tx.onerror = () => rej(tx.error);
      });
    }
  }

  async readMeta(): Promise<Metadata> {
    if (this.systemHandle) {
      const data = await this.getDataHandle();
      try {
        const fh = await data.getFileHandle('metadata.json');
        const file = await fh.getFile();
        const text = await file.text();
        return JSON.parse(text) as Metadata;
      } catch {
        return { schema_version: 1, nodes: {} };
      }
    } else {
      const db = await this.dbPromise;
      const tx = db.transaction('metadata');
      const req = tx.objectStore('metadata').get('singleton');
      return new Promise((res, rej) => {
        req.onsuccess = () => {
          res(req.result || { schema_version: 1, nodes: {} });
        };
        req.onerror = () => rej(req.error);
      });
    }
  }

  async writeMeta(meta: Metadata) {
    if (this.systemHandle) {
      const data = await this.getDataHandle();
      await this.atomicWriteJSON(data, 'metadata.json', meta);
    } else {
      const db = await this.dbPromise;
      const tx = db.transaction('metadata', 'readwrite');
      tx.objectStore('metadata').put(meta, 'singleton');
      await new Promise((res, rej) => {
        tx.oncomplete = () => res(undefined);
        tx.onerror = () => rej(tx.error);
      });
    }
  }

  private async atomicWriteJSON(dir: FileSystemDirectoryHandle, name: string, data: any) {
    const tmp = name + '.tmp';
    const tmpHandle = await dir.getFileHandle(tmp, { create: true });
    const w = await tmpHandle.createWritable();
    await w.write(JSON.stringify(data));
    await w.close();
    await dir.removeEntry(name).catch(() => {});
    if ((tmpHandle as any).move) {
      await (tmpHandle as any).move(name);
    } else {
      const final = await dir.getFileHandle(name, { create: true });
      const wf = await final.createWritable();
      const file = await tmpHandle.getFile();
      await wf.write(await file.text());
      await wf.close();
      await dir.removeEntry(tmp);
    }
  }
}

function sanitizeExtId(extId: string) {
  return extId.replace(/[^A-Za-z0-9 .,_-]+/g, '').replace(/\s+/g, ' ').trim();
}
