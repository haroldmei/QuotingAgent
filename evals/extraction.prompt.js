/**
 * Promptfoo "function" prompt for the extraction pass.
 * Returns the system + messages payload that mirrors src/prompts/extraction.ts.
 *
 * Keeping this self-contained (rather than importing from src/) means evals
 * test the *deployed prompt shape*, not implementation internals — which is
 * the right boundary for a regression gate.
 */

const SYSTEM_PREAMBLE = `You are a strict quote extractor. You take the plain-text output of a
vision-pass quote draft and convert it to the structured JSON schema.

RULES:
1. Each line in the draft becomes one entry in \`lines\`. Materials → kind:"material", labour → "labour", everything else → "other".
2. Set \`confidence_score\` per line:
   - 90–100 — exact rate-card match, photo is clear, qty is straightforward
   - 80–89  — rate-card match but qty inferred from limited photos
   - 60–79  — partial match or ambiguous qty (single angle, occluded view) — set \`flag_reason\`
   - 0–59   — no rate-card match, "NO RATE-CARD MATCH" marker, or speculative line — set \`flag_reason\`
3. If the draft says "NO RATE-CARD MATCH" or unit_price is "?" → confidence_score ≤ 50 and \`flag_reason\` MUST be set.
4. Set \`overall_confidence\` to the WORST line confidence, NOT the average. The wedge requires conservative refusal.
5. If the vision pass said the photos are too unclear, return \`requires_review: true\` and \`lines: []\`.
6. \`requires_review\` MUST be true if any of:
   - more than 3 lines have confidence_score < 80
   - overall_confidence < 60
   - the draft mentions defects or legal must-fix items
7. Output ONLY the JSON. No preamble. No code fences.`;

module.exports = function ({ vars }) {
  return [
    { role: "system", content: SYSTEM_PREAMBLE },
    {
      role: "user",
      content: `Extract the quote draft below into structured JSON per the schema.\n\n<draft>\n${vars.vision_draft}\n</draft>`,
    },
  ];
};
