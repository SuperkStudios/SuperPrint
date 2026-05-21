import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLocalStoragePath } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; partId: string }> }) {
  const { id, partId } = await params;
  const part = await prisma.productPart.findFirst({
    where: { id: partId, productId: id },
    select: { fileStorageKey: true }
  });
  if (!part?.fileStorageKey || !/\.(stl|3mf)$/i.test(part.fileStorageKey)) {
    return NextResponse.json({ error: "Product part model not found" }, { status: 404 });
  }

  let file: Uint8Array;
  try {
    file = await readFile(resolveLocalStoragePath(part.fileStorageKey));
  } catch (error) {
    if (isMissingFileError(error)) {
      return NextResponse.json({ error: "Product part model not found" }, { status: 404 });
    }
    throw error;
  }

  const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "content-type": /\.3mf$/i.test(part.fileStorageKey) ? "model/3mf" : "model/stl",
      "cache-control": "public, max-age=300"
    }
  });
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
