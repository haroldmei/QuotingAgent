/**
 * Confidence-score helpers + refusal path.
 *
 * Stack contract: ai.confidence_scores=required
 * Wedge: FR-014 per-line confidence + below-threshold flagging;
 *        NFR-006 ≥80% line-item accuracy threshold.
 *
 * The extraction model emits `confidence_score: 0..100` per line item. This
 * module owns the thresholds and the "refuse to send" gate (better to delay
 * 10 minutes than send a wrong quote — wedge §6 ai-features constraint).
 */

import type { ExtractedQuoteLine } from "@/prompts/extraction";

/** Per-line threshold below which we flag the line for human review (FR-014). */
export const LINE_CONFIDENCE_THRESHOLD = 80;

/**
 * Whole-quote refusal threshold. If overall confidence < this, the worker
 * marks the quote `requires_review` and surfaces the "Send anyway" dialog
 * (FR-014: "Send with low-confidence lines" requires explicit confirmation).
 */
export const REFUSE_THRESHOLD = 60;

export interface ConfidenceSummary {
  /** Mean confidence across all lines (0..100). */
  overallConfidence: number;
  /** Count of lines below the per-line threshold. */
  flaggedLineCount: number;
  /** True when the whole quote should be routed to human review. */
  requiresReview: boolean;
  /** True when at least one line is flagged but quote is sendable. */
  hasFlaggedLines: boolean;
}

/**
 * Summarise per-line scores and decide whether to route to human review.
 */
export function summariseConfidence(lines: ExtractedQuoteLine[]): ConfidenceSummary {
  if (lines.length === 0) {
    // No lines == nothing to send. Force review.
    return {
      overallConfidence: 0,
      flaggedLineCount: 0,
      requiresReview: true,
      hasFlaggedLines: false,
    };
  }

  let sum = 0;
  let flagged = 0;
  for (const line of lines) {
    sum += line.confidence_score;
    if (line.confidence_score < LINE_CONFIDENCE_THRESHOLD) flagged++;
  }
  const overall = Math.round(sum / lines.length);
  const moreThanThreeFlagged = flagged > 3;
  const lowOverall = overall < REFUSE_THRESHOLD;

  return {
    overallConfidence: overall,
    flaggedLineCount: flagged,
    requiresReview: lowOverall || moreThanThreeFlagged,
    hasFlaggedLines: flagged > 0,
  };
}
