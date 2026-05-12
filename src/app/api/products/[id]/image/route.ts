import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLocalStoragePath } from "@/lib/storage";

const contentTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { imageStorageKey: true } });
  if (!product?.imageStorageKey) {
    return NextResponse.json({ error: "Product image not found" }, { status: 404 });
  }
  const localPath = resolveLocalStoragePath(product.imageStorageKey);
  const extension = localPath.split(".").pop()?.toLowerCase() ?? "";
  const file = await readFile(localPath);
  return new NextResponse(file, {
    headers: {
      "content-type": contentTypes[extension] ?? "application/octet-stream",
      "cache-control": "public, max-age=300"
    }
  });
}
