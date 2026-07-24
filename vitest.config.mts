import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.e2e.test.ts", "node_modules", "e2e"],
    // Unit tests don't need a browser environment — keep it fast with node
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      enabled: false, // opt-in via --coverage flag
      reporter: ["text", "lcov"],
      // Enforce minimum coverage thresholds — prevents regressions
      // Set to match current levels so CI passes; bump as coverage grows
      thresholds: {
        statements: 2,
        branches: 3,
        functions: 1,
        lines: 2,
      },
      include: ["lib/**", "app/**/*.tsx", "app/**/*.ts", "components/**"],
      exclude: [
        "**/*.config.*",
        "**/layout.tsx",
        "**/loading.tsx",
        "**/error.tsx",
        "**/not-found.tsx",
        "**/opengraph-image.tsx",
        "**/sitemap.ts",
        "**/robots.ts",
        "node_modules",
        "tests",
      ],
    },
  },
});
