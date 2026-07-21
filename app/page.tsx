"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

// ── Animated particles background ──
function Particles({ count = 60 }: { count?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.4 + 0.1,
    }));

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
        ctx!.fillStyle = `rgba(99, 102, 241, ${p.opacity})`;
        ctx!.fill();
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.strokeStyle = `rgba(99, 102, 241, ${0.06 * (1 - dist / 120)})`;
            ctx!.lineWidth = 0.5;
            ctx!.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.8 }}
    />
  );
}

// ── Floating orb decorations ──
function Orbs() {
  return (
    <>
      <div className="absolute top-1/4 left-[15%] w-96 h-96 bg-nexus-500/8 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/3 right-[10%] w-80 h-80 bg-nexus-600/8 rounded-full blur-3xl animate-float-delayed" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-nexus-500/3 rounded-full blur-3xl" />
    </>
  );
}

// ── Feature cards data ──
const FEATURES = [
  {
    icon: "💾",
    title: "Universal Capture",
    desc: "Save anything in 1 click — links, notes, files, screenshots, voice memos. NEXUS extracts and preserves the essence.",
    gradient: "from-blue-500/20 to-cyan-500/20",
  },
  {
    icon: "🧠",
    title: "AI Auto-Organization",
    desc: "Every item is automatically summarized, tagged, categorized, and connected. No manual tagging needed — ever.",
    gradient: "from-purple-500/20 to-pink-500/20",
  },
  {
    icon: "🔗",
    title: "Smart Connections",
    desc: "NEXUS discovers relationships between your items, building a living knowledge graph that grows with you.",
    gradient: "from-nexus-500/20 to-indigo-500/20",
  },
  {
    icon: "🔮",
    title: "Spatial Discovery",
    desc: "Browse your knowledge as an interactive 3D graph. Find what you didn't know you were looking for.",
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: "⚡",
    title: "Semantic Search",
    desc: "Search by meaning, not just keywords. NEXUS understands context and finds what matters — even if you can't remember the words.",
    gradient: "from-orange-500/20 to-amber-500/20",
  },
  {
    icon: "🔄",
    title: "Seamless Sync",
    desc: "Extensions, bookmarks, and web clipper. Your knowledge follows you everywhere, always up to date.",
    gradient: "from-red-500/20 to-rose-500/20",
  },
];

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  const phrases = [
    "Save anything.",
    "Find everything.",
    "Know more.",
  ];

  useEffect(() => {
    setMounted(true);
    setShowCursor(true);

    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    function type() {
      const currentPhrase = phrases[phraseIndex];

      if (!isDeleting) {
        setTypedText(currentPhrase.slice(0, charIndex + 1));
        charIndex++;

        if (charIndex === currentPhrase.length) {
          timeout = setTimeout(() => {
            isDeleting = true;
            type();
          }, 2000);
          return;
        }
      } else {
        setTypedText(currentPhrase.slice(0, charIndex - 1));
        charIndex--;

        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
        }
      }

      timeout = setTimeout(type, isDeleting ? 40 : 80);
    }

    timeout = setTimeout(type, 500);
    return () => clearTimeout(timeout);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden noise-overlay">
      <Particles count={80} />
      <Orbs />

      <div className="relative z-10">
        {/* ── Navigation ── */}
        <nav className="fixed top-0 inset-x-0 z-50 h-16 flex items-center justify-between px-6 backdrop-blur-xl border-b border-border/50 bg-background/60">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">⟠</span>
            <span className="font-bold gradient-text text-lg">NEXUS</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Sign in
            </Link>
            <Link
              href="/auth/login"
              className="text-sm px-5 py-2 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-nexus-500/25"
            >
              Get Started
            </Link>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="min-h-screen flex flex-col items-center justify-center px-4 pt-16">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full animate-fade-in-up">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">
                AI-Native Knowledge OS
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-7xl sm:text-8xl font-bold mb-6 gradient-text animate-fade-in-up-delayed-1">
              NEXUS
            </h1>

            <p className="text-xl text-muted-foreground mb-3 animate-fade-in-up-delayed-2">
              The last app you'll ever need for information.
            </p>

            {/* Typewriter */}
            <div className="h-10 mb-10 animate-fade-in-up-delayed-2">
              <span className="text-lg text-nexus-400 font-medium typing-cursor">
                {typedText}
              </span>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center justify-center gap-4 animate-fade-in-up-delayed-3">
              <Link
                href="/auth/login"
                className="group inline-flex items-center gap-2 px-8 py-3.5 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-nexus-500/25 hover-scale"
              >
                <span>Enter NEXUS</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 glass-card hover:bg-card/70 text-foreground font-medium rounded-xl transition-all duration-200 hover-scale"
              >
                Learn more
              </Link>
            </div>

            {/* Trust indicator */}
            <p className="mt-8 text-xs text-muted-foreground/50 animate-fade-in-up-delayed-4">
              No cloud dependency · Runs on your machine · Powered by local AI
            </p>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
            <div className="w-5 h-8 rounded-full border border-border/50 flex items-start justify-center pt-1.5">
              <div className="w-1 h-2 bg-nexus-500/50 rounded-full animate-bounce" />
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="px-4 py-24 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold gradient-text mb-4">
              Everything your mind needs
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              NEXUS transforms how you capture, organize, and discover knowledge.
              It's a second brain that actually works.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className="group glass-card p-6 rounded-2xl hover:border-nexus-500/30 transition-all duration-500 hover-lift stagger-item"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-nexus-400 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="px-4 py-24 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold gradient-text mb-4">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Three simple steps to a perfectly organized mind.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: "💾",
                title: "Save",
                desc: "Save links, notes, files, or screenshots. The browser extension makes it one click.",
                color: "border-nexus-500/30",
              },
              {
                step: "02",
                icon: "🧠",
                title: "Process",
                desc: "Local AI analyzes everything — extracting summaries, tags, categories, and connections.",
                color: "border-purple-500/30",
              },
              {
                step: "03",
                icon: "🔮",
                title: "Discover",
                desc: "Explore your knowledge graph, search semantically, and find connections you never noticed.",
                color: "border-emerald-500/30",
              },
            ].map((item) => (
              <div
                key={item.step}
                className={`glass-card p-8 rounded-2xl border ${item.color} hover:border-nexus-500/50 transition-all duration-500 hover-lift`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-xs font-mono text-nexus-400 bg-nexus-500/10 px-2 py-1 rounded">
                    Step {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stats / Social Proof ── */}
        <section className="px-4 py-24">
          <div className="max-w-4xl mx-auto glass-card p-12 rounded-3xl gradient-border text-center">
            <h2 className="text-3xl font-bold mb-4">
              Built for <span className="gradient-text">knowledge workers</span>
            </h2>
            <p className="text-muted-foreground mb-10 max-w-lg mx-auto">
              Whether you're a researcher, writer, developer, or lifelong learner —
              NEXUS adapts to how you think.
            </p>
            <div className="grid grid-cols-3 gap-8 mb-10">
              {[
                { value: "100%", label: "Local AI" },
                { value: "∞", label: "Items" },
                { value: "0", label: "Monthly fees" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-4xl font-bold gradient-text">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-nexus-500/25"
            >
              Start your knowledge OS
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="px-4 py-12 border-t border-border/30">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⟠</span>
              <span className="font-bold gradient-text">NEXUS</span>
            </div>
            <p className="text-xs text-muted-foreground/50">
              AI-Native Knowledge OS · No cloud dependency
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
