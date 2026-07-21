"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

// ── Particle Background ──
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let w = window.innerWidth;
    let h = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] = [];
    const COUNT = 80;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w;
      canvas!.height = h;
    }

    function init() {
      resize();
      for (let i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          r: Math.random() * 2 + 0.5,
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

        for (let j = 0; j < particles.length; j++) {
          const other = particles[j];
          if (p === other) continue;
          const dx = p.x - other.x;
          const dy = p.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx!.beginPath();
            ctx!.moveTo(p.x, p.y);
            ctx!.lineTo(other.x, other.y);
            ctx!.strokeStyle = `rgba(99, 102, 241, ${0.04 * (1 - dist / 150)})`;
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

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-0" />;
}

// ── Typewriter ──
function Typewriter({ phrases, className }: { phrases: string[]; className?: string }) {
  const [displayed, setDisplayed] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && charIndex < currentPhrase.length) {
      timeout = setTimeout(() => {
        setDisplayed(currentPhrase.slice(0, charIndex + 1));
        setCharIndex((c) => c + 1);
      }, 50);
    } else if (!isDeleting && charIndex === currentPhrase.length) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && charIndex > 0) {
      timeout = setTimeout(() => {
        setDisplayed(currentPhrase.slice(0, charIndex - 1));
        setCharIndex((c) => c - 1);
      }, 30);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setPhraseIndex((p) => (p + 1) % phrases.length);
    }

    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, phraseIndex, phrases]);

  return (
    <span className={className}>
      {displayed}
      <span className="animate-pulse text-nexus-400">|</span>
    </span>
  );
}

// ── Floating Orbs ──
function Orbs() {
  return (
    <>
      <div className="absolute top-20 left-[15%] w-64 h-64 bg-nexus-500/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-[15%] w-80 h-80 bg-purple-500/4 rounded-full blur-3xl animate-float-delayed" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-nexus-500/3 rounded-full blur-3xl animate-pulse-glow" />
    </>
  );
}

export default function LoginPage() {
  const sbRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    setMounted(true);
    sbRef.current = supabase();
    setReady(true);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await sbRef.current!.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account!");
        setIsSignUp(false);
      } else {
        const { error } = await sbRef.current!.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setLoading(true);
    try {
      const { error } = await sbRef.current!.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      toast.error((error as Error).message);
      setLoading(false);
    }
  };

  if (!ready || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin text-2xl text-nexus-400 mb-3">⟠</div>
          <p className="text-muted-foreground text-sm">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <ParticleBackground />
      <Orbs />

      <div className="relative z-10 w-full max-w-md px-4 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">⟠</div>
          <h1 className="text-3xl font-bold gradient-text mb-2">NEXUS</h1>
          <p className="text-muted-foreground text-lg">
            {isSignUp ? "Create your account" : "Welcome back"}
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2 h-6">
            <Typewriter
              phrases={[
                "Your AI-native knowledge OS",
                "Save anything · Find everything",
                "Automatically connected",
                "Think clearer with AI",
              ]}
            />
          </p>
        </div>

        <div className="gradient-border">
          <div className="glass-card p-8 rounded-xl">
            {/* OAuth Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleOAuth("google")}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-muted hover:bg-muted/80 border border-border hover:border-nexus-500/30 rounded-xl transition-all disabled:opacity-50 group"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="text-sm font-medium group-hover:text-nexus-400 transition-colors">Continue with Google</span>
              </button>

              <button
                onClick={() => handleOAuth("github")}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-muted hover:bg-muted/80 border border-border hover:border-nexus-500/30 rounded-xl transition-all disabled:opacity-50 group"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                <span className="text-sm font-medium group-hover:text-nexus-400 transition-colors">Continue with GitHub</span>
              </button>
            </div>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-3 text-muted-foreground">or continue with email</span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/40 focus:border-nexus-500 transition-all text-sm"
                  required
                />
              </div>
              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/40 focus:border-nexus-500 transition-all text-sm"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2",
                  loading ? "opacity-70 cursor-not-allowed" : ""
                )}
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    {isSignUp ? "Creating account..." : "Signing in..."}
                  </>
                ) : (
                  <>{isSignUp ? "Create Account" : "Sign In"}</>
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setPassword("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors hover:text-nexus-400"
              >
                {isSignUp
                  ? "Already have an account? Sign in"
                  : "Don't have an account? Create one"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/50 mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
