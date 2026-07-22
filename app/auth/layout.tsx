import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s — NEXUS",
    default: "Sign In — NEXUS",
  },
  description: "Sign in to NEXUS — your AI-native knowledge operating system.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
