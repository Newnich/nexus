import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Shared content from NEXUS — AI-Native Knowledge OS";
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
        padding: "60px 80px",
      }}
    >
      {/* Grid pattern */}
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

      {/* Shared badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 20px",
          borderRadius: "999px",
          background: "rgba(99, 102, 241, 0.1)",
          border: "1px solid rgba(99, 102, 241, 0.2)",
          marginBottom: "24px",
        }}
      >
        <span style={{ fontSize: "16px", color: "#818cf8" }}>⟠</span>
        <span style={{ fontSize: "14px", color: "#94a3b8", letterSpacing: "0.05em" }}>
          SHARED FROM NEXUS
        </span>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "48px",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: "0 0 12px 0",
          background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
          backgroundClip: "text",
          color: "transparent",
          textAlign: "center",
        }}
      >
        Shared Knowledge
      </h1>

      {/* Description */}
      <p
        style={{
          fontSize: "20px",
          color: "#94a3b8",
          margin: "0 0 32px 0",
          textAlign: "center",
          maxWidth: "600px",
          lineHeight: 1.4,
        }}
      >
        Someone shared content with you from NEXUS — their AI-native knowledge operating system
      </p>

      {/* CTA */}
      <div
        style={{
          display: "flex",
          padding: "12px 28px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
          fontSize: "16px",
          fontWeight: 600,
          color: "#ffffff",
        }}
      >
        ⟠ Open in NEXUS
      </div>

      {/* NEXUS branding */}
      <div
        style={{
          position: "absolute",
          bottom: "28px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "14px", color: "#475569" }}>Powered by</span>
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#6366f1" }}>NEXUS</span>
      </div>

      {/* Bottom accent */}
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
