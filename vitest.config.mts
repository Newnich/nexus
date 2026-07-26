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
      // Enforce minimum coverage thresholds — prevents regressions
      // Bumped to 15% after adding 8 new test files (387 tests)
      thresholds: {
        statements: 15,
        branches: 10,
        functions: 10,
        lines: 15,
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
