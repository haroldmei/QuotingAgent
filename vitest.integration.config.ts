import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: [
      "src/**/__integration__/**/*.test.ts",
      "src/**/*.integration.test.ts",
    ],
    exclude: ["node_modules", ".next", "e2e"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
