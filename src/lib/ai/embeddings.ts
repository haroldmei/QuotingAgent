/**
 * Embedding service (Voyage AI voyage-3, 1024 dims).
 *
 * STACK_GAP-001 resolution from docs/03-system-design.md §9:
 *   Anthropic does not host an embedding endpoint; voyage-3 is the
 *   Anthropic-recommended option and is what the rate_card_embeddings
 *   migration was sized for (1024 dims, IVFFlat cosine).
 *
 * Caching: a content-hash → vector cache lives in Redis (the same Upstash
 * instance backing BullMQ). Identical Bunnings line descriptions across
 * crews share a vector and we don't re-embed.
 *
 * Cost: voyage-3 input is logged through `withCostTracking()` on the
 * `embedding` route so it shows up in NFR-005 roll-ups.
 */

import { createHash } from "crypto";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";
import { EMBEDDING_DIMS, EMBEDDING_MODEL } from "@/lib/ai/models";
import { computeEmbeddingCostAud } from "@/lib/ai/pricing";
import { recordAiCall, type AiCallContext } from "@/lib/ai/cost-tracking";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const PROMPT_VERSION = "voyage-3:2026-04-28-1";

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // dev/test path — caching becomes a no-op
  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Embed one text and return its vector.
 * Cached by sha256 of `(model, text)` to avoid re-billing for duplicate inputs.
 */
export async function embed(text: string, ctx?: Partial<AiCallContext>): Promise<number[]> {
  const vectors = await embedBatch([text], ctx);
  return vectors[0]!;
}

/**
 * Embed an array of texts in a single API call.
 * Voyage's batch endpoint is much cheaper than N serial calls; the cache
 * layer is per-text so we only send uncached items to the API.
 */
export async function embedBatch(
  texts: string[],
  ctx?: Partial<AiCallContext>,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const redis = getRedis();
  const result: (number[] | null)[] = new Array(texts.length).fill(null);

  // 1) Check cache for each input.
  const uncachedIndices: number[] = [];
  if (redis) {
    const keys = texts.map((t) => cacheKey(t));
    const cached = await redis.mget<(number[] | null)[]>(...keys);
    for (let i = 0; i < texts.length; i++) {
      const hit = cached[i];
      if (hit && Array.isArray(hit) && hit.length === EMBEDDING_DIMS) {
        result[i] = hit;
      } else {
        uncachedIndices.push(i);
      }
    }
  } else {
    for (let i = 0; i < texts.length; i++) uncachedIndices.push(i);
  }

  // 2) Embed the uncached subset.
  if (uncachedIndices.length > 0) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error("VOYAGE_API_KEY not configured (STACK_GAP-001 unresolved)");
    }
    const inputs = uncachedIndices.map((i) => texts[i]!);
    const start = Date.now();
    let inputTokens = 0;
    let isError = false;
    try {
      const res = await fetch(VOYAGE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_MODEL,
          input: inputs,
          input_type: "document",
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Voyage API ${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as VoyageResponse;
      inputTokens = json.usage?.total_tokens ?? 0;
      for (let i = 0; i < uncachedIndices.length; i++) {
        const idx = uncachedIndices[i]!;
        const vec = json.data[i]?.embedding;
        if (!vec || vec.length !== EMBEDDING_DIMS) {
          throw new Error(`Voyage returned wrong dimension: got ${vec?.length}, want ${EMBEDDING_DIMS}`);
        }
        result[idx] = vec;
        if (redis) {
          // Cache the result; ignore errors — caching is best-effort.
          await redis.set(cacheKey(texts[idx]!), vec, { ex: CACHE_TTL_SECONDS });
        }
      }
    } catch (err) {
      isError = true;
      logger.error({ err }, "ai.embed.error");
      throw err;
    } finally {
      const latencyMs = Date.now() - start;
      const costAud = computeEmbeddingCostAud(inputTokens);
      // Record one ledger row for the whole batch (cardinality control).
      void recordAiCall({
        model: EMBEDDING_MODEL,
        promptVersion: PROMPT_VERSION,
        route: "embedding",
        userId: ctx?.userId ?? null,
        crewId: ctx?.crewId ?? null,
        quoteId: ctx?.quoteId ?? null,
        inputTokens,
        cachedInputTokens: 0,
        outputTokens: 0,
        latencyMs,
        costAud,
        isError,
        fallbackUsed: false,
      });
    }
  }

  // 3) Assert no nulls remain.
  for (let i = 0; i < result.length; i++) {
    if (!result[i]) {
      throw new Error(`Embedding pipeline returned null for index ${i}`);
    }
  }
  return result as number[][];
}

function cacheKey(text: string): string {
  const hash = createHash("sha256").update(`${EMBEDDING_MODEL}:${text}`).digest("hex");
  return `embed:${hash}`;
}

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens: number };
}
