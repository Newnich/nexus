export type ConnectionType = "semantic" | "temporal" | "manual" | "inferred" | "citation" | "domain";

export interface Connection {
  id: string;
  userId: string;
  fromItemId: string;
  toItemId: string;
  type: ConnectionType;
  strength: number; // 0-1 similarity score
  label?: string;
  description?: string;
  createdAt: string;
}

export interface ConnectionGraph {
  nodes: ConnectionNode[];
  edges: ConnectionEdge[];
}

export interface ConnectionNode {
  id: string;
  type: "item" | "collection" | "tag";
  label: string;
  group?: string;
  size?: number;
  color?: string;
  data?: Record<string, unknown>;
}

export interface ConnectionEdge {
  source: string;
  target: string;
  strength: number;
  type: ConnectionType;
  label?: string;
}
