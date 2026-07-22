import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "NEXUS — Your AI-Native Knowledge Operating System";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0a0a1a 0%, #0f0f2e 50%, #141428 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid pattern overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glowing orb */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)",
        }}
      />

      {/* Logo symbol */}
      <div
        style={{
          fontSize: "72px",
          lineHeight: 1,
          marginBottom: "12px",
          color: "#818cf8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "120px",
          height: "120px",
          borderRadius: "28px",
          background:
            "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(129, 140, 248, 0.08) 100%)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
        }}
      >
        ⟠
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "64px",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: "0 0 8px 0",
          background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        NEXUS
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: "24px",
          color: "#94a3b8",
          margin: "0 0 4px 0",
          letterSpacing: "0.02em",
          fontWeight: 400,
        }}
      >
        Your AI-Native Knowledge Operating System
      </p>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "16px",
          color: "#64748b",
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        Save anything. Find everything. Know more.
      </p>

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, #6366f1, #818cf8, #6366f1)",
        }}
      />
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
