export const dynamic = "force-dynamic";

export async function GET() {
  const upstream = process.env.PRINTER_HLS_URL ?? process.env.PUBLIC_FACTORY_STREAM_URL;
  if (!upstream || upstream.includes("demo.superprint.local")) {
    return new Response("#EXTM3U\n#EXT-X-VERSION:3\n# SuperPrint HLS stream is offline\n", {
      status: 503,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store"
      }
    });
  }

  const response = await fetch(upstream, { cache: "no-store" });
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-store"
    }
  });
}
