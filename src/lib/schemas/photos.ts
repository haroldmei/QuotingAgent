/**
 * Photo upload Zod schemas
 * Stack contract: backend.validators=zod, cloud.blob_storage=gcs
 * FR-008 (camera capture), FR-009 (gallery upload)
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Photo upload init — request signed PUT URLs from GCS
// ---------------------------------------------------------------------------
export const PhotoUploadInitReqSchema = z.object({
  count: z.number().int().min(1).max(15),
  mime_types: z
    .array(z.enum(["image/jpeg", "image/png", "image/heic", "image/webp"]))
    .min(1)
    .max(15),
});

export type PhotoUploadInitReq = z.infer<typeof PhotoUploadInitReqSchema>;

export const PhotoUploadInitResSchema = z.object({
  uploads: z.array(
    z.object({
      index: z.number(),
      signed_url: z.string().url(),
      gcs_path: z.string(),
      expires_at: z.string().datetime(),
    })
  ),
});

export type PhotoUploadInitRes = z.infer<typeof PhotoUploadInitResSchema>;

// ---------------------------------------------------------------------------
// Photo commit — after client PUT to GCS, commit metadata to DB
// ---------------------------------------------------------------------------
export const PhotoCommitReqSchema = z.object({
  photos: z
    .array(
      z.object({
        gcs_path: z.string().min(1),
        exif_data: z
          .object({
            lat: z.number().optional(),
            lng: z.number().optional(),
            timestamp: z.string().optional(),
            device: z.string().optional(),
          })
          .optional(),
      })
    )
    .min(1)
    .max(15),
});

export type PhotoCommitReq = z.infer<typeof PhotoCommitReqSchema>;
