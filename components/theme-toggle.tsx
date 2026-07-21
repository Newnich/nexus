"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  resolved: "dark",
  setTheme: () => {},
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "nexus:theme";

function getStored(): Theme {
  if (typeof window === "undefined") return "dark";
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === "dark" || val === "light" || val === "system") return val;
  return "dark";
}

function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [resolved, setResolved] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = getStored();
    setThemeState(stored);
    setResolved(resolveTheme(stored));
    setMounted(true);
  }, []);

  // Apply class to html element
  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolved === "dark";
    root.classList.toggle("dark", isDark);
    // For light mode, we remove the class so CSS :root (light) applies
    // For dark mode, we add the class so .dark rules apply
  }, [resolved]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(resolveTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setResolved(resolveTheme(t));
    localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const toggle = useCallback(() => {
    const next = resolved === "dark" ? "light" : "dark";
    setThemeState(next);
    setResolved(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, [resolved]);

  // Prevent flash by not rendering toggle until mounted
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const { resolved, toggle, theme } = useTheme();

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      title={`Switch to ${resolved === "dark" ? "light" : "dark"} mode (currently ${theme})`}
    >
      {resolved === "dark" ? (
        <span className="text-base">☀️</span>
      ) : (
        <span className="text-base">🌙</span>
      )}
    </button>
  );
}
