/**
 * GET   /api/crew/[id] — fetch the caller's own crew profile (FR-002)
 * PATCH /api/crew/[id] — update business_name, default_labour_rate_aud, abn
 *
 * RLS-scoped: the {id} must match auth.crew_id() — no cross-tenant peek.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAuth, isAuthError } from "@/lib/auth/guard";
import { createServerClient } from "@/lib/db/supabase-server";
import { z } from "zod";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  business_name: z.string().min(2).max(128).optional(),
  default_labour_rate_aud: z.number().positive().max(1000).optional(),
  abn: z
    .string()
    .regex(/^\d{11}$/, "ABN must be 11 digits")
    .optional()
    .or(z.literal("")),
});

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id } = await params;

  if (id !== crewId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createServerClient();
  const { data: crew, error } = await supabase
    .from("crews")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !crew) {
    return NextResponse.json({ error: "Crew not found" }, { status: 404 });
  }

  return NextResponse.json(crew);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await resolveAuth(req);
  if (isAuthError(auth)) return auth.error;
  const { crewId } = auth.ctx;
  const { id } = await params;

  if (id !== crewId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = PatchSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parse.error.flatten() },
      { status: 422 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parse.data.business_name !== undefined)
    updates.business_name = parse.data.business_name;
  if (parse.data.default_labour_rate_aud !== undefined)
    updates.default_labour_rate_aud = parse.data.default_labour_rate_aud;
  if (parse.data.abn !== undefined && parse.data.abn !== "")
    updates.abn = parse.data.abn;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const supabase = await createServerClient();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: crew, error } = await (supabase
    .from("crews") as any)
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (error) {
    logger.error({ err: error, crewId }, "crew.patch.error");
    return NextResponse.json({ error: "Failed to update crew" }, { status: 500 });
  }

  return NextResponse.json(crew);
}
