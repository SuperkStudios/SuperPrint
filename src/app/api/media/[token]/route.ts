import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { readMediaToken } from "@/lib/media-token";
import { resolveLocalStoragePath } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const payload = readMediaToken(token);
    const localPath = resolveLocalStoragePath(payload.key);
    const file = await readFile(localPath);
    return new Response(file, {
      headers: {
        "Content-Type": contentTypeFor(payload.key),
        "Content-Disposition": `inline; filename="${payload.key.split("/").at(-1)}"`,
        "Cache-Control": "private, max-age=60"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Media unavailable" }, { status: 404 });
  }
}

function contentTypeFor(key: string) {
  if (key.endsWith(".svg")) return "image/svg+xml";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}
