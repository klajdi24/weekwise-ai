import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";

const FREE_LIMIT = 3;

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_premium, ai_usage_count")
      .eq("id", userRes.user.id)
      .maybeSingle();

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const isPremium = !!profile?.is_premium;
    const used = Number(profile?.ai_usage_count ?? 0);
    const remaining = Math.max(0, FREE_LIMIT - used);

    return NextResponse.json({
      isPremium,
      freeLimit: FREE_LIMIT,
      used,
      remaining,
      canUseAi: isPremium || remaining > 0,
      planLabel: isPremium ? "Premium" : "Free",
      cta: isPremium ? "Manage subscription" : "Upgrade for unlimited AI features",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load subscription status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
