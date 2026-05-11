export type StoredObject = {
  key: string;
  url: string;
};

export async function createUploadTarget(fileName: string): Promise<StoredObject> {
  // TODO: Replace demo key generation with S3-compatible multipart upload signing.
  return {
    key: `uploads/pending/${Date.now()}-${fileName}`,
    url: `/api/uploads/mock-target?file=${encodeURIComponent(fileName)}`
  };
}

export async function attachOrderVideo(orderNumber: string): Promise<StoredObject> {
  // TODO: Replace demo playback URL with S3/CloudFront-compatible signed delivery.
  return {
    key: `videos/${orderNumber}.mp4`,
    url: `https://demo.superprint.local/videos/${orderNumber}.mp4`
  };
}
