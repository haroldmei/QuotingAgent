import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // NFR-016: ≥80% branch coverage on AI worker, quote calculation, RLS helpers
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      include: [
        "src/lib/auth/**",
        "src/lib/db/**",
        "src/lib/schemas/**",
        "src/lib/quote/**",  // quote calculation (mutation-tested separately)
        "src/lib/worker/**", // AI worker helpers
        "src/lib/ai/**",     // ai-features (RAG, prompts, cost-tracking, retrieve)
      ],
      exclude: ["**/__tests__/**", "**/*.test.ts", "**/node_modules/**"],
    },
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/adversarial/**/*.test.ts",
    ],
    exclude: ["node_modules", ".next", "e2e"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
