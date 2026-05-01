/**
 * GCS client helper
 * Stack contract: cloud.blob_storage=gcs, cloud.provider=gcp
 * PROJECT_ID=sunlit-core-205604, bucket=australia-southeast1 (STACK_GAP-004)
 *
 * Generates signed PUT URLs for photo uploads (EXIF preserved in GCS object metadata)
 * and signed GET URLs for PDF delivery (≤ 30 days expiry per FR-016).
 */

import { Storage } from "@google-cloud/storage";
import { logger } from "@/lib/logger";

const BUCKET_NAME = process.env.GCS_BUCKET_NAME ?? "quotingagent-photos";
const PDF_BUCKET_NAME = process.env.GCS_PDF_BUCKET_NAME ?? process.env.GCS_BUCKET_NAME ?? "quotingagent-photos";
const SIGNED_URL_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days
const UPLOAD_URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes for the PUT

let _storage: Storage | null = null;

function getStorage(): Storage {
  if (_storage) return _storage;
  _storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID ?? "sunlit-core-205604",
    // In Cloud Run: uses workload identity; locally: uses GOOGLE_APPLICATION_CREDENTIALS
  });
  return _storage;
}

export interface SignedPutResult {
  signedUrl: string;
  gcsPath: string;
  expiresAt: string; // ISO 8601
}

/**
 * Generate a signed PUT URL for a photo upload.
 * The object is created in GCS when the client PUTs to this URL.
 * EXIF is preserved because we do not process/transcode the image.
 */
export async function generatePhotoUploadUrl(
  leadId: string,
  index: number,
  mimeType: string
): Promise<SignedPutResult> {
  const extension = mimeToExt(mimeType);
  const gcsPath = `photos/${leadId}/${index}_${Date.now()}.${extension}`;
  const storage = getStorage();
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(gcsPath);

  const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRY_SECONDS * 1000);

  const [signedUrl] = await file.generateSignedPostPolicyV4({
    expires: expiresAt,
    conditions: [
      ["content-type", mimeType],
      ["content-length-range", 0, 20 * 1024 * 1024], // max 20MB per photo
    ],
    fields: {
      "Content-Type": mimeType,
      "x-goog-meta-lead-id": leadId,
    },
  });

  logger.info({ gcsPath, leadId }, "gcs.photo.upload_url_generated");

  return {
    signedUrl: signedUrl.url,
    gcsPath,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Generate a signed PUT URL using V4 signed URL (for direct client upload).
 */
export async function generatePhotoSignedPutUrl(
  leadId: string,
  index: number,
  mimeType: string
): Promise<SignedPutResult> {
  const extension = mimeToExt(mimeType);
  const gcsPath = `photos/${leadId}/${index}_${Date.now()}.${extension}`;
  const storage = getStorage();
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(gcsPath);

  const expiresAt = new Date(Date.now() + UPLOAD_URL_EXPIRY_SECONDS * 1000);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAt,
    contentType: mimeType,
    extensionHeaders: {
      "x-goog-meta-lead-id": leadId,
    },
  });

  return {
    signedUrl,
    gcsPath,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Generate a signed GET URL for reading a GCS object.
 * Used for photo access by the AI worker and PDF delivery to customers.
 */
export async function generateSignedGetUrl(
  gcsPath: string,
  expirySeconds: number = SIGNED_URL_EXPIRY_SECONDS,
  bucketName: string = BUCKET_NAME
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(gcsPath);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: new Date(Date.now() + expirySeconds * 1000),
  });

  return signedUrl;
}

/**
 * Upload a Buffer/Uint8Array directly to GCS (used for PDFs generated server-side).
 * Returns the GCS path.
 */
export async function uploadBuffer(
  data: Buffer | Uint8Array,
  gcsPath: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const storage = getStorage();
  const bucket = storage.bucket(PDF_BUCKET_NAME);
  const file = bucket.file(gcsPath);

  await file.save(Buffer.isBuffer(data) ? data : Buffer.from(data), {
    contentType,
    metadata: {
      metadata: metadata ?? {},
    },
    resumable: false,
  });

  logger.info({ gcsPath, contentType }, "gcs.upload.complete");
  return gcsPath;
}

/**
 * Generate a signed URL for the PDF bucket specifically.
 */
export async function generatePdfSignedUrl(gcsPath: string): Promise<{
  signedUrl: string;
  expiresAt: string;
}> {
  const url = await generateSignedGetUrl(gcsPath, SIGNED_URL_EXPIRY_SECONDS, PDF_BUCKET_NAME);
  return {
    signedUrl: url,
    expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY_SECONDS * 1000).toISOString(),
  };
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/webp": "webp",
  };
  return map[mime] ?? "jpg";
}
