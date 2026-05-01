/**
 * Token-aware text chunker.
 *
 * Used for splitting long crew rate-card documents (won-quote history,
 * supplier datasheets) before embedding. Default: 500 tokens, 50 overlap —
 * standard RAG sizing. Splits on markdown / paragraph boundaries first to
 * preserve semantic coherence; falls back to greedy token-window if a
 * paragraph exceeds the chunk size.
 *
 * Token counting uses a coarse character-based heuristic (~4 chars per token
 * for English) — accurate enough for chunk sizing. For exact accounting,
 * the SDK's `client.messages.countTokens()` is the authoritative source,
 * and is used by `cost-tracking` not by this module.
 */

const DEFAULT_CHUNK_TOKENS = 500;
const DEFAULT_OVERLAP_TOKENS = 50;
const APPROX_CHARS_PER_TOKEN = 4;

export interface ChunkOptions {
  chunkTokens?: number;
  overlapTokens?: number;
}

/** Split a string into chunks using paragraph-first, then sliding-window fallback. */
export function chunkText(input: string, opts: ChunkOptions = {}): string[] {
  const chunkTokens = opts.chunkTokens ?? DEFAULT_CHUNK_TOKENS;
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const chunkChars = chunkTokens * APPROX_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * APPROX_CHARS_PER_TOKEN;

  if (!input.trim()) return [];

  // Pass 1 — split on blank-line paragraph boundaries.
  const paragraphs = input.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";
  for (const para of paragraphs) {
    // If a single paragraph is too big, hand it to the sliding-window pass.
    if (estimateTokens(para) > chunkTokens) {
      if (buffer) {
        chunks.push(buffer.trim());
        buffer = "";
      }
      chunks.push(...slidingWindow(para, chunkChars, overlapChars));
      continue;
    }
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (estimateTokens(candidate) > chunkTokens) {
      chunks.push(buffer.trim());
      buffer = para;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());
  return chunks;
}

/** Sliding char-window with overlap for paragraphs that exceed chunk size. */
function slidingWindow(text: string, chunkChars: number, overlapChars: number): string[] {
  const out: string[] = [];
  const step = Math.max(chunkChars - overlapChars, 1);
  for (let start = 0; start < text.length; start += step) {
    out.push(text.slice(start, start + chunkChars).trim());
    if (start + chunkChars >= text.length) break;
  }
  return out.filter(Boolean);
}

/** Approximate token count from char length (English ~4 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}
