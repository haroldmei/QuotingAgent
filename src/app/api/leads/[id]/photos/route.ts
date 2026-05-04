/**
 * POST /api/leads/[id]/photos — photo upload signed URL generation + commit (FR-008, FR-009)
 *
 * Two-phase upload:
 *   Phase 1 (POST ?action=init): return GCS signed PUT URLs
 *   Phase 2 (POST ?action=commit): record uploaded photos in DB after client PUT to GCS
 *
 * Stack contract:
 *   cloud.blob_storage=gcs — EXIF preserved (no server-side processing)
 *   security.rate_limiting=required
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import { PhotoUploadInitReqSchema, PhotoCommitReqSchema } from "@/lib/schemas/photos";
import { generatePhotoSignedPutUrl } from "@/lib/storage/supabase-storage";
import { rateLimiters } from "@/lib/services/rate-limit";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id: leadId } = await params;

  // Rate limit per crew
  const { success } = await rateLimiters.photoUpload.limit(crewId);
  if (!success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Verify lead ownership
  const supabase = await createServerClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("id, crew_id")
    .eq("id", leadId)
    .eq("crew_id", crewId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Determine action
  const action = req.nextUrl.searchParams.get("action") ?? "init";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Init — return signed PUT URLs
  // ---------------------------------------------------------------------------
  if (action === "init") {
    const parse = PhotoUploadInitReqSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parse.error.flatten() },
        { status: 422 }
      );
    }

    // Check existing photo count
    const { count: existingCount } = await supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId);

    if ((existingCount ?? 0) + parse.data.count > 15) {
      return NextResponse.json(
        { error: "Maximum 15 photos per lead" },
        { status: 409 }
      );
    }

    const uploads = await Promise.all(
      parse.data.mime_types.map(async (mime, index) => {
        const result = await generatePhotoSignedPutUrl(
          leadId,
          (existingCount ?? 0) + index,
          mime
        );
        return {
          index,
          signed_url: result.signedUrl,
          gcs_path: result.gcsPath,
          expires_at: result.expiresAt,
        };
      })
    );

    logger.info({ leadId, count: uploads.length }, "photos.upload_urls_generated");
    return NextResponse.json({ uploads }, { status: 200 });
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Commit — record photos in DB after client PUT to GCS
  // ---------------------------------------------------------------------------
  if (action === "commit") {
    const parse = PhotoCommitReqSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parse.error.flatten() },
        { status: 422 }
      );
    }

    const inserts = parse.data.photos.map((p) => ({
      lead_id: leadId,
      gcs_path: p.gcs_path,
      exif_data: p.exif_data ?? null,
    }));

    const { data: photos, error } = await supabase
      .from("photos")
      .insert(inserts)
      .select();

    if (error || !photos) {
      logger.error({ err: error, leadId }, "photos.commit.error");
      return NextResponse.json({ error: "Failed to record photos" }, { status: 500 });
    }

    logger.info({ leadId, count: photos.length }, "photos.committed");
    return NextResponse.json({ photos }, { status: 201 });
  }

  return NextResponse.json(
    { error: "Invalid action. Use ?action=init or ?action=commit" },
    { status: 400 }
  );
}
