/**
 * pgvector cosine-similarity retrieval over rate_card_embeddings.
 *
 * Stack contract:
 *   - database.pgvector=true
 *   - ai.vector_store=pgvector
 *   - ai.cache_rate_cards=required
 *
 * The schema (prisma/schema.prisma + supabase/migrations/20260501000002):
 *   rate_card_items(id, supplier, sku, description, price_aud, fetched_at, stale)
 *   rate_card_embeddings(id, rate_card_item_id UNIQUE, embedding vector(1024))
 *
 * Retrieval pattern (FR-013, design §3.4):
 *   1. Embed each AI-draft material description (Voyage voyage-3 → 1024-dim)
 *   2. Cosine top-K against rate_card_embeddings (default K=8)
 *   3. Optional MMR diversification to avoid near-duplicates from the same SKU family
 *   4. Join back to rate_card_items for { supplier, sku, description, price_aud, stale }
 *
 * RLS: rate_card_items / rate_card_embeddings are tenant-agnostic global cache
 * (per design §3.1). Both Vercel and Cloud Run use the service-role client
 * for these reads; no JWT propagation needed for retrieval.
 */

import { createServiceClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/logger";
import { embed } from "@/lib/ai/embeddings";
import type { AiCallContext } from "@/lib/ai/cost-tracking";

export interface RetrievedRateCardItem {
  /** UUID of rate_card_items.id — used for downstream FK joins. */
  sourceId: string;
  /** Plain-text description (e.g., "Colorbond sheet 0.42mm 2400mm length"). */
  chunk: string;
  /** Cosine similarity 0..1 (higher = more similar). */
  score: number;
  /** Supplier name — "bunnings" | "reece" | etc. */
  supplier: string;
  /** Supplier SKU. */
  sku: string;
  /** Cached price in AUD. */
  priceAud: number;
  /** True when fetch is > 7 days old (FR-013 banner trigger). */
  stale: boolean;
}

export interface RetrieveOptions {
  /** How many candidates to return after diversification. Default 8. */
  topK?: number;
  /** Maximal Marginal Relevance lambda 0..1 — 1 = pure relevance, 0 = pure diversity. Default 0.7 */
  mmrLambda?: number;
  /** Pre-MMR candidate pool size (must be >= topK). Default topK * 3. */
  candidatePool?: number;
  /** Optional supplier filter — restrict to "bunnings" or "reece". */
  supplier?: string;
  /** Cost-tracking ctx propagated to the embedding call. */
  aiCtx?: Partial<AiCallContext>;
}

/**
 * Embed the query and run a cosine top-K against rate_card_embeddings.
 * Returns at most `topK` items, optionally diversified via MMR.
 */
export async function retrieveRateCard(
  query: string,
  opts: RetrieveOptions = {},
): Promise<RetrievedRateCardItem[]> {
  const topK = opts.topK ?? 8;
  const candidatePool = opts.candidatePool ?? topK * 3;
  const queryVec = await embed(query, opts.aiCtx);

  // rate_card_search RPC is defined in migration 20260501000005 — not yet in
  // the auto-gen Database type. Cast at boundary; signature is enforced by Postgres.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;

  // pgvector cosine distance: `<=> ` operator. Score = 1 - distance.
  const vectorLiteral = `[${queryVec.join(",")}]`;
  const { data, error } = await supabase.rpc("rate_card_search", {
    query_vec: vectorLiteral,
    match_count: candidatePool,
    supplier_filter: opts.supplier ?? null,
  });

  if (error || !data) {
    // RPC missing in this env — degrade gracefully with empty result.
    // Worker will mark rate_card_source='cached' (or 'live' on miss path),
    // not a hard fail.
    logger.warn({ err: error, query: query.slice(0, 64) }, "ai.retrieve.rpc_missing");
    return [];
  }

  const candidates: RetrievedRateCardItem[] = (data as RawRow[]).map((r) => ({
    sourceId: r.id,
    chunk: r.description,
    score: 1 - r.distance,
    supplier: r.supplier,
    sku: r.sku,
    priceAud: Number(r.price_aud),
    stale: !!r.stale,
  }));

  if (opts.mmrLambda === undefined || opts.mmrLambda >= 1) {
    return candidates.slice(0, topK);
  }
  return mmr(candidates, queryVec, topK, opts.mmrLambda);
}

/**
 * Maximal Marginal Relevance — penalises candidates that are too similar to
 * already-selected ones. We approximate "candidate similarity" via score
 * spread because we don't have the candidate vectors back from pgvector
 * (would need a second round-trip). At preview tier the simple
 * score-band-spread heuristic is sufficient; revisit at launch tier.
 */
function mmr(
  candidates: RetrievedRateCardItem[],
  _queryVec: number[],
  topK: number,
  lambda: number,
): RetrievedRateCardItem[] {
  const selected: RetrievedRateCardItem[] = [];
  const remaining = [...candidates].sort((a, b) => b.score - a.score);
  while (selected.length < topK && remaining.length > 0) {
    if (selected.length === 0) {
      selected.push(remaining.shift()!);
      continue;
    }
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]!;
      const closestSel = Math.min(...selected.map((s) => Math.abs(s.score - c.score)));
      const mmrScore = lambda * c.score - (1 - lambda) * (1 - closestSel);
      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]!);
  }
  return selected;
}

interface RawRow {
  id: string;
  supplier: string;
  sku: string;
  description: string;
  price_aud: number | string;
  stale: boolean;
  distance: number;
}
