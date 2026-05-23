import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMerchantUser } from "@/lib/merchant-app";
import { buildLocalStorageKey, resolveLocalStoragePath } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { rateLimitRequest } from "@/lib/rate-limit";

const documentTypeSchema = z.enum(["BUSINESS_LICENSE", "TAX_DOCUMENT", "IDENTITY_DOCUMENT", "ADDRESS_VERIFICATION", "OTHER"]);
const allowedDocumentContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);
const allowedDocumentExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

export async function POST(request: Request) {
  const limited = rateLimitRequest(request, { key: "merchant-document-upload", limit: 40, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  const { application, response } = await requireMerchantUser();
  if (response) return response;
  if (!application) return NextResponse.json({ error: "Save the merchant application before uploading documents." }, { status: 400 });

  try {
    const formData = await request.formData();
    const type = documentTypeSchema.parse(formData.get("type"));
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Document file is required." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Document must be 10 MB or smaller." }, { status: 400 });
    const extension = path.extname(file.name).toLowerCase();
    const contentType = file.type || "application/octet-stream";
    if (!allowedDocumentExtensions.has(extension) || (file.type && !allowedDocumentContentTypes.has(file.type))) {
      return NextResponse.json({ error: "Document must be a PDF, JPG, PNG, WEBP, HEIC, or HEIF file." }, { status: 400 });
    }

    const safeName = `${application.id}-${type}-${file.name}`;
    const storageKey = buildLocalStorageKey("merchant-documents", safeName);
    const storagePath = resolveLocalStoragePath(storageKey);
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, Buffer.from(await file.arrayBuffer()), { mode: 0o600 });

    const document = await prisma.merchantDocument.create({
      data: {
        applicationId: application.id,
        type,
        fileName: file.name,
        storageKey,
        contentType,
        fileSizeBytes: file.size
      }
    });
    return NextResponse.json({
      document: {
        id: document.id,
        type: document.type,
        fileName: document.fileName,
        uploadedAt: document.uploadedAt.toISOString()
      }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not upload merchant document." }, { status: 400 });
  }
}
