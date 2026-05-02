import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || process.env.Secret_key;

let stripeClient;

export function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Missing Stripe secret key. Set STRIPE_SECRET_KEY in your environment.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || "pkr").toLowerCase();

const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

export function toStripeAmount(amount, currency = STRIPE_CURRENCY) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Ticket price must be greater than zero for Stripe Checkout.");
  }

  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? Math.round(numericAmount)
    : Math.round(numericAmount * 100);
}

export function fromStripeAmount(amount, currency = STRIPE_CURRENCY) {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase())
    ? amount
    : amount / 100;
}
