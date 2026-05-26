import path from "node:path";

export type StoredObject = {
  key: string;
  url: string;
  path: string;
};

export const storageClasses = [
  "uploads",
  "sliced",
  "videos",
  "timelapses",
  "thumbnails",
  "logs",
  "backup-staging"
] as const;

export type StorageClass = (typeof storageClasses)[number];

const storageClassSet = new Set<string>(storageClasses);

export function getDataRoot() {
  return process.env.SUPERPRINT_DATA_ROOT ?? "/data";
}

export function buildLocalStorageKey(storageClass: StorageClass, fileName: string, timestamp = Date.now()) {
  const safeName = path.basename(fileName).trim().replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${storageClass}/${timestamp}-${safeName}`;
}

export function resolveLocalStoragePath(key: string, dataRoot = getDataRoot()) {
  const parts = key.split("/");
  const storageClass = parts[0];

  if (!storageClassSet.has(storageClass)) {
    throw new Error("Unknown storage class");
  }

  if (parts.some((part) => part === ".." || part === "")) {
    throw new Error("Invalid storage key");
  }

  const resolved = path.resolve(dataRoot, key);
  const root = path.resolve(dataRoot, storageClass);
  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
    throw new Error("Invalid storage key");
  }

  return resolved;
}

export async function createUploadTarget(fileName: string): Promise<StoredObject> {
  const key = buildLocalStorageKey("uploads", fileName);
  return {
    key,
    path: resolveLocalStoragePath(key),
    url: `/api/uploads/local-target?file=${encodeURIComponent(fileName)}`
  };
}

export async function attachOrderVideo(orderNumber: string): Promise<StoredObject> {
  const key = `videos/${orderNumber}.mp4`;
  return {
    key,
    path: resolveLocalStoragePath(key),
    url: `/media/${key}`
  };
}
