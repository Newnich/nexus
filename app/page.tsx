"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-nexus-950/50 via-background to-nexus-900/30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-nexus-500/10 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-nexus-600/10 rounded-full blur-3xl animate-float" />

      {/* Content */}
      <div className="relative z-10 text-center max-w-2xl px-4">
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm text-muted-foreground">
            AI-Native Knowledge OS
          </span>
        </div>

        <h1 className="text-6xl font-bold mb-6 gradient-text">
          NEXUS
        </h1>
        <p className="text-xl text-muted-foreground mb-4 leading-relaxed">
          The last app you'll ever need for information.
        </p>
        <p className="text-muted-foreground/60 mb-12 max-w-lg mx-auto">
          AI automatically organizes, connects, and surfaces your knowledge.
          Save anything. Find everything. Know more.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-nexus-500/25"
          >
            <span>Enter NEXUS</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-8 py-3 glass-card hover:bg-card/70 text-foreground font-medium rounded-xl transition-all duration-200"
          >
            Sign in
          </Link>
        </div>

        {/* Feature preview */}
        <div className="mt-16 grid grid-cols-3 gap-6 text-left">
          {[
            {
              icon: "💾",
              title: "Universal Capture",
              desc: "Save anything in 1 click — links, notes, files, screenshots, voice memos",
            },
            {
              icon: "🧠",
              title: "AI Auto-Organization",
              desc: "Automatically categorized, tagged, summarized, and connected",
            },
            {
              icon: "🔮",
              title: "Spatial Discovery",
              desc: "Browse your knowledge as a 3D memory palace or interactive graph",
            },
          ].map((feature) => (
            <div key={feature.title} className="glass-card p-5 hover:border-nexus-500/30 transition-all duration-300">
              <div className="text-2xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold mb-2 text-sm">{feature.title}</h3>
              <p className="text-xs text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
