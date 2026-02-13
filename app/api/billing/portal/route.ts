import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { getStripeServer } from "@/lib/stripe";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = userRes.user;
    const stripe = getStripeServer();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return NextResponse.json({ error: "Missing NEXT_PUBLIC_APP_URL" }, { status: 503 });

    const customers = await stripe.customers.list({ email: user.email ?? undefined, limit: 1 });
    const customer = customers.data[0];
    if (!customer?.id) return NextResponse.json({ error: "No billing profile found yet." }, { status: 404 });

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create billing portal session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
