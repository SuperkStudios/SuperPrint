import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { buildModelUploadedPayload, validateStlUploadInput } from "@/domain/uploads";
import { buildLocalStorageKey, resolveLocalStoragePath } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/http";
import { recordPlatformEvent } from "@/services/events";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { estimatePrintFile } from "@/services/slicer-estimates";
import { rateLimitRequest } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimitRequest(request, { key: "model-upload", limit: 30, windowMs: 60 * 60 * 1000 });
  if (limited) return limited;

  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");
  const notes = formData.get("notes");
  const acceptedLegal = formData.get("acceptedLegal");
  if (acceptedLegal !== "true") {
    return NextResponse.json({ error: "You must accept the upload and platform terms before submitting a model." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  try {
    validateStlUploadInput({
      fileName: file.name,
      sizeBytes: file.size,
      contentType: file.type
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid STL upload" }, { status: 400 });
  }

  const storageKey = buildLocalStorageKey("uploads", file.name);
  const localPath = resolveLocalStoragePath(storageKey);
  await mkdir(localPath.slice(0, localPath.lastIndexOf("/")), { recursive: true });
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const checksumSha256 = createHash("sha256").update(fileBuffer).digest("hex");
  const estimates = await estimatePrintFile({
    fileName: file.name,
    contentType: file.type,
    bytes: fileBuffer
  });
  await writeFile(localPath, fileBuffer);

  const upload = await prisma.modelUpload.create({
    data: {
      customerId: session!.user.id,
      fileName: file.name,
      storageKey,
      checksumSha256,
      fileSizeBytes: file.size,
      contentType: file.type || "application/octet-stream",
      notes: typeof notes === "string" ? notes : undefined,
      estimatedGrams: estimates.estimatedGrams,
      estimatedPrintMinutes: estimates.estimatedPrintMinutes,
      status: "PENDING"
    }
  });

  await recordPlatformEvent({
    type: "MODEL_UPLOADED",
    actorId: session!.user.id,
    payload: buildModelUploadedPayload({
      uploadId: upload.id,
      fileName: upload.fileName,
      sizeBytes: upload.fileSizeBytes ?? file.size,
      contentType: upload.contentType ?? file.type,
      checksumSha256,
      storageKey,
      localVolumePath: localPath
    })
  });

  return NextResponse.json({ upload }, { status: 201 });
}
