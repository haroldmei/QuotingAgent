/**
 * Lead Zod schemas
 * Stack contract: backend.validators=zod
 * FR-006 (DA webhook), FR-007 (manual lead), FR-004/FR-005 (list/detail/patch)
 */

import { z } from "zod";

// E.164 AU mobile — reused from auth schemas
export const AuMobileE164 = z
  .string()
  .regex(/^\+614\d{8}$/, "Must be an Australian mobile number in E.164 format (+614XXXXXXXX)");

// ---------------------------------------------------------------------------
// Manual lead creation — FR-007
// ---------------------------------------------------------------------------
export const ManualLeadReqSchema = z.object({
  customer_name: z.string().min(1).max(128).trim(),
  customer_mobile: AuMobileE164.optional(),
  customer_email: z.string().email().max(256).optional(),
  address: z.string().max(512).optional(),
  description: z.string().max(280).optional(),
});

export type ManualLeadReq = z.infer<typeof ManualLeadReqSchema>;

// ---------------------------------------------------------------------------
// Lead PATCH — FR-005
// ---------------------------------------------------------------------------
export const LeadPatchReqSchema = z
  .object({
    status: z
      .enum(["new", "generating", "draft_ready", "sent", "delivered", "opened", "won", "lost"])
      .optional(),
    description: z.string().max(280).optional(),
    sms_disabled_followup: z.boolean().optional(),
    customer_name: z.string().min(1).max(128).trim().optional(),
    customer_mobile: AuMobileE164.optional(),
    customer_email: z.string().email().max(256).optional(),
    address: z.string().max(512).optional(),
  })
  .strict();

export type LeadPatchReq = z.infer<typeof LeadPatchReqSchema>;

// ---------------------------------------------------------------------------
// Lead list query — FR-004
// ---------------------------------------------------------------------------
export const LeadListQuerySchema = z.object({
  cursor: z.string().optional(), // ISO timestamp for keyset pagination
  status: z
    .enum(["new", "generating", "draft_ready", "sent", "delivered", "opened", "won", "lost"])
    .optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default("20"),
});

export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;

// ---------------------------------------------------------------------------
// DA webhook — FR-006
// ---------------------------------------------------------------------------
export const DaWebhookReqSchema = z.object({
  da_reference: z.string().min(1).max(128),
  address: z.string().min(1).max(512),
  description: z.string().max(1024).optional(),
  council: z.string().max(128).optional(),
  received_at: z.string().datetime().optional(),
  // DA aggregator may include customer contact — optional
  customer_name: z.string().max(128).optional(),
  customer_mobile: AuMobileE164.optional(),
});

export type DaWebhookReq = z.infer<typeof DaWebhookReqSchema>;

// ---------------------------------------------------------------------------
// Job completion — FR-029
// ---------------------------------------------------------------------------
export const JobCompletionReqSchema = z.object({
  invoiced_amount_aud: z.number().nonnegative().optional(),
});

export type JobCompletionReq = z.infer<typeof JobCompletionReqSchema>;
