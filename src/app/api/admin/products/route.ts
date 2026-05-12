import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { z } from "zod";
import { requireAdmin } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildLocalStorageKey, resolveLocalStoragePath } from "@/lib/storage";
import { upsertProduct } from "@/services/products";

const schema = z.object({
  id: z.string().optional(),
  name: z.string(),
  slug: z.string().optional(),
  description: z.string(),
  imageUrl: z.string().optional(),
  imageStorageKey: z.string().optional(),
  productFileStorageKey: z.string().optional(),
  priceCents: z.number(),
  estimatedPrintMinutes: z.number(),
  estimatedGrams: z.number(),
  materialCostCents: z.number().optional(),
  defaultMaterial: z.enum(["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"]),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE")
});

export async function POST(request: Request) {
  const { session, response } = await requireAdmin();
  if (response) return response;
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await readProductRequest(request));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid product input" }, { status: 400 });
  }
  if (body.id && !body.imageUrl && !body.imageStorageKey) {
    const existing = await prisma.product.findUnique({ where: { id: body.id } });
    body.imageUrl = existing?.imageUrl;
    body.imageStorageKey = existing?.imageStorageKey ?? undefined;
    body.productFileStorageKey = body.productFileStorageKey ?? existing?.productFileStorageKey ?? undefined;
  }
  if (!body.imageUrl && !body.imageStorageKey) {
    return NextResponse.json({ error: "Product image URL or uploaded image is required" }, { status: 400 });
  }
  return NextResponse.json({ product: await upsertProduct({ ...body, imageUrl: body.imageUrl ?? "__LOCAL_IMAGE__" }, session!.user.id) });
}

async function readProductRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) return request.json();

  const formData = await request.formData();
  const imageFile = formData.get("imageFile");
  const printFile = formData.get("printFile");
  const imageStorageKey = imageFile instanceof File && imageFile.size > 0 ? await storeProductFile(imageFile, "thumbnails", ["image/png", "image/jpeg", "image/webp"]) : undefined;
  const productFileStorageKey = printFile instanceof File && printFile.size > 0 ? await storeProductFile(printFile, "uploads", ["model/stl", "application/octet-stream", "text/plain", ""]) : undefined;

  const imageUrl = String(formData.get("imageUrl") ?? "").trim();
  return {
    id: stringValue(formData.get("id")),
    name: String(formData.get("name") ?? ""),
    slug: stringValue(formData.get("slug")),
    description: String(formData.get("description") ?? ""),
    imageUrl: imageStorageKey ? "__LOCAL_IMAGE__" : imageUrl,
    imageStorageKey,
    productFileStorageKey,
    priceCents: Number(formData.get("priceCents") ?? 0),
    estimatedPrintMinutes: Number(formData.get("estimatedPrintMinutes") ?? 0),
    estimatedGrams: Number(formData.get("estimatedGrams") ?? 0),
    materialCostCents: Number(formData.get("materialCostCents") ?? 0),
    defaultMaterial: String(formData.get("defaultMaterial") ?? "PLA"),
    status: String(formData.get("status") ?? "ACTIVE")
  };
}

function stringValue(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : undefined;
}

async function storeProductFile(file: File, storageClass: "uploads" | "thumbnails", acceptedTypes: string[]) {
  if (file.name.includes("/") || file.name.includes("\\") || file.name.includes("..")) {
    throw new Error("Unsafe product file name");
  }
  if (!acceptedTypes.includes((file.type ?? "").toLowerCase())) {
    throw new Error("Unsupported product file type");
  }
  if (storageClass === "uploads" && !/\.(stl|gcode|3mf)$/i.test(file.name)) {
    throw new Error("Product print file must be STL, G-code, or 3MF");
  }
  if (storageClass === "thumbnails" && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    throw new Error("Product image must be PNG, JPEG, or WebP");
  }
  const key = buildLocalStorageKey(storageClass, `${createHash("sha256").update(file.name).digest("hex").slice(0, 10)}-${file.name}`);
  const localPath = resolveLocalStoragePath(key);
  await mkdir(localPath.slice(0, localPath.lastIndexOf("/")), { recursive: true });
  await writeFile(localPath, Buffer.from(await file.arrayBuffer()));
  return key;
}
