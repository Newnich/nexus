"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const STEPS = [
  {
    title: "Welcome to NEXUS",
    description:
      "Your AI-native knowledge OS. We'll help you get set up in a few seconds.",
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
    // Focus the name input when step 1 is reached
    if (step === 1) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [step]);

  if (!mounted) return null;

  const handleComplete = async () => {
    setLoading(true);
    try {
      const sb = supabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update the user record with name and preferences
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

      // Log the onboarding activity
      await sb.from("activity_log").insert({
        user_id: user.id,
        action: "onboarding_completed",
        entity_type: "user",
        entity_id: user.id,
        metadata: { focus, completedSteps: STEPS.length },
      });

      toast.success("Welcome to NEXUS!");
      router.push("/dashboard");
    } catch (error) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-nexus-950/30 via-background to-nexus-900/20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-nexus-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full max-w-lg px-4">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {STEPS.map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  i === step
                    ? "bg-nexus-400 scale-125"
                    : i < step
                    ? "bg-nexus-600"
                    : "bg-muted"
                }`}
              />
              {i < STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 transition-colors duration-500 ${
                    i < step ? "bg-nexus-600" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="glass-card p-10 transition-all duration-500">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4 animate-float">{STEPS[step].icon}</div>
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
                onKeyDown={(e) => e.key === "Enter" && canProceed() && setStep(step + 1)}
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-center text-lg focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
                maxLength={100}
              />
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 gap-3 mb-8">
              {FOCUS_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setFocus(option.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                    focus === option.id
                      ? "border-nexus-500 bg-nexus-500/10 text-nexus-400"
                      : "border-border hover:border-nexus-500/30 hover:bg-muted/50"
                  }`}
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
              onClick={() => step > 0 && setStep(step - 1)}
              className={`px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors ${
                step === 0 ? "invisible" : ""
              }`}
            >
              ← Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={() => canProceed() && setStep(step + 1)}
                disabled={!canProceed()}
                className="px-6 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:opacity-40 text-white font-medium rounded-lg transition-all"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading || !canProceed()}
                className="px-6 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:opacity-40 text-white font-medium rounded-lg transition-all"
              >
                {loading ? "Setting up..." : "Go to NEXUS →"}
              </button>
            )}
          </div>
        </div>

        {/* Skip link */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip onboarding
          </button>
        </div>
      </div>
    </div>
  );
}
