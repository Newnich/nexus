import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "NEXUS Dashboard — Your Knowledge at a Glance";
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
      {/* Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Orb */}
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

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "32px",
          marginBottom: "28px",
        }}
      >
        {[
          { value: "∞", label: "Items" },
          { value: "AI", label: "Auto-Organized" },
          { value: "⬡", label: "Knowledge Graph" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "16px 32px",
              borderRadius: "16px",
              background: "rgba(99, 102, 241, 0.08)",
              border: "1px solid rgba(99, 102, 241, 0.15)",
            }}
          >
            <span
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: "#818cf8",
                marginBottom: "4px",
              }}
            >
              {stat.value}
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "#94a3b8",
              }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Logo + Title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontSize: "48px",
            color: "#818cf8",
          }}
        >
          ⟠
        </span>
        <h1
          style={{
            fontSize: "56px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: 0,
            background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          NEXUS
        </h1>
      </div>

      <p
        style={{
          fontSize: "20px",
          color: "#94a3b8",
          margin: 0,
          letterSpacing: "0.02em",
        }}
      >
        Dashboard — Your Knowledge at a Glance
      </p>

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
