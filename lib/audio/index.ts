import { FileStore } from './fileStore';
import { Recorder } from './recorder';
import { Player } from './player';
import { bindTapAndLongPress } from './gestures';
import type { AttachAudioLayerOptions, MetadataFile, NodeState } from './types';

interface AttachParams {
  nodesSelection: Iterable<HTMLElement | SVGElement>;
  getExtId: (el: HTMLElement | SVGElement) => string;
  rootElement: HTMLElement | SVGElement; // not used here but kept for API parity
  options?: AttachAudioLayerOptions;
}

export function attachAudioLayer({ nodesSelection, getExtId, rootElement, options }: AttachParams) {
  const store = new FileStore({ allowLocalFileSystem: options?.allowLocalFileSystem });
  const recorder = new Recorder();
  const player = new Player();
  const state = new Map<string, NodeState>();
  let metadata: MetadataFile = { schema_version: 1, nodes: {} };

  const updateState = (extId: string, st: NodeState) => {
    state.set(extId, st);
    options?.onStateChange?.(extId, st);
  };

  const loadMetadata = async () => {
    metadata = await store.readMeta();
    Object.keys(metadata.nodes).forEach((id) => {
      if (metadata.nodes[id]) updateState(id, 'has-audio');
    });
  };

  const saveMetadata = async () => {
    if (options?.autoSaveMetadata) {
      await store.writeMeta(metadata);
    }
  };

  const startRecording = async (extId: string) => {
    try {
      await recorder.start();
      updateState(extId, 'recording');
    } catch (e) {
      options?.onError?.('E_MIC_DENIED', e);
    }
  };

  const stopRecording = async (extId: string) => {
    try {
      const blob = await recorder.stop();
      await store.writeAudio(extId, blob, 'webm');
      // Verify that the file was actually persisted. On some devices
      // (notably mobile browsers) a user may grant a folder permission but
      // the write can still silently fail. We immediately try to read the
      // file back and if it is missing we surface an error so the caller can
      // notify the user.
      const verify = await store.readAudio(extId, 'webm');
      if (!verify) {
        options?.onError?.('E_WRITE_VERIFY_FAIL');
        updateState(extId, 'error');
        return;
      }
      const duration = await getDuration(blob);
      const now = new Date().toISOString();
      metadata.nodes[extId] = {
        extId,
        local_path: `audios/${extId}.webm`,
        duration_seconds: duration,
        mime: blob.type,
        created_at: now,
        last_modified: now,
      };
      await saveMetadata();
      updateState(extId, 'has-audio');
    } catch (e) {
      options?.onError?.('E_WRITE_FAIL', e);
    }
  };

  const play = async (extId: string) => {
    try {
      const meta = metadata.nodes[extId];
      const ext = meta?.local_path?.split('.').pop() || 'webm';
      const blob = await store.readAudio(extId, ext);
      if (!blob) throw new Error('missing');
      if (player.playingExtId && player.playingExtId !== extId) {
        player.pause();
      }
      await player.play(extId, blob);
      updateState(extId, 'playing');
      player.onEnded(() => updateState(extId, 'has-audio'));
    } catch (e) {
      options?.onError?.('E_READ_FAIL', e);
    }
  };

  const pause = () => {
    player.pause();
    if (player.playingExtId) updateState(player.playingExtId, 'paused');
  };

  const del = async (extId: string) => {
    const meta = metadata.nodes[extId];
    const ext = meta?.local_path?.split('.').pop() || 'webm';
    await store.deleteAudio(extId, ext);
    metadata.nodes[extId] = null;
    await saveMetadata();
    updateState(extId, 'idle');
  };

  const download = async (extId: string) => {
    const meta = metadata.nodes[extId];
    const ext = meta?.local_path?.split('.').pop() || 'webm';
    const blob = await store.readAudio(extId, ext);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extId}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (extId: string, file: File) => {
    try {
      const nameExt = file.name.split('.').pop()?.toLowerCase();
      const fallback = file.type.split('/')[1] || 'webm';
      const ext = nameExt || fallback || 'webm';
      await store.writeAudio(extId, file, ext);
      const duration = await getDuration(file);
      const now = new Date().toISOString();
      metadata.nodes[extId] = {
        extId,
        local_path: `audios/${extId}.${ext}`,
        duration_seconds: duration,
        mime: file.type,
        created_at: now,
        last_modified: now,
      };
      await saveMetadata();
      updateState(extId, 'has-audio');
    } catch (e) {
      options?.onError?.('E_WRITE_FAIL', e);
    }
  };

  const bind = (el: HTMLElement | SVGElement) => {
    const extId = getExtId(el);
    bindTapAndLongPress(
      el,
      async () => {
        const st = state.get(extId) || 'idle';
        if (st === 'idle') await startRecording(extId);
        else if (st === 'recording') await stopRecording(extId);
        else if (st === 'has-audio') await play(extId);
        else if (st === 'playing') pause();
        else if (st === 'paused') await play(extId);
      },
      async () => {
        const st = state.get(extId) || 'idle';
        if (st === 'has-audio' || st === 'playing' || st === 'paused') {
          await del(extId);
        }
      },
      options?.longPressMs,
    );

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      const file = (e as DragEvent).dataTransfer?.files?.[0];
      if (!file) return;
      await importFile(extId, file);
    });
  };

  for (const el of nodesSelection) bind(el);
  const ready = store
    .init()
    .then(loadMetadata)
    .then(() => store.hasAccess());

  return {
    ready,
    requestFolderPermission: async () => {
      const ok = await store.requestFolderPermission();
      if (ok) {
        metadata = await store.readMeta();
        Object.keys(metadata.nodes).forEach((id) => {
          if (metadata.nodes[id]) updateState(id, 'has-audio');
        });
      }
      return ok;
    },
    hasFolderAccess: () => store.hasAccess(),
    // Exponer ambas APIs: config y nombre de carpeta
    readConfig: <T>() => store.readConfig<T>(),
    writeConfig: <T>(cfg: T) => store.writeConfig(cfg),
    getFolderName: () => store.getDirName(),

    startRecording,
    stopRecording,
    play,
    pause,
    delete: del,
    download,
    importFile,
    dispose: () => {
      state.clear();
    },
  };
}

async function getDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    audio.src = URL.createObjectURL(blob);
    audio.onloadedmetadata = () => {
      const d = audio.duration;
      URL.revokeObjectURL(audio.src);
      resolve(isFinite(d) ? d : 0);
    };
    audio.onerror = () => resolve(0);
  });
}
