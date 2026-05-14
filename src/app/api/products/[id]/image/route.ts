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
  const product = await prisma.product.findUnique({ where: { id }, select: { imageStorageKey: true, name: true, productFileStorageKey: true } });
  if (!product?.imageStorageKey) {
    if (product?.productFileStorageKey) {
      return new NextResponse(fallbackSvg(product.name), {
        headers: {
          "content-type": "image/svg+xml",
          "cache-control": "public, max-age=300"
        }
      });
    }
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

function fallbackSvg(name: string) {
  const safeName = name.replace(/[<>&"]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f8fafc"/><circle cx="600" cy="360" r="170" fill="#dbeafe"/><path d="M420 430h360l-58 90H478z" fill="#0f172a" opacity=".16"/><path d="M450 385l150-95 150 95-150 95z" fill="#2563eb"/><path d="M450 385v130l150 95V480z" fill="#1d4ed8"/><path d="M750 385v130l-150 95V480z" fill="#38bdf8"/><text x="600" y="705" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700" fill="#0f172a">${safeName}</text></svg>`;
}
