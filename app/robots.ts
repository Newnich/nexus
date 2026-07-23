import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/dashboard",
        "/items",
        "/collections",
        "/settings",
        "/graph",
        "/search",
        "/activity",
        "/status",
        "/tags",
      ],
    },
    sitemap: "https://nexus-wine-chi.vercel.app/sitemap.xml",
  };
}
