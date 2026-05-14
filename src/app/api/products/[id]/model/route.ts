import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLocalStoragePath } from "@/lib/storage";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { productFileStorageKey: true } });
  if (!product?.productFileStorageKey || !/\.stl$/i.test(product.productFileStorageKey)) {
    return NextResponse.json({ error: "Product STL not found" }, { status: 404 });
  }

  let file: Uint8Array;
  try {
    file = await readFile(resolveLocalStoragePath(product.productFileStorageKey));
  } catch (error) {
    if (isMissingFileError(error)) {
      return NextResponse.json({ error: "Product STL not found" }, { status: 404 });
    }
    throw error;
  }

  const body = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "content-type": "model/stl",
      "cache-control": "public, max-age=300"
    }
  });
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
