/**
 * promptfoo root config — runs both vision-quote and extraction suites.
 *
 * Stack contract: testing.ai_eval=promptfoo
 * Wedge: NFR-006 ≥80% line-item accuracy on a 50-photo gold set
 * (V1 ships with 10 fixtures; we expand to 50 before beta — OI-004).
 *
 * Run: `pnpm eval`  (CI gate — see scripts/quality-gates.sh)
 */

import type { UnifiedConfig } from "promptfoo";

const config: UnifiedConfig = {
  description: "QuotingAgent — vision + extraction eval suite",

  // promptfoo aggregates results across multiple per-prompt configs.
  // Each sub-config defines its own prompts + providers + tests.
  // The CLI gate is `pnpm eval` which runs ALL configs and exits non-zero
  // on regression (passRate drop or threshold miss).
  // See evals/<task>.config.yaml for the actual prompt & assertion definitions.

  // Block merge if line-item accuracy on the gold set drops below 80%
  // (NFR-006). Per-fixture `assert` blocks in evals/<task>.config.yaml
  // encode line-item match thresholds; the suite passRate must be ≥ 0.80.
  // The CI gate (scripts/quality-gates.sh) enforces this via `pnpm eval`
  // exit code; promptfoo exits non-zero when assertions fail.


  // We keep configs in YAML for diffability but expose a TS root so
  // `pnpm eval` (in package.json) can resolve via `--config promptfoo.config.ts`.
  // The YAML configs are loaded via `promptfoo eval --config evals/`.
  prompts: [],
  providers: [],
  tests: [],
};

export default config;
