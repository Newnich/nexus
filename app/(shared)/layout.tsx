import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared — NEXUS",
  description: "View shared content from NEXUS",
};

export default function SharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
