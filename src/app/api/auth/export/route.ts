import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/supabase-server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// GET /api/auth/export — Export user's personal data
// Requires authenticated JWT; rate-limited 1/hour/user

const hasUpstash =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = hasUpstash
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(1, "60 m"),
      analytics: false,
    })
  : null;

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit check
    const { success } = ratelimit
      ? await ratelimit.limit(`export:${user.id}`)
      : { success: true };
    if (!success) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 1 export per hour." },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    // Get user crew
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("crew_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const crewId = userData.crew_id;

    // Fetch all user's data
    const [crewData, leadsData, quotesData, acceptanceData, jobsData, fsmData] =
      await Promise.all([
        supabase.from("crews").select("*").eq("id", crewId).single(),
        supabase
          .from("leads")
          .select("*")
          .eq("crew_id", crewId)
          .order("created_at", { ascending: false }),
        supabase
          .from("quotes")
          .select(
            "*, quote_line_items(*), quote_ai_usage(*), sms_events(*)"
          )
          .eq("crew_id", crewId)
          .order("created_at", { ascending: false }),
        supabase
          .from("quote_acceptance")
          .select("*")
          .eq("crew_id", crewId)
          .order("accepted_at", { ascending: false }),
        supabase
          .from("job_completion")
          .select("*")
          .eq("crew_id", crewId)
          .order("completed_at", { ascending: false }),
        supabase
          .from("fsm_connection")
          .select("provider, created_at, expires_at")
          .eq("crew_id", crewId),
      ]);

    // Construct export object (sanitized, no encryption keys)
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email || null,
        phone: user.phone || null,
        created_at: user.created_at,
      },
      crew: crewData.data ? crewData.data : null,
      leads: leadsData.data || [],
      quotes: quotesData.data || [],
      quoteAcceptances: acceptanceData.data || [],
      jobCompletions: jobsData.data || [],
      fsmConnections: fsmData.data || [],
      note: "This export contains your personal data in QuotingAgent. Photos are not included; use /api/leads/{id}/photos?export=true for photo URLs.",
    };

    // Return as JSON download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="quotingagent-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err) {
    console.error("Error in GET /api/auth/export:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
