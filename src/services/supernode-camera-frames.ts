type CameraFrame = {
  printerId: string;
  nodeId: string;
  frame: Uint8Array;
  contentType: string;
  receivedAt: Date;
};

const CAMERA_FRAME_TTL_MS = 10_000;
const CAMERA_STREAM_BOUNDARY = "superprint-frame";

function getFrameStore() {
  const globalState = globalThis as typeof globalThis & { __superprintCameraFrames?: Map<string, CameraFrame> };
  globalState.__superprintCameraFrames ??= new Map();
  return globalState.__superprintCameraFrames;
}

export function saveSuperNodeCameraFrame(input: {
  printerId: string;
  nodeId: string;
  frame: Uint8Array;
  contentType?: string | null;
  receivedAt?: Date;
}) {
  const frame = {
    printerId: input.printerId,
    nodeId: input.nodeId,
    frame: input.frame,
    contentType: input.contentType?.trim() || "image/jpeg",
    receivedAt: input.receivedAt ?? new Date()
  };
  getFrameStore().set(input.printerId, frame);
  return frame;
}

export function getRecentSuperNodeCameraFrame(printerId: string, now = Date.now()) {
  const frame = getFrameStore().get(printerId);
  if (!frame || now - frame.receivedAt.getTime() > CAMERA_FRAME_TTL_MS) return null;
  return frame;
}

export function createSuperNodeCameraFrameStream(printerId: string) {
  let interval: ReturnType<typeof setInterval> | null = null;
  let lastSentAt = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = () => {
        const frame = getRecentSuperNodeCameraFrame(printerId);
        if (!frame || frame.receivedAt.getTime() === lastSentAt) return;
        lastSentAt = frame.receivedAt.getTime();
        controller.enqueue(encodeFrameHeader(frame.contentType, frame.frame.byteLength));
        controller.enqueue(frame.frame);
        controller.enqueue(new TextEncoder().encode("\r\n"));
      };

      send();
      interval = setInterval(send, 50);
    },
    cancel() {
      if (interval) clearInterval(interval);
    }
  });

  return {
    stream,
    contentType: `multipart/x-mixed-replace; boundary=${CAMERA_STREAM_BOUNDARY}`
  };
}

function encodeFrameHeader(contentType: string, contentLength: number) {
  return new TextEncoder().encode(
    `--${CAMERA_STREAM_BOUNDARY}\r\nContent-Type: ${contentType}\r\nContent-Length: ${contentLength}\r\n\r\n`
  );
}
