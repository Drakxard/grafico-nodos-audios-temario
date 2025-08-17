export interface NodeMeta {
  extId: string;
  local_path: string;
  duration_seconds: number;
  mime: string;
  created_at: string;
  last_modified: string;
}

export interface Metadata {
  schema_version: 1;
  nodes: Record<string, NodeMeta | null>;
}

export type NodeState =
  | 'idle'
  | 'recording'
  | 'has-audio'
  | 'playing'
  | 'paused'
  | 'error';
