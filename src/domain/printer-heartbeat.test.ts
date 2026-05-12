import { describe, expect, it } from "vitest";
import { buildCentauriVideoEnableRequest, buildPrinterHeartbeatUpdate, getCentauriMjpegUrl } from "./printer-heartbeat";

describe("printer heartbeat", () => {
  it("marks reachable printers online with a simple operator-safe status", () => {
    expect(
      buildPrinterHeartbeatUpdate({
        ok: true,
        message: "Printer SDCP WebSocket endpoint accepted a connection.",
        checkedAt: new Date("2026-05-12T13:00:00.000Z"),
        latencyMs: 42
      })
    ).toEqual({
      heartbeatStatus: "ONLINE",
      status: "HEALTHY",
      lastHeartbeatAt: new Date("2026-05-12T13:00:00.000Z"),
      heartbeatLatencyMs: 42,
      healthDescription: "Online. Printer endpoint reachable."
    });
  });

  it("marks unreachable printers offline with no private endpoint in the summary", () => {
    expect(
      buildPrinterHeartbeatUpdate({
        ok: false,
        message: "Could not reach printer endpoint: ws://192.168.10.125:3030/websocket failed",
        checkedAt: new Date("2026-05-12T13:00:00.000Z"),
        latencyMs: 1200
      })
    ).toMatchObject({
      heartbeatStatus: "OFFLINE",
      status: "OFFLINE",
      healthDescription: "Offline. Printer endpoint is not reachable."
    });
  });

  it("builds the Centauri MJPEG URL without exposing it through public UI", () => {
    expect(getCentauriMjpegUrl({ internalIp: "192.168.10.125", cameraSource: null })).toBe("http://192.168.10.125:3031/video");
    expect(getCentauriMjpegUrl({ internalIp: "192.168.10.125", cameraSource: "http://camera.local/video" })).toBe("http://camera.local/video");
  });

  it("builds the Centauri SDCP video enable request", () => {
    const request = buildCentauriVideoEnableRequest("0000000000000000", "request-1", 1778547600);

    expect(request.Data.Cmd).toBe(386);
    expect(request.Data.Data).toEqual({ Enable: 1 });
    expect(request.Topic).toBe("sdcp/request/0000000000000000");
  });
});
