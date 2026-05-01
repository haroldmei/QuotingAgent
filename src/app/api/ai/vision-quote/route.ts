/**
 * Server-Sent Events stream of the vision pass.
 *
 * Consumer: src/hooks/useStreamedCompletion.ts (frontend skill).
 * Stack contract: ai.latency_budget_seconds=20; NFR-001 p50 ≤ 5min.
 *
 * NOTE: This endpoint streams vision-pass progress to the lead detail
 * screen so the tradie sees tokens flowing while the BullMQ worker is
 * doing the actual structured extraction in the background. The endpoint
 * itself does NOT do the full extraction or persist to DB — it's a
 * "preview" stream. The worker writes the canonical quote.
 *
 * Auth: Supabase JWT cookie (Route Handler). RLS check via supabase server client.
 * Rate limit: 100/day per crew (NFR-012).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { getAnthropicClient, withCostTracking } from "@/lib/ai/client";
import { LATENCY_BUDGET_MS, MODELS } from "@/lib/ai/models";
import {
  buildVisionPrompt,
  PROMPT_VERSION as VISION_PROMPT_VERSION,
} from "@/prompts/vision-quote";
import { retrieveRateCard } from "@/lib/ai/retrieve";
import { createServerClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs"; // Anthropic SDK uses node streams; not edge-safe
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  quoteId: z.string().uuid(),
  contextNote: z.string().max(280).nullable().optional(),
  photoUrls: z.array(z.string().url()).min(1).max(15),
});

export async function POST(req: NextRequest): Promise<Response> {
  // 1. Auth + RLS — resolve the calling user's crew.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerClient()) as any;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("users")
    .select("id,crew_id,crews(trade_type,default_labour_rate_aud)")
    .eq("id", auth.user.id)
    .single();
  if (profileErr || !profile?.crew_id) {
    return new Response("Profile incomplete", { status: 403 });
  }

  // 2. Validate payload.
  const json = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { quoteId, contextNote, photoUrls } = parsed.data;

  // 3. RAG — best-effort; empty list still streams (model emits no-match flags).
  const candidates = await retrieveRateCard(
    `Trade: ${(profile.crews as { trade_type?: string } | null)?.trade_type ?? "roofer"}. ${contextNote ?? ""}`,
    {
      topK: 12,
      mmrLambda: 0.7,
      aiCtx: { crewId: profile.crew_id, userId: auth.user.id, quoteId },
    },
  );

  // 4. Build the prompt.
  const tradeType = ((profile.crews as { trade_type?: string } | null)?.trade_type ??
    "roofer") as "roofer" | "painter" | "electrician" | "plumber" | "landscaper";
  const labourRate = Number(
    (profile.crews as { default_labour_rate_aud?: number | string } | null)?.default_labour_rate_aud ?? 0,
  );

  const prompt = buildVisionPrompt({
    tradeType,
    contextNote: contextNote ?? null,
    photoUrls,
    defaultLabourRateAud: labourRate,
    rateCardCandidates: candidates,
    marginSummary: null, // streaming preview doesn't compute margin summary
  });

  // 5. Stream — SSE wrapper around the Anthropic stream.
  const stream = await openStream({
    prompt,
    ctx: { quoteId, crewId: profile.crew_id, userId: auth.user.id },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disables proxy buffering on Vercel
    },
  });
}

// ---------------------------------------------------------------------------
// Stream wiring
// ---------------------------------------------------------------------------

interface OpenStreamArgs {
  prompt: ReturnType<typeof buildVisionPrompt>;
  ctx: { quoteId: string; crewId: string; userId: string };
}

async function openStream({ prompt, ctx }: OpenStreamArgs): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        send("start", { quote_id: ctx.quoteId, model: MODELS.vision, prompt_version: VISION_PROMPT_VERSION });

        // Wrap the Anthropic stream in withCostTracking so the ledger is written
        // even if the client disconnects mid-stream (we record the partial tokens).
        await withCostTracking(
          {
            model: MODELS.vision,
            promptVersion: VISION_PROMPT_VERSION,
            route: "vision-quote",
            ...ctx,
          },
          async () => {
            const client = getAnthropicClient();
            // SDK v0.40 typings lag adaptive thinking — cast at the boundary.
            const anthropicStream = client.messages.stream(
              {
                model: MODELS.vision,
                // AT-COST-001 fix: capped at 2048 to match the BullMQ worker.
                max_tokens: 2048,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                thinking: { type: "adaptive", display: "summarized" } as any,
                system: prompt.system,
                messages: prompt.messages,
              },
              { timeout: LATENCY_BUDGET_MS.llm },
            );

            anthropicStream.on("text", (delta) => send("delta", { text: delta }));

            // .finalMessage() handles all completion/error/abort states.
            const final = await anthropicStream.finalMessage();
            send("usage", { ...final.usage });
            return final;
          },
        );

        send("done", { quote_id: ctx.quoteId });
        controller.close();
      } catch (err) {
        // Per-skill rule: never silently fail. Return partial output marker.
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err: message, quoteId: ctx.quoteId }, "ai.stream.error");
        send("error", { message, partial: true, marker: "[truncated]" });
        controller.close();
      }
    },
  });
}
