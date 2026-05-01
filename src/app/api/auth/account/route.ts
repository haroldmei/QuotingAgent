import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/db/supabase-server";
import { z } from "zod";

// DELETE /api/auth/account — Soft-delete user account
// Requires authenticated JWT

const DeleteAccountReq = z.object({
  confirmDelete: z.literal(true, {
    errorMap: () => ({
      message: "You must confirm account deletion by setting confirmDelete: true",
    }),
  }),
});

type DeleteAccountReq = z.infer<typeof DeleteAccountReq>;

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = DeleteAccountReq.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const adminSupabase = createServiceClient();

    // Soft-delete: set deleted_at timestamp (column added by 20260501000006_soft_delete migration; types regen pending).
    const { error: deleteError } = await (adminSupabase
      .from("users") as unknown as { update: (v: Record<string, string>) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> } })
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", user.id);

    if (deleteError) {
      console.error("Failed to soft-delete user:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    // Sign out user
    await supabase.auth.signOut();

    return NextResponse.json(
      {
        message:
          "Account deleted. Your data will be permanently removed after 30 days. Contact support@quotingagent.io if you wish to recover your account.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Error in DELETE /api/auth/account:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
