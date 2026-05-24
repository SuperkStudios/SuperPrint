import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const application = url.searchParams.get("application") ?? "";
  const appUrl = `superprint-merchant://stripe-connect/return?application=${encodeURIComponent(application)}`;
  return new NextResponse(
    `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}" />
    <title>Returning to SuperPrint Merchant</title>
    <script>
      window.location.replace(${JSON.stringify(appUrl)});
    </script>
  </head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;line-height:1.35">
    <h1>Stripe onboarding received</h1>
    <p>Returning to the SuperPrint Merchant app to refresh Stripe status.</p>
    <p><a href="${escapeHtml(appUrl)}">Open SuperPrint Merchant</a></p>
  </body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}
