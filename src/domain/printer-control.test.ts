import { describe, expect, it } from "vitest";
import {
  buildCentauriPrinterFilename,
  buildCentauriStartPrintRequest,
  describeCentauriStartAck,
  findCentauriFile,
  getCentauriResponseAck,
  isCentauriIdleStatus,
  ManualNoopPrinterControlAdapter,
  resolveCentauriUploadUrl
} from "./printer-control";

describe("printer control adapter", () => {
  it("acknowledges start commands without calling real printer APIs", async () => {
    const adapter = new ManualNoopPrinterControlAdapter();

    await expect(
      adapter.startPrint({
        printJobId: "job_1",
        gcodeLocalPath: "/data/node-jobs/job_1.gcode"
      })
    ).resolves.toEqual({
      acknowledged: true,
      mode: "manual-noop",
      message: "Manual/no-op adapter acknowledged start command; no printer API was called."
    });
  });

  it("acknowledges maintenance safety commands without calling real printer APIs", async () => {
    const adapter = new ManualNoopPrinterControlAdapter();

    await expect(adapter.stopPrint("job_1")).resolves.toMatchObject({
      acknowledged: true,
      mode: "manual-noop"
    });
    await expect(adapter.cooldown("printer_1")).resolves.toMatchObject({
      acknowledged: true,
      mode: "manual-noop"
    });
  });

  it("builds Centauri upload and start-print commands", () => {
    expect(resolveCentauriUploadUrl("ws://192.168.10.125:3030/websocket")).toBe("http://192.168.10.125:3030/uploadFile/upload");
    expect(buildCentauriPrinterFilename("/data/sliced/dragon.gcode")).toBe("dragon.gcode");
    expect(buildCentauriStartPrintRequest({ filename: "dragon.gcode", mainboardId: "mainboard-1", requestId: "12345", timestamp: 1778774100000 })).toEqual({
      Id: "mainboard-1",
      Data: {
        Cmd: 128,
        Data: {
          Filename: "dragon.gcode",
          StartLayer: 0,
          Calibration_switch: 0,
          PrintPlatformType: 0,
          Tlp_Switch: 0,
          slot_map: []
        },
        RequestID: "12345",
        MainboardID: "mainboard-1",
        TimeStamp: 1778774100000,
        From: 1
      },
      Topic: ""
    });
  });

  it("parses Centauri response ACK codes from nested protocol messages", () => {
    expect(getCentauriResponseAck({ Data: { Cmd: 128, Data: { Ack: 0 } } }, 128)).toBe(0);
    expect(getCentauriResponseAck({ Data: { Cmd: 128, Data: { Ack: 2 } } }, 128)).toBe(2);
    expect(getCentauriResponseAck({ Data: { Cmd: 258, Data: { Ack: 0 } } }, 128)).toBeNull();
    expect(describeCentauriStartAck(2)).toBe("not found");
  });

  it("detects idle status and uploaded files before allowing automatic start", () => {
    expect(isCentauriIdleStatus({ Status: { CurrentStatus: 0, PrintInfo: { Status: 0, ErrorNumber: 0 } } })).toBe(true);
    expect(isCentauriIdleStatus({ Status: { CurrentStatus: [0], PrintInfo: { Status: 0, ErrorNumber: 0 } } })).toBe(true);
    expect(isCentauriIdleStatus({ Status: { CurrentStatus: 1, PrintInfo: { Status: 1, ErrorNumber: 0 } } })).toBe(false);
    expect(isCentauriIdleStatus({ Status: { CurrentStatus: 0, PrintInfo: { Status: 0, ErrorNumber: 2 } } })).toBe(false);
    expect(
      findCentauriFile(
        {
          Data: {
            Cmd: 258,
            Data: {
              Ack: 0,
              FileList: [{ name: "/local//dragon.gcode", usedSize: 1234, type: 1 }]
            }
          }
        },
        "/local//dragon.gcode"
      )
    ).toEqual({ name: "/local//dragon.gcode", usedSize: 1234, type: 1 });
    expect(
      findCentauriFile(
        {
          Data: {
            Cmd: 258,
            Data: {
              Ack: 0,
              FileList: [{ name: "/local//dragon.gcode", usedSize: 1234, type: 1 }]
            }
          }
        },
        "dragon.gcode"
      )
    ).toEqual({ name: "/local//dragon.gcode", usedSize: 1234, type: 1 });
  });
});
