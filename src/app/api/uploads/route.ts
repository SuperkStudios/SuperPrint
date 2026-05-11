import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { buildModelUploadedPayload, validateStlUploadInput } from "@/domain/uploads";
import { buildLocalStorageKey, resolveLocalStoragePath } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/http";
import { recordPlatformEvent } from "@/services/events";
import { getBootstrapStatus } from "@/lib/bootstrap";

export async function POST(request: Request) {
  if (!(await getBootstrapStatus()).isComplete) {
    return NextResponse.json({ error: "Setup required" }, { status: 503 });
  }
  const { session, response } = await requireCustomer();
  if (response) return response;

  const formData = await request.formData();
  const file = formData.get("file");
  const notes = formData.get("notes");
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
  await writeFile(localPath, Buffer.from(await file.arrayBuffer()));

  const upload = await prisma.modelUpload.create({
    data: {
      customerId: session!.user.id,
      fileName: file.name,
      storageKey,
      fileSizeBytes: file.size,
      contentType: file.type || "application/octet-stream",
      notes: typeof notes === "string" ? notes : undefined,
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
      storageKey,
      localVolumePath: localPath
    })
  });

  return NextResponse.json({ upload }, { status: 201 });
}
