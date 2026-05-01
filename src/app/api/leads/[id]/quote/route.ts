/**
 * POST /api/leads/[id]/quote — enqueue AI quote generation (FR-011)
 * GET  /api/leads/[id]/quote — get latest quote draft for a lead (FR-015)
 *
 * Stack contract:
 *   queue.engine=bullmq, queue.backing=upstash-redis
 *   security.rate_limiting=required (NFR-012: 100/day per crew)
 */

import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import { QuoteEnqueueReqSchema } from "@/lib/schemas/quotes";
import { rateLimiters } from "@/lib/services/rate-limit";
import { getRedis } from "@/lib/services/rate-limit";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

// BullMQ queue — uses same Upstash Redis as rate limiters
// We use ioredis-style connection via UPSTASH_REDIS_REST_URL
let _quoteQueue: Queue | null = null;

function getQuoteQueue(): Queue {
  if (_quoteQueue) return _quoteQueue;
  _quoteQueue = new Queue("quote-generation", {
    connection: {
      host: new URL(process.env.UPSTASH_REDIS_REST_URL ?? "redis://localhost:6379").hostname,
      port: 6379,
      password: process.env.UPSTASH_REDIS_REST_TOKEN,
      tls: process.env.UPSTASH_REDIS_REST_URL?.startsWith("https") ? {} : undefined,
    },
  });
  return _quoteQueue;
}

// ---------------------------------------------------------------------------
// POST /api/leads/[id]/quote — enqueue
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId, userId } = auth.ctx;
  const { id: leadId } = await params;

  // Rate limit: 100/day per crew
  const { success } = await rateLimiters.quoteGenerate.limit(crewId);
  if (!success) {
    return NextResponse.json(
      { error: "Daily quote generation limit reached (100/day)" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parse = QuoteEnqueueReqSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const supabase = await createServerClient();

  // Verify lead ownership
  const { data: lead } = await supabase
    .from("leads")
    .select("id, crew_id, status")
    .eq("id", leadId)
    .eq("crew_id", crewId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Check at least 1 photo
  const { data: photos } = await supabase
    .from("photos")
    .select("id, gcs_path")
    .eq("lead_id", leadId);
  if (!photos || photos.length === 0) {
    return NextResponse.json(
      { error: "At least one photo is required before generating a quote" },
      { status: 409 }
    );
  }

  // Check licence_verified before allowing quote generation (NFR-019)
  const { data: crew } = await supabase
    .from("crews")
    .select("licence_verified, trade_type, default_labour_rate_aud")
    .eq("id", crewId)
    .single();

  if (!crew?.licence_verified) {
    return NextResponse.json(
      { error: "NSW contractor licence must be verified before generating quotes" },
      { status: 403 }
    );
  }

  // Check for ≥5 completed jobs for rate-card learning (FR-030)
  const { count: completedJobsCount } = await supabase
    .from("job_completions")
    .select("id", { count: "exact", head: true })
    .eq("crew_id", crewId)
    .not("invoiced_amount_aud", "is", null);

  // Create a quote record in "draft" status
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      lead_id: leadId,
      crew_id: crewId,
      status: "draft",
      rate_card_source: "live",
    })
    .select()
    .single();

  if (quoteError || !quote) {
    logger.error({ err: quoteError, leadId }, "quote.create.error");
    return NextResponse.json({ error: "Failed to create quote" }, { status: 500 });
  }

  // Update lead status to "generating"
  await supabase
    .from("leads")
    .update({ status: "generating" })
    .eq("id", leadId)
    .eq("crew_id", crewId);

  // Enqueue BullMQ job
  try {
    const queue = getQuoteQueue();
    await queue.add(
      "process-quote",
      {
        quoteId: quote.id,
        leadId,
        crewId,
        userId,
        contextNote: parse.data.context ?? null,
        tradeType: crew.trade_type,
        defaultLabourRateAud: Number(crew.default_labour_rate_aud),
        hasLearnedRateCard: (completedJobsCount ?? 0) >= 5,
        photoCount: photos.length,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
  } catch (queueErr) {
    // Queue unavailable — rollback
    logger.error({ err: queueErr, quoteId: quote.id }, "quote.enqueue.error");
    await supabase.from("quotes").delete().eq("id", quote.id);
    await supabase
      .from("leads")
      .update({ status: "new" })
      .eq("id", leadId)
      .eq("crew_id", crewId);
    return NextResponse.json(
      { error: "Failed to enqueue quote generation. Please try again." },
      { status: 503 }
    );
  }

  logger.info({ quoteId: quote.id, leadId, crewId }, "quote.enqueued");

  return NextResponse.json(
    { quote_id: quote.id, status: "generating" },
    { status: 202 }
  );
}

// ---------------------------------------------------------------------------
// GET /api/leads/[id]/quote — get latest quote draft
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id: leadId } = await params;

  const supabase = await createServerClient();

  // Get most recent quote for this lead + crew
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("lead_id", leadId)
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !quote) {
    return NextResponse.json({ error: "No quote found for this lead" }, { status: 404 });
  }

  // Fetch line items separately (no FK relationship in types)
  const { data: lineItems } = await supabase
    .from("quote_line_items")
    .select("*")
    .eq("quote_id", quote.id)
    .order("sort_order");

  return NextResponse.json({ ...quote, quote_line_items: lineItems ?? [] });
}
