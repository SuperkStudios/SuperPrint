import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { resolveLocalStoragePath } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { response } = await requireAdmin("orders");
  if (response) return response;

  const { id } = await params;
  const document = await prisma.merchantDocument.findUnique({
    where: { id },
    select: { fileName: true, storageKey: true, contentType: true }
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  try {
    const file = await readFile(resolveLocalStoragePath(document.storageKey));
    return new NextResponse(file, {
      headers: {
        "Content-Type": document.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeHeaderFileName(document.fileName)}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Document file is not available." }, { status: 404 });
  }
}

function safeHeaderFileName(value: string) {
  return value.replace(/["\r\n]/g, "_");
}
