import { describe, expect, it } from "vitest";
import {
  buildCentauriStatusRefreshRequest,
  buildCentauriVideoEnableRequest,
  buildPrinterHeartbeatUpdate,
  getCentauriMjpegUrl,
  parseCentauriStatusTelemetry
} from "./printer-heartbeat";

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

  it("builds the Centauri SDCP status refresh request", () => {
    const request = buildCentauriStatusRefreshRequest("mainboard-1", "request-2", 1778547601);

    expect(request.Data.Cmd).toBe(0);
    expect(request.Data.Data).toEqual({});
    expect(request.Topic).toBe("sdcp/request/mainboard-1");
  });

  it("parses safe Centauri SDCP telemetry from status messages", () => {
    const telemetry = parseCentauriStatusTelemetry(
      {
        Data: {
          Status: {
            CurrentStatus: 1,
            TempOfNozzle: 214,
            TempTargetNozzle: 220,
            TempOfHotbed: "59.5",
            TempTargetHotbed: 60,
            TempOfBox: 31,
            TempTargetBox: 0,
            PrintSpeed: 100,
            PrintInfo: {
              Status: 1,
              CurrentLayer: 12,
              TotalLayer: 100,
              CurrentTicks: 120,
              TotalTicks: 600,
              Filename: "/private/path/model.gcode"
            }
          }
        }
      },
      new Date("2026-05-12T14:30:00.000Z")
    );

    expect(telemetry).toEqual({
      state: "LIVE",
      source: "centauri-sdcp",
      machineStatus: 1,
      machineStatusLabel: "Printing",
      printStatus: 1,
      printStatusLabel: "Homing",
      nozzleTempC: 214,
      nozzleTargetC: 220,
      bedTempC: 59.5,
      bedTargetC: 60,
      chamberTempC: 31,
      chamberTargetC: 0,
      progressPercent: 20,
      currentLayer: 12,
      totalLayer: 100,
      elapsedSeconds: 120,
      remainingSeconds: 480,
      printSpeedPercent: 100,
      updatedAt: "2026-05-12T14:30:00.000Z"
    });
    expect(JSON.stringify(telemetry)).not.toContain("/private/path");
  });

  it("rounds noisy live telemetry before it reaches the UI", () => {
    const telemetry = parseCentauriStatusTelemetry(
      {
        Data: {
          Status: {
            CurrentStatus: 1,
            TempOfNozzle: 210.08019002088122,
            TempTargetNozzle: 210,
            TempOfHotbed: 60.6679140884808,
            TempTargetHotbed: 60,
            PrintInfo: {
              Status: 13,
              CurrentLayer: 1,
              TotalLayer: 295,
              CurrentTicks: 143.52232402699974,
              TotalTicks: 11344.477675973001
            }
          }
        }
      },
      new Date("2026-05-12T15:37:46.423Z")
    );

    expect(telemetry).toMatchObject({
      nozzleTempC: 210.1,
      nozzleTargetC: 210,
      bedTempC: 60.7,
      bedTargetC: 60,
      elapsedSeconds: 144,
      remainingSeconds: 11201
    });
  });
});
