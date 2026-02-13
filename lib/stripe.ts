import Stripe from "stripe";

export type BillingPlan = "pro" | "unlimited";
export type BillingInterval = "monthly" | "annual";

export function getStripeServer() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");

  return new Stripe(key, {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  });
}

export const PRICE_IDS = {
  proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || "",
  proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL || "",
  unlimitedMonthly: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY || "",
  unlimitedAnnual: process.env.STRIPE_PRICE_UNLIMITED_ANNUAL || "",
};

export function getPlanAndIntervalFromPriceId(priceId: string | null | undefined): { plan: BillingPlan; interval: BillingInterval } | null {
  if (!priceId) return null;
  if (priceId === PRICE_IDS.proMonthly) return { plan: "pro", interval: "monthly" };
  if (priceId === PRICE_IDS.proAnnual) return { plan: "pro", interval: "annual" };
  if (priceId === PRICE_IDS.unlimitedMonthly) return { plan: "unlimited", interval: "monthly" };
  if (priceId === PRICE_IDS.unlimitedAnnual) return { plan: "unlimited", interval: "annual" };
  return null;
}

export function getPriceForSelection(plan: BillingPlan, interval: BillingInterval): string {
  if (plan === "pro") return interval === "annual" ? PRICE_IDS.proAnnual : PRICE_IDS.proMonthly;
  return interval === "annual" ? PRICE_IDS.unlimitedAnnual : PRICE_IDS.unlimitedMonthly;
}

export function isStripeReady() {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_PRO_MONTHLY &&
      process.env.STRIPE_PRICE_PRO_ANNUAL &&
      process.env.STRIPE_PRICE_UNLIMITED_MONTHLY &&
      process.env.STRIPE_PRICE_UNLIMITED_ANNUAL &&
      process.env.NEXT_PUBLIC_APP_URL,
  );
}
