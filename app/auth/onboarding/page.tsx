"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Welcome to NEXUS",
    description: "Your AI-native knowledge OS. We'll help you get set up in a few seconds.",
    icon: "⟠",
  },
  {
    title: "What's your name?",
    description: "Help us personalize your experience.",
    icon: "✎",
  },
  {
    title: "Choose your focus",
    description: "Pick what you plan to save most often.",
    icon: "🎯",
  },
];

const FOCUS_OPTIONS = [
  { id: "research", label: "Research & Papers", icon: "🔬" },
  { id: "development", label: "Software Development", icon: "💻" },
  { id: "design", label: "Design & Creative", icon: "🎨" },
  { id: "learning", label: "Learning & Education", icon: "📚" },
  { id: "business", label: "Business & Strategy", icon: "💼" },
  { id: "personal", label: "Personal Knowledge", icon: "🧠" },
];

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

    const particles: { x: number; y: number; vx: number; vy: number; alpha: number }[] = [];
    const COUNT = 50;

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
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          alpha: Math.random() * 0.2 + 0.05,
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
        ctx!.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(99, 102, 241, ${p.alpha})`;
        ctx!.fill();
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

function Orbs() {
  return (
    <>
      <div className="absolute top-1/4 left-[10%] w-72 h-72 bg-nexus-500/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-[10%] w-96 h-96 bg-purple-500/3 rounded-full blur-3xl animate-float-delayed" />
    </>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (step === 1) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [step]);

  if (!mounted) return null;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const sb = supabase();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await sb.from("users").update({
        name: name || undefined,
        preferences: {
          theme: "dark",
          defaultView: "grid",
          itemsPerPage: 50,
          enableSpatialView: true,
          keyboardShortcuts: {},
        },
        ai_settings: {
          organizationStyle: "auto",
          summaryLength: "medium",
          connectionAggressiveness: 0.5,
          autoTag: true,
          autoCategorize: true,
          dailyDigest: true,
          weeklyReport: false,
        },
      }).eq("id", user.id);

      if (error) throw error;

      await sb.from("activity_log").insert({
        user_id: user.id,
        action: "onboarding_completed",
        entity_type: "user",
        entity_id: user.id,
        metadata: { focus, completedSteps: STEPS.length },
      });

      toast.success("Welcome to NEXUS! 🚀");
      router.push("/dashboard");
    } catch {
      toast.error("Something went wrong, but you're in!");
      router.push("/dashboard");
    }
  };

  const canProceed = () => {
    if (step === 0) return true;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return focus !== null;
    return false;
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <ParticleBackground />
      <Orbs />

      <div className="relative z-10 w-full max-w-lg px-4 animate-fade-in-up">
        {/* Progress Bar */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-500",
                    i === step
                      ? "bg-nexus-500/20 text-nexus-400 border-2 border-nexus-500/50 scale-110"
                      : i < step
                      ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                      : "bg-muted text-muted-foreground border border-border"
                  )}
                >
                  {i < step ? "✓" : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-0.5 transition-all duration-500",
                      i < step ? "bg-nexus-500/50" : "bg-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          {/* Progress track */}
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-nexus-500 to-nexus-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="gradient-border">
          <div className="glass-card p-10 rounded-xl">
            <div className="transition-all duration-500 animate-fade-in-up" key={step}>
              <div className="text-center mb-8">
                <div className="text-5xl mb-4 inline-block">{STEPS[step].icon}</div>
                <h1 className="text-2xl font-bold gradient-text mb-2">
                  {STEPS[step].title}
                </h1>
                <p className="text-muted-foreground">{STEPS[step].description}</p>
              </div>

              {step === 1 && (
                <div className="mb-8">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Enter your name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && canProceed() && handleNext()}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-center text-lg focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
                    maxLength={100}
                    autoComplete="name"
                  />
                </div>
              )}

              {step === 2 && (
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {FOCUS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setFocus(option.id)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 hover-lift",
                        focus === option.id
                          ? "border-nexus-500 bg-nexus-500/10 text-nexus-400"
                          : "border-border hover:border-nexus-500/30 hover:bg-muted/50"
                      )}
                    >
                      <span className="text-2xl">{option.icon}</span>
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBack}
                  className={cn(
                    "px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
                    step === 0 ? "invisible" : ""
                  )}
                >
                  ← Back
                </button>

                {step < STEPS.length - 1 ? (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="px-6 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:opacity-40 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                  >
                    Continue
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    onClick={handleComplete}
                    disabled={loading || !canProceed()}
                    className="px-6 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:opacity-40 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin">⟳</span>
                        Setting up...
                      </>
                    ) : (
                      <>
                        Go to NEXUS
                        <span>→</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Skip link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-muted-foreground hover:text-nexus-400 transition-colors"
          >
            Skip onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
