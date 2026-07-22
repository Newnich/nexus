"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
  energy: number;
}

// ── Config ──
const TYPE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  link: { color: "#6366f1", icon: "🔗", label: "Link" },
  note: { color: "#eab308", icon: "📝", label: "Note" },
  file: { color: "#22c55e", icon: "📄", label: "File" },
  image: { color: "#a855f7", icon: "🖼", label: "Image" },
  screenshot: { color: "#ec4899", icon: "📸", label: "Screenshot" },
  voice_memo: { color: "#f97316", icon: "🎤", label: "Voice" },
  pdf: { color: "#ef4444", icon: "📕", label: "PDF" },
  video: { color: "#818cf8", icon: "🎬", label: "Video" },
};

const DEFAULT_COLOR = "#6366f1";

// ── Background Particle Canvas ──
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = 0;
    let h = 0;

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] =
      [];
    const COUNT = 60;

    function resize() {
      w = canvas!.width = canvas!.offsetWidth;
      h = canvas!.height = canvas!.offsetHeight;
    }

    function init() {
      resize();
      particles.length = 0;
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.3 + 0.1,
        });
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(99, 102, 241, ${p.alpha})`;
        ctx!.fill();

        // Draw connections between nearby particles
        for (let j = 0; j < particles.length; j++) {
          const other = particles[j];
          if (p === other) continue;
          const dx = p.x - other.x;
          const dy = p.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(other.x, other.y);
            ctx!.strokeStyle = `rgba(99, 102, 241, ${0.06 * (1 - dist / 120)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }

    init();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />
  );
}

