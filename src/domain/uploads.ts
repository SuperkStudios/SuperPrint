export const maxStlUploadBytes = 150 * 1024 * 1024;

const acceptedContentTypes = new Set([
  "model/stl",
  "model/x.stl-ascii",
  "model/x.stl-binary",
  "application/sla",
  "application/vnd.ms-pki.stl",
  "application/octet-stream",
  "application/x-binary",
  ""
]);

export type StlUploadInput = {
  fileName: string;
  sizeBytes: number;
  contentType: string;
};

export function validateStlUploadInput(input: StlUploadInput): StlUploadInput {
  if (input.fileName.includes("/") || input.fileName.includes("\\") || input.fileName.includes("..")) {
    throw new Error("Unsafe file name");
  }

  if (!input.fileName.toLowerCase().endsWith(".stl")) {
    throw new Error("Only .stl files are supported");
  }

  if (input.sizeBytes <= 0) {
    throw new Error("STL upload is empty");
  }

  if (input.sizeBytes > maxStlUploadBytes) {
    throw new Error(`STL upload exceeds ${maxStlUploadBytes} bytes`);
  }

  if (!acceptedContentTypes.has(input.contentType.toLowerCase())) {
    throw new Error("Unsupported STL MIME type");
  }

  return input;
}

export function buildModelUploadedPayload(input: {
  uploadId: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  storageKey: string;
  localVolumePath: string;
}) {
  return {
    uploadId: input.uploadId,
    fileName: input.fileName,
    sizeBytes: input.sizeBytes,
    contentType: input.contentType,
    localVolumeKey: input.storageKey,
    localVolumePath: input.localVolumePath
  };
}

export function buildModelReviewPayload(input: {
  uploadId: string;
  fileName: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
}) {
  return {
    uploadId: input.uploadId,
    fileName: input.fileName,
    status: input.status,
    ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {})
  };
}
