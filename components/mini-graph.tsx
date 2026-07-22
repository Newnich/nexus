"use client";

import { useMemo } from "react";
import Link from "next/link";

interface ConnectionNode {
  id: string;
  title: string;
  type: string;
}

interface ConnectionEdge {
  id: string;
  from_item_id: string;
  to_item_id: string;
  strength: number;
  type: string;
  label?: string;
  description?: string;
  from_item?: ConnectionNode;
  to_item?: ConnectionNode;
}

interface MiniGraphProps {
  centerId: string;
  centerTitle: string;
  centerType: string;
  connections: ConnectionEdge[];
}

const TYPE_COLORS: Record<string, string> = {
  link: "#6366f1",
  note: "#eab308",
  file: "#22c55e",
  image: "#a855f7",
  screenshot: "#ec4899",
  voice_memo: "#f97316",
  pdf: "#ef4444",
  video: "#818cf8",
};

const DEFAULT_COLOR = "#6366f1";

export function MiniGraph({ centerId, centerTitle, centerType, connections }: MiniGraphProps) {
  const { nodes, edges, svgWidth, svgHeight } = useMemo(() => {
    const w = 280;
    const h = 200;
    const cx = w / 2;
    const cy = h / 2 - 10;

    // Center node
    const graphNodes: Array<{
      id: string;
      title: string;
      type: string;
      x: number;
      y: number;
      isCenter: boolean;
    }> = [{ id: centerId, title: centerTitle, type: centerType, x: cx, y: cy, isCenter: true }];

    const graphEdges: Array<{
      sourceId: string;
      targetId: string;
      strength: number;
    }> = [];

    // Position connected nodes in a circle around the center
    const connectedCount = Math.min(connections.length, 8);
    const radius = 72;

    connections.slice(0, 8).forEach((conn, i) => {
      const otherItem = conn.from_item_id === centerId ? conn.to_item : conn.from_item;
      if (!otherItem) return;

      const angle = (2 * Math.PI * i) / connectedCount - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);

      graphNodes.push({
        id: otherItem.id,
        title: otherItem.title,
        type: otherItem.type,
        x,
        y,
        isCenter: false,
      });

      graphEdges.push({
        sourceId: centerId,
        targetId: otherItem.id,
        strength: conn.strength,
      });
    });

    return { nodes: graphNodes, edges: graphEdges, svgWidth: w, svgHeight: h };
  }, [centerId, centerTitle, centerType, connections]);

  if (connections.length === 0) return null;

  return (
    <div className="glass-card p-4 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-sm">
          ⬡
        </div>
        <h2 className="font-semibold text-sm">Connection Map</h2>
        <span className="text-xs text-muted-foreground ml-auto">{connections.length}</span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-auto"
        style={{ maxHeight: svgHeight }}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const source = nodes.find((n) => n.id === edge.sourceId);
          const target = nodes.find((n) => n.id === edge.targetId);
          if (!source || !target) return null;

          return (
            <g key={`edge-${i}`}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={
                  edge.sourceId === centerId
                    ? TYPE_COLORS[target.type] || DEFAULT_COLOR
                    : TYPE_COLORS[source.type] || DEFAULT_COLOR
                }
                strokeWidth={Math.max(1, edge.strength * 4)}
                strokeOpacity={0.3 + edge.strength * 0.3}
              />
              {/* Strength label */}
              <text
                x={(source.x + target.x) / 2}
                y={(source.y + target.y) / 2 - 4}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.4}
                fontSize="7"
                className="select-none"
              >
                {Math.round(edge.strength * 100)}%
              </text>
            </g>
          );
        })}

        {/* Center node glow */}
        <circle
          cx={nodes[0].x}
          cy={nodes[0].y}
          r={22}
          fill={TYPE_COLORS[centerType] || DEFAULT_COLOR}
          fillOpacity="0.12"
        />

        {/* Connected nodes */}
        {nodes.map((node) => {
          const color = TYPE_COLORS[node.type] || DEFAULT_COLOR;
          const r = node.isCenter ? 14 : 10;
          return (
            <g key={node.id}>
              {/* Node circle */}
              <Link href={node.isCenter ? "#" : `/items/${node.id}`}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill={color}
                  fillOpacity={node.isCenter ? 0.9 : 0.6}
                  stroke={color}
                  strokeWidth={node.isCenter ? 2.5 : 1.5}
                  strokeOpacity={0.8}
                  className={
                    node.isCenter ? "" : "cursor-pointer hover:fill-opacity-80 transition-all"
                  }
                />
              </Link>

              {/* Icon */}
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={r * 0.6}
                className="select-none pointer-events-none"
              >
                {node.isCenter ? "◈" : ""}
              </text>

              {/* Label */}
              <text
                x={node.x}
                y={node.y + r + 10}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.6}
                fontSize="6"
                className="select-none pointer-events-none"
              >
                {node.title.length > 14 ? node.title.slice(0, 14) + "…" : node.title}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
