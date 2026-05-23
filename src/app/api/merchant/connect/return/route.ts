import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse(
    "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" /></head><body style=\"font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px\"><h1>Stripe onboarding received</h1><p>Return to the SuperPrint Merchant app and tap Refresh Stripe status.</p></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
