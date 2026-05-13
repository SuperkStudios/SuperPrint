import { describe, expect, it } from "vitest";
import { sanitizePlatformEvent } from "./events";

describe("sanitizePlatformEvent", () => {
  it("keeps public event facts while removing internal operational data", () => {
    const event = sanitizePlatformEvent({
      id: "evt_1",
      type: "PRINT_STARTED",
      actorRole: "ADMIN",
      createdAt: new Date("2026-05-01T10:00:00.000Z"),
      payload: {
        orderNumber: "SP-1001",
        printerName: "Forge One",
        printerInternalIp: "10.0.0.42",
        printerApiToken: "secret-token",
        adminNotes: "calibrate before customer stream",
        status: "PRINTING",
        etaMinutes: 142
      }
    });

    expect(event).toEqual({
      id: "evt_1",
      type: "PRINT_STARTED",
      createdAt: "2026-05-01T10:00:00.000Z",
      payload: {
        orderNumber: "SP-1001",
        printerName: "Forge One",
        status: "PRINTING",
        etaMinutes: 142
      }
    });
  });

  it("allows manual print detection events without private printer data", () => {
    const event = sanitizePlatformEvent({
      id: "evt_2",
      type: "MANUAL_PRINT_DETECTED",
      actorRole: "SYSTEM",
      createdAt: new Date("2026-05-12T10:00:00.000Z"),
      payload: {
        fileName: "benchy_tpu.gcode",
        progressPercent: 3,
        printerInternalIp: "192.168.10.125"
      }
    });

    expect(event).toEqual({
      id: "evt_2",
      type: "MANUAL_PRINT_DETECTED",
      createdAt: "2026-05-12T10:00:00.000Z",
      payload: {
        fileName: "benchy_tpu.gcode",
        progressPercent: 3
      }
    });
  });
});
