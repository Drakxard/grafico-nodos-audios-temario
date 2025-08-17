import { FileStore } from './fileStore';
import { Recorder } from './recorder';
import { Player } from './player';
import { attachTapLongPress } from './gestures';
import type { NodeState } from './types';

interface AttachOptions {
  allowLocalFileSystem?: boolean;
  autoSaveMetadata?: boolean;
  longPressMs?: number;
  onStateChange?: (extId: string, state: NodeState) => void;
  onError?: (code: string, ctx?: any) => void;
}

interface AttachArgs {
  nodesSelection: string | NodeListOf<HTMLElement> | HTMLElement[];
  getExtId: (el: HTMLElement) => string;
  rootElement?: Document | HTMLElement;
  options?: AttachOptions;
}

export function attachAudioLayer({
  nodesSelection,
  getExtId,
  rootElement = document,
  options = {},
}: AttachArgs) {
  const store = new FileStore({ allowLocalFileSystem: options.allowLocalFileSystem });
  const recorder = new Recorder();
  const player = new Player();
  const states: Map<string, NodeState> = new Map();
  let recordingExt: string | null = null;

  player.onEnded = extId => {
    setState(extId, 'has-audio');
  };

  function setState(extId: string, st: NodeState) {
    states.set(extId, st);
    options.onStateChange?.(extId, st);
  }

  function elements(): HTMLElement[] {
    if (typeof nodesSelection === 'string') {
      const scope = rootElement instanceof Document ? rootElement : rootElement.ownerDocument!;
      return Array.from(scope.querySelectorAll(nodesSelection)) as HTMLElement[];
    }
    return Array.from(nodesSelection as any);
  }

  elements().forEach(el => bind(el));

  function bind(el: HTMLElement) {
    const extId = getExtId(el);
    setState(extId, 'idle');
    attachTapLongPress(
      el,
      {
        longPressMs: options.longPressMs,
        onTap: () => handleTap(extId),
        onLongPress: () => handleLong(extId),
      }
    );
  }

  async function handleTap(extId: string) {
    const st = states.get(extId) || 'idle';
    try {
      if (st === 'idle') {
        await startRecording(extId);
      } else if (st === 'recording') {
        await stopRecording(extId);
      } else if (st === 'has-audio') {
        await play(extId);
      } else if (st === 'playing') {
        pause();
        setState(extId, 'paused');
      } else if (st === 'paused') {
        await play(extId);
      }
    } catch (e: any) {
      options.onError?.('E_BUSY', e);
    }
  }

  async function handleLong(extId: string) {
    await remove(extId);
  }

  async function startRecording(extId: string) {
    if (recordingExt) throw new Error('busy');
    await recorder.start();
    recordingExt = extId;
    setState(extId, 'recording');
  }

  async function stopRecording(extId: string) {
    if (recordingExt !== extId) return;
    const { blob, duration } = await recorder.stop();
    await store.writeAudio(extId, blob);
    const meta = await store.readMeta();
    const now = new Date().toISOString();
    meta.nodes[extId] = {
      extId,
      local_path: `audios/${sanitizeExtId(extId)}.webm`,
      duration_seconds: duration,
      mime: blob.type,
      created_at: now,
      last_modified: now,
    };
    await store.writeMeta(meta);
    recordingExt = null;
    setState(extId, 'has-audio');
  }

  async function play(extId: string) {
    const blob = await store.readAudio(extId);
    if (!blob) {
      const meta = await store.readMeta();
      meta.nodes[extId] = null;
      await store.writeMeta(meta);
      setState(extId, 'idle');
      return;
    }
    await player.play(blob, extId);
    setState(extId, 'playing');
  }

  function pause() {
    player.pause();
  }

  async function remove(extId: string) {
    pause();
    await store.deleteAudio(extId);
    const meta = await store.readMeta();
    meta.nodes[extId] = null;
    await store.writeMeta(meta);
    setState(extId, 'idle');
  }

  async function download(extId: string) {
    const blob = await store.readAudio(extId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeExtId(extId) + '.webm';
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    requestFolderPermission: () => store.requestFolderPermission(),
    startRecording,
    stopRecording,
    play,
    pause,
    delete: remove,
    download,
    dispose: () => {
      elements().forEach(el => {
        el.replaceWith(el.cloneNode(true));
      });
    },
  };
}

function sanitizeExtId(extId: string) {
  return extId.replace(/[^A-Za-z0-9 .,_-]+/g, '').replace(/\s+/g, ' ').trim();
}
