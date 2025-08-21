import { FileStore } from './fileStore';
import { Recorder } from './recorder';
import { Player } from './player';
import { bindTapAndLongPress } from './gestures';
import type { AttachAudioLayerOptions, MetadataFile, NodeState } from './types';

interface AttachParams {
  nodesSelection: Iterable<HTMLElement | SVGElement>;
  getExtId: (el: HTMLElement | SVGElement) => string;
  rootElement: HTMLElement | SVGElement;
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
      await store.writeAudio(extId, blob);
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
      const blob = await store.readAudio(extId);
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
    await store.deleteAudio(extId);
    metadata.nodes[extId] = null;
    await saveMetadata();
    updateState(extId, 'idle');
  };

  const upload = async (extId: string, blob: Blob) => {
    try {
      await store.writeAudio(extId, blob);
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

  const download = async (extId: string) => {
    const blob = await store.readAudio(extId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${extId}.webm`;
    a.click();
    URL.revokeObjectURL(url);
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
      options?.longPressMs
    );
  };

  if (options?.bindGestures !== false) {
    for (const el of nodesSelection) bind(el);
  }
  store.init().then(loadMetadata);

  return {
    requestFolderPermission: async () => {
      const ok = await store.requestFolderPermission();
      if (ok) metadata = await store.readMeta();
      return ok;
    },
    hasFolderAccess: () => store.hasAccess(),
    startRecording,
    stopRecording,
    play,
    pause,
    delete: del,
    download,
    upload,
    dispose: () => {
      state.clear();
    },
  };
}

async function getDuration(blob: Blob): Promise<number> {
  return new Promise(resolve => {
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
