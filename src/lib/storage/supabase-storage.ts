/**
 * Photo storage on Supabase Storage.
 *
 * Replaces the original GCS path (src/lib/gcs/client.ts) — the deployed
 * environment authenticates with Supabase, not GCP, so signed PUT URLs go
 * through Supabase Storage instead. Same API surface (`generatePhotoSignedPutUrl`,
 * `generatePhotoSignedReadUrl`) so the route code is a one-line import swap.
 *
 * Bucket "lead-photos" is created idempotently by `scripts/setup-storage-buckets.sh`.
 */

import { createServiceClient } from "@/lib/db/supabase-server";
import { logger } from "@/lib/logger";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "lead-photos";
const SIGNED_READ_EXPIRY = 30 * 24 * 60 * 60; // 30 days, matches the old GCS contract

export interface SignedPutResult {
  signedUrl: string;
  /**
   * Storage object path. Kept under the legacy column name `gcs_path` in the
   * `photos` table for backward compatibility with existing rows.
   */
  gcsPath: string;
  expiresAt: string;
}

function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/heic":
      return "heic";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

/**
 * Returns a one-shot signed PUT URL the browser uploads the photo to directly.
 * Service-role auth — RLS bypass — but the URL itself is single-use and
 * expires in ~2 hours (Supabase Storage default).
 */
export async function generatePhotoSignedPutUrl(
  leadId: string,
  index: number,
  mimeType: string
): Promise<SignedPutResult> {
  const ext = mimeToExt(mimeType);
  const path = `photos/${leadId}/${index}_${Date.now()}.${ext}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    logger.error({ err: error, leadId, path }, "supabase_storage.signed_put_url.error");
    throw new Error(`Failed to create signed upload URL: ${error?.message ?? "unknown"}`);
  }

  return {
    signedUrl: data.signedUrl,
    gcsPath: path,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Returns a signed GET URL for the browser to display a photo.
 * 30-day expiry per the original FR-016 contract.
 */
export async function generatePhotoSignedReadUrl(path: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_READ_EXPIRY);

  if (error || !data) {
    logger.error({ err: error, path }, "supabase_storage.signed_read_url.error");
    throw new Error(`Failed to create signed read URL: ${error?.message ?? "unknown"}`);
  }
  return data.signedUrl;
}