export default function GraphPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<PositionedNode[]>([]);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 600 });
  const viewBoxRef = useRef(viewBox);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number>(0);
  const simRunning = useRef(true);
  const simEnergy = useRef(1);
  const [showLegend, setShowLegend] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const isPanningRef = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panVB = useRef({ x: 0, y: 0, w: 800, h: 600 });

  // Keep viewBoxRef in sync
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
        // Initialize selected types with all available types
        if (d.nodes) {
          const types = new Set((d.nodes as GraphNode[]).map((n) => n.type));
          setSelectedTypes(types);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, []);

  // Initialize & run force simulation
  useEffect(() => {
    if (!data || data.nodes.length === 0) return;
    const gData = data;

    const centerX = viewBoxRef.current.w / 2;
    const centerY = viewBoxRef.current.h / 2;
    const spread = Math.min(300, Math.max(100, gData.nodes.length * 25));

    const positioned: PositionedNode[] = gData.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / gData.nodes.length;
      return {
        ...node,
        x: centerX + spread * Math.cos(angle),
        y: centerY + spread * Math.sin(angle),
        vx: 0,
        vy: 0,
        radius: Math.max(18, Math.min(38, 16 + node.connectionCount * 3)),
        energy: 0,
      };
    });

    setSimulation(positioned);

    // Physics constants
    const REPULSION = 6000;
    const ATTRACTION = 0.004;
    const CENTER_GRAVITY = 0.001;
    const MIN_DIST = 25;
    const ENERGY_THRESHOLD = 0.01;

    simEnergy.current = 1;
    simRunning.current = true;

    // Build edge map once
    const edgeMap = new Map<string, GraphEdge[]>();
    for (const edge of gData.edges) {
      for (const key of [edge.source, edge.target]) {
        if (!edgeMap.has(key)) edgeMap.set(key, []);
        edgeMap.get(key)!.push(edge);
      }
    }

    function simulate() {
      if (!simRunning.current) return;

      setSimulation((prev) => {
        const nodes = prev.map((n) => ({ ...n }));
        let totalEnergy = 0;

        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];

          // Repulsion
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MIN_DIST) dist = MIN_DIST;
            const force = REPULSION / (dist * dist);
            const fx = (dx / dist) * force * simEnergy.current;
            const fy = (dy / dist) * force * simEnergy.current;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }

          // Attraction along edges
          const edges = edgeMap.get(a.id) || [];
          for (const edge of edges) {
            const targetId = edge.source === a.id ? edge.target : edge.source;
            const target = nodes.find((n) => n.id === targetId);
            if (!target) continue;
            const dx = target.x - a.x;
            const dy = target.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const force = dist * ATTRACTION * edge.strength * simEnergy.current;
            const fx = (dx / Math.max(dist, 1)) * force;
            const fy = (dy / Math.max(dist, 1)) * force;
            a.vx += fx;
            a.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
          }

          // Center gravity
          a.vx += (centerX - a.x) * CENTER_GRAVITY * simEnergy.current;
          a.vy += (centerY - a.y) * CENTER_GRAVITY * simEnergy.current;

          // Damping
          const damping = 0.88;
          a.vx *= damping;
          a.vy *= damping;

          // Apply velocity
          a.x += a.vx;
          a.y += a.vy;

          totalEnergy += Math.abs(a.vx) + Math.abs(a.vy);
        }

        // Cool down
        if (simEnergy.current > 0.05) {
          simEnergy.current *= 0.997;
        }

        return nodes;
      });

      // Check if we should stop
      if (simEnergy.current > ENERGY_THRESHOLD) {
        animFrame.current = requestAnimationFrame(simulate);
      } else {
        simRunning.current = false;
      }
    }

    simulate();

    return () => {
      simRunning.current = false;
      cancelAnimationFrame(animFrame.current);
    };
  }, [data]);

  // Reheat simulation on interaction
  const reheatSimulation = useCallback(() => {
    if (!simRunning.current) {
      simRunning.current = true;
      simEnergy.current = 0.5;

      function resumeSim() {
        if (!simRunning.current) return;

        setSimulation((prev) => {
          const nodes = prev.map((n) => ({ ...n }));
          let totalEnergy = 0;

          for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
              const b = nodes[j];
              let dx = a.x - b.x;
              let dy = a.y - b.y;
              let dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 25) dist = 25;
              const force = 6000 / (dist * dist);
              const fx = (dx / dist) * force * simEnergy.current;
              const fy = (dy / dist) * force * simEnergy.current;
              a.vx += fx;
              a.vy += fy;
              b.vx -= fx;
              b.vy -= fy;
            }

            const edges = data?.edges || [];
            for (const edge of edges) {
              const targetId = edge.source === a.id ? edge.target : edge.source;
              const target = nodes.find((n) => n.id === targetId);
              if (!target) continue;
              const dx = target.x - a.x;
              const dy = target.y - a.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const force = dist * 0.004 * edge.strength * simEnergy.current;
              a.vx += (dx / Math.max(dist, 1)) * force;
              a.vy += (dy / Math.max(dist, 1)) * force;
              target.vx -= (dx / Math.max(dist, 1)) * force;
              target.vy -= (dy / Math.max(dist, 1)) * force;
            }

            a.vx += (viewBoxRef.current.w / 2 - a.x) * 0.001 * simEnergy.current;
            a.vy += (viewBoxRef.current.h / 2 - a.y) * 0.001 * simEnergy.current;
            a.vx *= 0.88;
            a.vy *= 0.88;
            a.x += a.vx;
            a.y += a.vy;
            totalEnergy += Math.abs(a.vx) + Math.abs(a.vy);
          }

          return nodes;
        });

        simEnergy.current *= 0.997;
        if (simEnergy.current > 0.01) {
          animFrame.current = requestAnimationFrame(resumeSim);
        } else {
          simRunning.current = false;
        }
      }

      resumeSim();
    }
  }, [data]);

  // ── Mouse handlers ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      setDraggedNode(nodeId);
      simEnergy.current = 0.8;
      simRunning.current = true;

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
        dragOffset.current = { x: svgX - node.x, y: svgY - node.y };
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
              : n,
          ),
        );
      };

      const handleMouseUp = () => {
        setDraggedNode(null);
        reheatSimulation();
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [simulation, reheatSimulation],
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (draggedNode !== nodeId) {
        router.push(`/items/${nodeId}`);
      }
    },
    [router, draggedNode],
  );

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.12 : 0.88;
    setViewBox((prev) => ({
      ...prev,
      w: Math.max(200, Math.min(5000, prev.w * scale)),
      h: Math.max(150, Math.min(3750, prev.h * scale)),
    }));
  };

  // Pan handlers (using ref to avoid state-update-per-mousemove)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === "svg") {
      isPanningRef.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panVB.current = { ...viewBoxRef.current };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    const vb = panVB.current;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = vb.w / rect.width;
    const scaleY = vb.h / rect.height;
    setViewBox({
      x: vb.x - dx * scaleX,
      y: vb.y - dy * scaleY,
      w: vb.w,
      h: vb.h,
    });
  };

  const handleCanvasMouseUp = () => {
    isPanningRef.current = false;
  };

  const resetView = () => {
    setViewBox({ x: 0, y: 0, w: 800, h: 600 });
  };

  // Filtered data for display
  const filteredNodeIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(
      data.nodes
        .filter((n) => selectedTypes.has(n.type))
        .filter(
          (n) =>
            !searchQuery ||
            n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
        )
        .map((n) => n.id),
    );
  }, [data, selectedTypes, searchQuery]);

  const visibleSimulation = useMemo(() => {
    return simulation.filter((n) => filteredNodeIds.has(n.id));
  }, [simulation, filteredNodeIds]);

  // Derive full node data for tooltip from hoveredNode ID
  const hoveredNodeData = useMemo(() => {
    if (!hoveredNode) return null;
    return simulation.find((n) => n.id === hoveredNode) || null;
  }, [hoveredNode, simulation]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded-lg" />
        <div className="h-5 w-72 skeleton rounded" />
        <div className="glass-card rounded-2xl h-[600px] flex items-center justify-center relative overflow-hidden">
          <ParticleBackground />
          <div className="text-center relative z-10">
            <div className="animate-spin text-4xl mb-4 text-nexus-400">⬡</div>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Knowledge Graph</h1>
            <p className="text-muted-foreground mt-1">
              Visualize connections between your knowledge
            </p>
          </div>
        </div>
        <div className="glass-card rounded-2xl h-[600px] flex items-center justify-center relative overflow-hidden">
          <ParticleBackground />
          <div className="text-center relative z-10">
            <div className="text-5xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold text-red-400 mb-1">Failed to load graph</h3>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasGraph = data && data.nodes.length > 0;
  const totalTypes = Object.keys(TYPE_CONFIG);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Knowledge Graph</h1>
          <p className="text-muted-foreground mt-1">
            {hasGraph
              ? `${data!.nodes.length} items connected by ${data!.edges.length} relationships`
              : "Visualize connections between your knowledge"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Node Search */}
          {hasGraph && data!.nodes.length > 0 && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                ⌕
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find nodes..."
                className="w-40 pl-8 pr-3 py-2 bg-muted border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-nexus-500/30 transition-all"
              />
            </div>
          )}
          <button
            onClick={() => setShowLegend(!showLegend)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all",
              showLegend
                ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                : "glass-card hover:bg-card/70",
            )}
          >
            <span>▣</span>
            Legend
          </button>
          {hasGraph && data!.nodes.length > 0 && (
            <button
              onClick={resetView}
              className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-card/70 rounded-lg text-sm transition-all"
            >
              <span>⟲</span>
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="glass-card rounded-2xl h-[650px] relative overflow-hidden">
        <ParticleBackground />

        {/* Legend Panel */}
        {showLegend && (
          <div className="absolute top-4 left-4 z-20 glass-card p-4 rounded-xl w-48 animate-fade-in-up">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Node Types
            </h3>
            <div className="space-y-1.5">
              {totalTypes.map((type) => {
                const cfg = TYPE_CONFIG[type];
                const isSelected = selectedTypes.has(type);
                const count = data?.nodes.filter((n) => n.type === type).length || 0;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type);
                        else next.add(type);
                        return next;
                      });
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all",
                      isSelected ? "bg-muted/50" : "opacity-40 hover:opacity-70",
                    )}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span className="flex-1 text-left">
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
            {searchQuery && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Found {visibleSimulation.length} matching node
                  {visibleSimulation.length !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {(!hasGraph || data!.nodes.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-30">⬡</div>
              <h2 className="text-xl font-semibold mb-2">No connections yet</h2>
              <p className="text-muted-foreground max-w-sm mx-auto">
                Your knowledge graph will appear here as you save items. NEXUS automatically
                discovers connections between related content.
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
        {hasGraph && simulation.length > 0 && (
          <svg
            ref={svgRef}
            className="w-full h-full select-none transition-opacity duration-500 cursor-grab active:cursor-grabbing"
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            preserveAspectRatio="xMidYMid meet"
            onWheel={handleWheel}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            <defs>
              {/* Glow filters */}
              <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Edge glow */}
              <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Node gradients */}
              {simulation.map((node) => {
                const color = TYPE_CONFIG[node.type]?.color || DEFAULT_COLOR;
                return (
                  <radialGradient key={node.id} id={`glow-${node.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                  </radialGradient>
                );
              })}
            </defs>

            {/* Edges */}
            {data!.edges.map((edge) => {
              const source = simulation.find((n) => n.id === edge.source);
              const target = simulation.find((n) => n.id === edge.target);
              if (!source || !target) return null;

              const sourceVisible = filteredNodeIds.has(edge.source);
              const targetVisible = filteredNodeIds.has(edge.target);
              if (!sourceVisible || !targetVisible) return null;

              const isHovered = hoveredNode === edge.source || hoveredNode === edge.target;
              const dimmed = hoveredNode && !isHovered;

              return (
                <g key={edge.id}>
                  {/* Edge line */}
                  <line
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={TYPE_CONFIG[source.type]?.color || DEFAULT_COLOR}
                    strokeWidth={Math.max(1, edge.strength * 4)}
                    strokeOpacity={dimmed ? 0.05 : isHovered ? 0.6 : 0.2 + edge.strength * 0.3}
                    className="transition-all duration-300"
                  />

                  {/* Edge label on hover */}
                  {isHovered && (
                    <text
                      x={(source.x + target.x) / 2}
                      y={(source.y + target.y) / 2 - 6}
                      textAnchor="middle"
                      fill={TYPE_CONFIG[source.type]?.color || DEFAULT_COLOR}
                      fontSize="8"
                      fontWeight="bold"
                      opacity={0.8}
                      className="select-none pointer-events-none"
                    >
                      {Math.round(edge.strength * 100)}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {simulation.map((node) => {
              if (!filteredNodeIds.has(node.id)) return null;

              const color = TYPE_CONFIG[node.type]?.color || DEFAULT_COLOR;
              const isHovered = hoveredNode === node.id;
              const isDragged = draggedNode === node.id;
              const dimmed = hoveredNode && !isHovered;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  style={{ cursor: "pointer" }}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="transition-opacity duration-300"
                  opacity={dimmed ? 0.15 : 1}
                >
                  {/* Glow ring */}
                  <circle
                    r={node.radius + 12}
                    fill={`url(#glow-${node.id})`}
                    opacity={isHovered ? 1 : 0.2}
                    className="transition-opacity duration-300"
                  />

                  {/* Outer ring */}
                  <circle
                    r={node.radius + 3}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered || isDragged ? 1.5 : 0}
                    strokeOpacity={0.4}
                    className="transition-all duration-300"
                  />

                  {/* Node body */}
                  <circle
                    r={isDragged ? node.radius + 3 : isHovered ? node.radius + 1 : node.radius}
                    fill={color}
                    fillOpacity={isDragged ? 0.95 : isHovered ? 0.85 : 0.65}
                    stroke={color}
                    strokeWidth={isHovered || isDragged ? 2.5 : 1.5}
                    strokeOpacity={isHovered ? 0.9 : 0.5}
                    className="transition-all duration-200"
                    filter={isHovered ? "url(#node-glow)" : undefined}
                  />

                  {/* Type icon */}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={node.radius * 0.55}
                    className="select-none pointer-events-none"
                  >
                    {TYPE_CONFIG[node.type]?.icon || "📄"}
                  </text>

                  {/* Title label on hover */}
                  {isHovered && (
                    <text
                      y={node.radius + 16}
                      textAnchor="middle"
                      fill="white"
                      fontSize="9"
                      fontWeight="500"
                      className="select-none pointer-events-none"
                      style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
                    >
                      {node.title.length > 28 ? node.title.slice(0, 28) + "…" : node.title}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Interaction Info */}
        <div className="absolute bottom-4 left-4 glass-card px-3 py-1.5 rounded-lg z-10">
          <span className="text-xs text-muted-foreground">
            ⊞ Drag nodes · Scroll to zoom · Click to view · Drag canvas to pan
          </span>
        </div>

        {/* Hover Tooltip */}
        {hoveredNodeData && (
          <div className="absolute bottom-4 right-4 glass-card p-4 rounded-xl max-w-xs z-10 animate-fade-in-up">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{TYPE_CONFIG[hoveredNodeData.type]?.icon || "📄"}</span>
              <span className="font-semibold text-sm truncate">{hoveredNodeData.title}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${TYPE_CONFIG[hoveredNodeData.type]?.color || DEFAULT_COLOR}20`,
                  color: TYPE_CONFIG[hoveredNodeData.type]?.color || DEFAULT_COLOR,
                }}
              >
                {hoveredNodeData.type}
              </span>
              {hoveredNodeData.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {hoveredNodeData.category}
                </span>
              )}
              {hoveredNodeData.connectionCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {hoveredNodeData.connectionCount} connection
                  {hoveredNodeData.connectionCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      {hasGraph && (
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Nodes",
              value: String(data!.stats.totalNodes),
              color: "text-nexus-400",
              icon: "⬡",
            },
            {
              label: "Edges",
              value: String(data!.stats.totalEdges),
              color: "text-green-400",
              icon: "╱",
            },
            {
              label: "Avg Strength",
              value: data!.stats.averageStrength
                ? `${Math.round(data!.stats.averageStrength * 100)}%`
                : "—",
              color: "text-yellow-400",
              icon: "⟐",
            },
            {
              label: "Connected",
              value:
                simulation.filter((n) => n.connectionCount > 0).length > 0
                  ? `${simulation.filter((n) => n.connectionCount > 0).length}/${data!.nodes.length}`
                  : "—",
              color: "text-purple-400",
              icon: "⊞",
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="glass-card p-4 rounded-xl text-center stagger-item"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-lg">{stat.icon}</span>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
