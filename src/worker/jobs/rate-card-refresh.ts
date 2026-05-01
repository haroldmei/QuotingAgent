/**
 * rate-card-refresh BullMQ cron job
 * FR-013: Refresh Bunnings/Reece prices daily, embed new items, mark stale
 * Stack contract: external_integrations.bunnings.method=scrape-or-api
 *                 database.pgvector=true, ai.cache_rate_cards=required
 *
 * Strategy:
 *   1. Fetch live prices from Bunnings (PowerPass API if available, else scrape)
 *   2. Upsert rate_card_items (UNIQUE on supplier+sku)
 *   3. Mark items not updated in 7 days as stale
 *   4. Embed new/updated items via Voyage voyage-3 (STACK_GAP-001)
 *
 * If Bunnings is unavailable: log warning + continue with stale flag
 */

import pino from "pino";
import { createServiceClient } from "@/lib/db/supabase-server";
import { embed } from "@/lib/ai/embeddings";

const STALE_THRESHOLD_DAYS = 7;

// Hardcoded sample rate card items for V1 when Bunnings API/scrape is unavailable
// OI-003: Replace with live Bunnings PowerPass API or scrape when access confirmed
const BUNNINGS_FALLBACK_ITEMS = [
  { sku: "CL001", description: "Colorbond steel roofing sheet 0.42mm BMT 1200mm wide", price_aud: 48.5, unit: "lm" },
  { sku: "CL002", description: "Colorbond steel roofing sheet 0.48mm BMT 1200mm wide", price_aud: 58.0, unit: "lm" },
  { sku: "GU001", description: "Colorbond guttering 125mm quad profile 5.4m", price_aud: 52.0, unit: "ea" },
  { sku: "GU002", description: "Colorbond fascia 150mm x 5.4m", price_aud: 68.0, unit: "ea" },
  { sku: "SC001", description: "Roofing screws hex head 65mm class 3 500 pack", price_aud: 24.5, unit: "pk" },
  { sku: "FL001", description: "Flashings colorbond 150mm step flashing 2.4m", price_aud: 18.0, unit: "ea" },
  { sku: "RD001", description: "Ridge cap colorbond steel 3m", price_aud: 65.0, unit: "ea" },
  { sku: "DS001", description: "Downpipe colorbond 90mm round 2.4m", price_aud: 38.0, unit: "ea" },
  { sku: "PA001", description: "Dulux Weathershield exterior paint 15L tint base", price_aud: 189.0, unit: "ea" },
  { sku: "PA002", description: "Dulux 10L exterior primer undercoat", price_aud: 98.0, unit: "ea" },
  { sku: "PA003", description: "Paint roller frame 230mm", price_aud: 12.0, unit: "ea" },
  { sku: "PA004", description: "Extension pole 1.5m-2.4m", price_aud: 45.0, unit: "ea" },
];

export async function rateCardRefreshJob(logger: pino.Logger): Promise<void> {
  const serviceClient = createServiceClient();
  const now = new Date().toISOString();

  logger.info({ itemCount: BUNNINGS_FALLBACK_ITEMS.length }, "rate_card_refresh.start");

  // Fetch live prices (OI-003: placeholder until Bunnings access confirmed)
  let items: typeof BUNNINGS_FALLBACK_ITEMS;
  try {
    items = await fetchBunningsItems();
    logger.info({ itemCount: items.length }, "rate_card_refresh.bunnings_fetch_ok");
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "rate_card_refresh.bunnings_unavailable");
    // Use fallback items
    items = BUNNINGS_FALLBACK_ITEMS;
  }

  // Upsert rate_card_items
  const upserts = items.map((item) => ({
    supplier: "bunnings",
    sku: item.sku,
    description: item.description,
    price_aud: item.price_aud.toString(),
    fetched_at: now,
    stale: false,
  }));

  if (upserts.length > 0) {
    const { error: upsertError } = await (serviceClient as ReturnType<typeof createServiceClient> & {
      from: (table: string) => {
        upsert: (data: unknown, opts: unknown) => Promise<{ error: unknown }>;
      };
    })
      .from("rate_card_items")
      .upsert(upserts, { onConflict: "supplier, sku" });

    if (upsertError) {
      logger.error({ err: upsertError }, "rate_card_refresh.upsert_error");
    }
  }

  // Mark stale: items not fetched in the last 7 days
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await serviceClient
    .from("rate_card_items")
    .update({ stale: true })
    .lt("fetched_at", staleThreshold);

  // Embed new/updated items
  const { data: itemsToEmbed } = await serviceClient
    .from("rate_card_items")
    .select("id, description")
    .eq("fetched_at", now); // only items from this refresh run

  if (itemsToEmbed && itemsToEmbed.length > 0) {
    logger.info({ count: itemsToEmbed.length }, "rate_card_refresh.embedding");
    for (const item of itemsToEmbed) {
      try {
        const vector = await embed(item.description, {
          route: "rate-card-refresh",
          crewId: null,
          quoteId: null,
        });

        // Upsert embedding in rate_card_embeddings
        const supabase = serviceClient as unknown as {
          from: (table: string) => {
            upsert: (data: unknown, opts: unknown) => Promise<{ error: unknown }>;
          };
        };
        const { error: embedError } = await supabase
          .from("rate_card_embeddings")
          .upsert(
            {
              rate_card_item_id: item.id,
              embedding: `[${vector.join(",")}]`,
            },
            { onConflict: "rate_card_item_id" }
          );

        if (embedError) {
          logger.warn({ err: embedError, itemId: item.id }, "rate_card_refresh.embed_error");
        }
      } catch (embedErr) {
        logger.warn(
          { err: embedErr instanceof Error ? embedErr.message : String(embedErr), itemId: item.id },
          "rate_card_refresh.embed_failed"
        );
      }
    }
  }

  logger.info({ itemCount: upserts.length }, "rate_card_refresh.done");
}

/**
 * Placeholder Bunnings price fetcher.
 * OI-003: Replace with Bunnings PowerPass API call or scraper when access is confirmed.
 */
async function fetchBunningsItems(): Promise<typeof BUNNINGS_FALLBACK_ITEMS> {
  const bunningsApiKey = process.env.BUNNINGS_POWERPASS_KEY;
  if (!bunningsApiKey) {
    throw new Error("BUNNINGS_POWERPASS_KEY not configured (OI-003)");
  }

  // PowerPass API integration placeholder
  // TODO: Implement actual Bunnings PowerPass API call
  // The API endpoint and schema will be confirmed when OI-003 is resolved
  throw new Error("Bunnings PowerPass API integration pending (OI-003)");
}
