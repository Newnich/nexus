"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

// ── Types ──
interface GraphNode {
  id: string;
  title: string;
  type: string;
  category: string | null;
  tags: string[];
  createdAt: string;
  connectionCount: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  strength: number;
  type: string;
  label?: string;
  description?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { totalNodes: number; totalEdges: number; averageStrength: number };
}

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

// ── Config ──
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

const TYPE_ICONS: Record<string, string> = {
  link: "🔗", note: "📝", file: "📄", image: "🖼",
  screenshot: "📸", voice_memo: "🎤", pdf: "📕", video: "🎬",
};

export default function GraphPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<PositionedNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<PositionedNode[]>([]);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 600 });
  const viewBoxRef = useRef(viewBox);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number>(0);

  // Keep viewBoxRef in sync so callbacks can read fresh values without deps
  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  // Fetch graph data
  useEffect(() => {
    async function fetchGraph() {
      try {
        const res = await fetch("/api/graph");
        if (!res.ok) {
          if (res.status === 401) throw new Error("Please sign in");
          throw new Error("Failed to load graph");
        }
        const d = await res.json();
        setData(d);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  // Initialize force simulation when data loads
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;
    const gData: GraphData = data; // Narrowed after guard

    const centerX = 400;
    const centerY = 300;
    const spread = Math.min(300, Math.max(100, gData.nodes.length * 30));

    const positioned: PositionedNode[] = gData.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / gData.nodes.length;
      return {
        ...node,
        x: centerX + spread * Math.cos(angle),
        y: centerY + spread * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: Math.max(20, Math.min(40, 20 + node.connectionCount * 3)),
      };
    });

    setSimulation(positioned);

    // Run force simulation
    const REPULSION = 8000;
    const ATTRACTION = 0.005;
    const DAMPING = 0.85;
    const CENTER_GRAVITY = 0.002;
    const MIN_DIST = 30;

    let running = true;

    function simulate() {
      if (!running) return;

      setSimulation((prev) => {
        const nodes = prev.map((n) => ({ ...n }));
        const edgeMap = new Map<string, GraphEdge[]>();
        for (const edge of gData.edges) {
          const key = edge.source;
          if (!edgeMap.has(key)) edgeMap.set(key, []);
          edgeMap.get(key)!.push(edge);
        }

        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];

          // Repulsion from all other nodes
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_DIST) dist = MIN_DIST;
            const force = REPULSION / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }

          // Attraction along edges
          const edges = edgeMap.get(a.id) || [];
          for (const edge of edges) {
            const target = nodes.find((n) => n.id === edge.target);
            if (!target) continue;
            const dx = target.x - a.x;
            const dy = target.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const force = dist * ATTRACTION * edge.strength;
            a.vx += (dx / Math.max(dist, 1)) * force;
            a.vy += (dy / Math.max(dist, 1)) * force;
            target.vx -= (dx / Math.max(dist, 1)) * force;
            target.vy -= (dy / Math.max(dist, 1)) * force;
          }

          // Center gravity
          a.vx += (centerX - a.x) * CENTER_GRAVITY;
          a.vy += (centerY - a.y) * CENTER_GRAVITY;

          // Damping
          a.vx *= DAMPING;
          a.vy *= DAMPING;

          // Apply velocity
          a.x += a.vx;
          a.y += a.vy;
        }

        return nodes;
      });

      animFrame.current = requestAnimationFrame(simulate);
    }

    // Run simulation for 3 seconds then settle
    simulate();
    const timer = setTimeout(() => {
      running = false;
      cancelAnimationFrame(animFrame.current);
    }, 3000);

    return () => {
      running = false;
      cancelAnimationFrame(animFrame.current);
      clearTimeout(timer);
    };
  }, [data]);

  // ── Mouse handlers ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      setDraggedNode(nodeId);

      // Convert screen coords to viewBox coords (via ref to avoid deps on viewBox state)
      const vb = viewBoxRef.current;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = vb.w / rect.width;
      const scaleY = vb.h / rect.height;
      const svgX = (e.clientX - rect.left) * scaleX + vb.x;
      const svgY = (e.clientY - rect.top) * scaleY + vb.y;

      const node = simulation.find((n) => n.id === nodeId);
      if (node) {
        dragOffset.current = {
          x: svgX - node.x,
          y: svgY - node.y,
        };
      }

      const handleMouseMove = (ev: MouseEvent) => {
        const curVb = viewBoxRef.current;
        const svgEl = svgRef.current;
        if (!svgEl) return;
        const r = svgEl.getBoundingClientRect();
        const sx = curVb.w / r.width;
        const sy = curVb.h / r.height;
        const mx = (ev.clientX - r.left) * sx + curVb.x;
        const my = (ev.clientY - r.top) * sy + curVb.y;

        setSimulation((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...n, x: mx - dragOffset.current.x, y: my - dragOffset.current.y, vx: 0, vy: 0 }
              : n
          )
        );
      };

      const handleMouseUp = () => {
        setDraggedNode(null);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [simulation]
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (draggedNode !== nodeId) {
        router.push(`/items/${nodeId}`);
      }
    },
    [router, draggedNode]
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox((prev) => ({
      ...prev,
      w: Math.max(200, Math.min(5000, prev.w * scale)),
      h: Math.max(150, Math.min(3750, prev.h * scale)),
    }));
  };

  const resetView = () => {
    setViewBox({ x: 0, y: 0, w: 800, h: 600 });
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded-lg" />
        <div className="h-5 w-72 skeleton rounded" />
        <div className="glass-card rounded-2xl h-[600px] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">⬡</div>
            <p className="text-muted-foreground">Loading knowledge graph...</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold gradient-text">Knowledge Graph</h1>
        <div className="glass-card rounded-2xl h-[600px] flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-400 mb-1">Failed to load graph</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasGraph = data && data.nodes.length > 0 && data.edges.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Knowledge Graph</h1>
          <p className="text-muted-foreground mt-1">
            {hasGraph
              ? `${data!.nodes.length} items connected by ${data!.edges.length} relationships`
              : "Visualize connections between your knowledge"}
          </p>
        </div>
        {hasGraph && (
          <button
            onClick={resetView}
            className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-card/70 rounded-lg text-sm transition-all"
          >
            <span>⟲</span>
            Reset View
          </button>
        )}
      </div>

      {/* Graph Canvas */}
      <div className="glass-card rounded-2xl h-[600px] relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Empty State */}
        {(!data || data.nodes.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-6xl mb-4">⬡</div>
              <h2 className="text-xl font-semibold mb-2">No connections yet</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Your knowledge graph will appear here as you save items.
                NEXUS automatically discovers connections between related content.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: "🔗", label: "Links", color: "border-blue-500/30" },
                  { icon: "📝", label: "Notes", color: "border-yellow-500/30" },
                  { icon: "📕", label: "PDFs", color: "border-red-500/30" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`glass-card p-4 rounded-xl border ${item.color} text-center`}
                  >
                    <div className="text-2xl mb-1">{item.icon}</div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SVG Graph */}
        {hasGraph && (
          <svg
            ref={svgRef}
            className="w-full h-full cursor-grab active:cursor-grabbing"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            preserveAspectRatio="xMidYMid meet"
            onWheel={handleWheel}
          >
            <defs>
              {simulation.map((node) => {
                const color = TYPE_COLORS[node.type] || "#6366f1";
                return (
                  <radialGradient key={node.id} id={`glow-${node.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </radialGradient>
                );
              })}
            </defs>

            {/* Edges */}
            {data.edges.map((edge) => {
              const source = simulation.find((n) => n.id === edge.source);
              const target = simulation.find((n) => n.id === edge.target);
              if (!source || !target) return null;

              return (
                <g key={edge.id}>
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={TYPE_COLORS[source.type] || "#6366f1"}
                    strokeWidth={Math.max(0.5, edge.strength * 3)}
                    strokeOpacity={0.15 + edge.strength * 0.35}
                    className="transition-all duration-300"
                  />
                  {/* Glow edge on hover */}
                  {(hoveredNode?.id === edge.source || hoveredNode?.id === edge.target) && (
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={TYPE_COLORS[source.type] || "#6366f1"}
                      strokeWidth={Math.max(1, edge.strength * 5)}
                      strokeOpacity={0.4}
                      className="transition-all duration-300"
                    />
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {simulation.map((node) => {
              const color = TYPE_COLORS[node.type] || "#6366f1";
              const isHovered = hoveredNode?.id === node.id;
              const isDragged = draggedNode === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Glow ring */}
                  <circle
                    r={node.radius + 8}
                    fill={`url(#glow-${node.id})`}
                    opacity={isHovered ? 1 : 0.3}
                    className="transition-opacity duration-300"
                  />

                  {/* Node circle */}
                  <circle
                    r={isHovered || isDragged ? node.radius + 2 : node.radius}
                    fill={color}
                    fillOpacity={isDragged ? 0.9 : isHovered ? 0.8 : 0.6}
                    stroke={color}
                    strokeWidth={isHovered || isDragged ? 2.5 : 1.5}
                    strokeOpacity={0.8}
                    className="transition-all duration-200"
                  />

                  {/* Type icon */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={node.radius * 0.6}
                    className="select-none pointer-events-none"
                  >
                    {TYPE_ICONS[node.type] || "📄"}
                  </text>

                  {/* Title label on hover */}
                  {isHovered && (
                    <text
                      y={node.radius + 16}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10"
                      className="select-none pointer-events-none"
                      style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}
                    >
                      {node.title.length > 30
                        ? node.title.slice(0, 30) + "..."
                        : node.title}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Hover Tooltip */}
        {hoveredNode && hasGraph && (
          <div
            className="absolute bottom-4 right-4 glass-card p-4 rounded-xl max-w-xs"
            style={{ pointerEvents: "none" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{TYPE_ICONS[hoveredNode.type] || "📄"}</span>
              <span className="font-semibold text-sm truncate">{hoveredNode.title}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${TYPE_COLORS[hoveredNode.type] || "#6366f1"}20`,
                  color: TYPE_COLORS[hoveredNode.type] || "#6366f1",
                }}
              >
                {hoveredNode.type}
              </span>
              {hoveredNode.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {hoveredNode.category}
                </span>
              )}
              {hoveredNode.connectionCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {hoveredNode.connectionCount} connection{hoveredNode.connectionCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        )}

        {/* View Info */}
        <div className="absolute bottom-4 left-4 glass-card px-3 py-1.5 rounded-lg">
          <span className="text-xs text-muted-foreground">
            ⊞ Force Graph — Drag nodes, scroll to zoom, click to view
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Nodes", value: String(data?.stats.totalNodes || 0), color: "text-nexus-400" },
          { label: "Edges", value: String(data?.stats.totalEdges || 0), color: "text-green-400" },
          { label: "Avg Strength", value: data?.stats.averageStrength ? `${Math.round(data.stats.averageStrength * 100)}%` : "—", color: "text-yellow-400" },
          { label: "Connected", value: simulation.filter((n) => n.connectionCount > 0).length > 0 ? `${simulation.filter((n) => n.connectionCount > 0).length}/${data?.nodes.length || 0}` : "—", color: "text-muted-foreground" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 rounded-xl text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
