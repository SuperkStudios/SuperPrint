export function buildPrinterHeartbeatUpdate(input: {
  ok: boolean;
  message: string;
  checkedAt: Date;
  latencyMs: number;
}) {
  if (input.ok) {
    return {
      heartbeatStatus: "ONLINE" as const,
      status: "HEALTHY" as const,
      lastHeartbeatAt: input.checkedAt,
      heartbeatLatencyMs: input.latencyMs,
      healthDescription: "Online. Printer endpoint reachable."
    };
  }

  return {
    heartbeatStatus: "OFFLINE" as const,
    status: "OFFLINE" as const,
    lastHeartbeatAt: input.checkedAt,
    heartbeatLatencyMs: input.latencyMs,
    healthDescription: "Offline. Printer endpoint is not reachable."
  };
}

export function getCentauriMjpegUrl(input: { internalIp: string; cameraSource?: string | null }) {
  return input.cameraSource?.trim() || `http://${input.internalIp}:3031/video`;
}

export function buildCentauriVideoEnableRequest(mainboardId = "0000000000000000", requestId = crypto.randomUUID(), timestamp = Math.floor(Date.now() / 1000)) {
  return {
    Id: requestId,
    Data: {
      Cmd: 386,
      Data: { Enable: 1 },
      RequestID: requestId,
      MainboardID: mainboardId,
      TimeStamp: timestamp,
      From: 0
    },
    Topic: `sdcp/request/${mainboardId}`
  };
}
