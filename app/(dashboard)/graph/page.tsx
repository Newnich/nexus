"use client";

import { useState } from "react";

export default function GraphPage() {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Knowledge Graph</h1>
          <p className="text-muted-foreground mt-1">
            Visualize connections between your knowledge
          </p>
        </div>
        <div className="flex items-center gap-2 p-1 glass-card rounded-lg">
          <button
            onClick={() => setViewMode("2d")}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === "2d" ? "bg-nexus-500/20 text-nexus-400" : "text-muted-foreground"
            }`}
          >
            ⊞ 2D Graph
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === "3d" ? "bg-nexus-500/20 text-nexus-400" : "text-muted-foreground"
            }`}
          >
            ◈ 3D Space
          </button>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="glass-card rounded-2xl h-[600px] relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Empty State */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">⬡</div>
            <h2 className="text-xl font-semibold mb-2">No connections yet</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Your knowledge graph will appear here as you save items.
              NEXUS automatically discovers connections between related content.
            </p>

            {/* Connection Preview Cards */}
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

        {/* View Info */}
        <div className="absolute bottom-4 left-4 glass-card px-3 py-1.5 rounded-lg">
          <span className="text-xs text-muted-foreground">
            {viewMode === "2d" ? "⊞ 2D Force Graph" : "◈ 3D Memory Palace"} — Zoom with scroll, drag to pan
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Nodes", value: "0", color: "text-nexus-400" },
          { label: "Edges", value: "0", color: "text-green-400" },
          { label: "Clusters", value: "0", color: "text-yellow-400" },
          { label: "Avg Strength", value: "—", color: "text-muted-foreground" },
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
