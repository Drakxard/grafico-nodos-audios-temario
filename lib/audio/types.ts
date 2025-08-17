export interface NodeAudioMeta {
  extId: string;
  local_path: string;
  duration_seconds: number;
  mime: string;
  created_at: string;
  last_modified: string;
}

export interface MetadataFile {
  schema_version: number;
  nodes: Record<string, NodeAudioMeta | null>;
}

export type NodeState =
  | 'idle'
  | 'recording'
  | 'has-audio'
  | 'playing'
  | 'paused'
  | 'error';

export interface AttachAudioLayerOptions {
  allowLocalFileSystem?: boolean;
  autoSaveMetadata?: boolean;
  longPressMs?: number;
  onStateChange?: (extId: string, state: NodeState) => void;
  onError?: (code: string, ctx?: unknown) => void;
}
