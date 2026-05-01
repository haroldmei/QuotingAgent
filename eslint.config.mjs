import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      ".codex/**",
      ".gemini/**",
      ".claude/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Allow console.warn/error in server-side code (logging via pino preferred)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Accessible interactive elements — handled at component level
      "jsx-a11y/click-events-have-key-events": "off",
      // Unused vars — use underscore prefix convention
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  // Test files, vendored components, debug seed scripts: legitimate unused fixture/prop/log vars.
  {
    files: [
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "e2e/**",
      "prisma/seed.ts",
      "src/components/ui/**",
      "src/worker/**",
      "src/app/api/**",
      "src/lib/**",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },
  // Legal pages: static long-form copy; apostrophe-escape lint is noise.
  // CookieConsent: third-party-shape `any` for posthog/sentry global handles.
  {
    files: [
      "src/app/(legal)/**",
      "src/components/CookieConsent.tsx",
    ],
    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];

export default eslintConfig;
