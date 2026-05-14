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

  const file = await readFile(resolveLocalStoragePath(product.productFileStorageKey));
  return new NextResponse(file, {
    headers: {
      "content-type": "model/stl",
      "cache-control": "public, max-age=300"
    }
  });
}
