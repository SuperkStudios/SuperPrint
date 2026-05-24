import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findUniqueOrThrowMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const centauriAdapterMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/prisma", () => ({
  prisma: {
    printJob: {
      findUniqueOrThrow: findUniqueOrThrowMock,
      update: updateMock
    }
  }
}));

vi.mock("../services/events", () => ({
  recordPlatformEvent: vi.fn()
}));

vi.mock("../domain/printer-control", () => ({
  CentauriPrinterControlAdapter: centauriAdapterMock
}));

import { startAssignedQueuedJobOnPrinter } from "./queue";

describe("queue printer dispatch safety", () => {
  const originalDirectStart = process.env.CENTAURI_DIRECT_START_ENABLED;

  beforeEach(() => {
    process.env.CENTAURI_DIRECT_START_ENABLED = "false";
    findUniqueOrThrowMock.mockReset();
    updateMock.mockReset();
    centauriAdapterMock.mockReset();
  });

  afterEach(() => {
    if (originalDirectStart === undefined) {
      delete process.env.CENTAURI_DIRECT_START_ENABLED;
    } else {
      process.env.CENTAURI_DIRECT_START_ENABLED = originalDirectStart;
    }
  });

  it("blocks assigned Centauri jobs before creating a printer adapter when direct start is disabled", async () => {
    const job = {
      id: "job_1",
      status: "QUEUED",
      printerId: "printer_1",
      printer: {
        id: "printer_1",
        controlApiUrl: "ws://192.168.10.125:3030/websocket"
      },
      order: {
        product: {
          productFileStorageKey: "uploads/dragon.stl"
        }
      },
      sliceJob: null
    };
    findUniqueOrThrowMock.mockResolvedValue(job);
    updateMock.mockResolvedValue({
      ...job,
      assignmentBlockedReason: "Direct Centauri printer start is disabled. Verify G-code on the printer and clear this hold before enabling CENTAURI_DIRECT_START_ENABLED."
    });

    const result = await startAssignedQueuedJobOnPrinter("job_1");

    expect(result.assignmentBlockedReason).toContain("Direct Centauri printer start is disabled");
    expect(centauriAdapterMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: {
        assignmentBlockedReason: "Direct Centauri printer start is disabled. Verify G-code on the printer and clear this hold before enabling CENTAURI_DIRECT_START_ENABLED."
      }
    });
  });

  it("can dispatch a ready-on-node job when direct start is explicitly enabled", async () => {
    process.env.CENTAURI_DIRECT_START_ENABLED = "true";
    const startPrintMock = vi.fn().mockResolvedValue({
      acknowledged: true,
      mode: "centauri-sdcp",
      message: "started"
    });
    centauriAdapterMock.mockImplementation(function CentauriPrinterControlAdapter() {
      return { startPrint: startPrintMock };
    });
    const job = {
      id: "job_1",
      status: "READY_ON_NODE",
      printerId: "printer_1",
      printer: {
        id: "printer_1",
        publicName: "Centauri",
        controlApiUrl: "ws://192.168.10.125:3030/websocket"
      },
      order: {
        orderNumber: "SP-1",
        product: {
          productFileStorageKey: "uploads/dragon.stl"
        }
      },
      sliceJob: null,
      nodeLocalJobPath: "/data/sliced/dragon.gcode",
      etaMinutes: 82
    };
    findUniqueOrThrowMock.mockResolvedValue(job);
    updateMock.mockResolvedValue({
      ...job,
      status: "PRINTING"
    });

    const result = await startAssignedQueuedJobOnPrinter("job_1");

    expect(result.status).toBe("PRINTING");
    expect(startPrintMock).toHaveBeenCalledWith({
      printJobId: "job_1",
      gcodeLocalPath: "/data/sliced/dragon.gcode"
    });
  });

  it("blocks the job instead of crashing the worker when direct start fails", async () => {
    process.env.CENTAURI_DIRECT_START_ENABLED = "true";
    const startPrintMock = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 192.168.10.125:3030"));
    centauriAdapterMock.mockImplementation(function CentauriPrinterControlAdapter() {
      return { startPrint: startPrintMock };
    });
    const job = {
      id: "job_1",
      status: "QUEUED",
      printerId: "printer_1",
      printer: {
        id: "printer_1",
        publicName: "Centauri",
        controlApiUrl: "ws://192.168.10.125:3030/websocket"
      },
      order: {
        orderNumber: "SP-1",
        product: {
          productFileStorageKey: "uploads/dragon.stl"
        }
      },
      sliceJob: null,
      nodeLocalJobPath: "/data/sliced/dragon.gcode",
      etaMinutes: 82
    };
    findUniqueOrThrowMock.mockResolvedValue(job);
    updateMock.mockResolvedValue({
      ...job,
      assignmentBlockedReason: "Automatic printer start failed: connect ECONNREFUSED 192.168.10.125:3030"
    });

    const result = await startAssignedQueuedJobOnPrinter("job_1");

    expect(result.assignmentBlockedReason).toContain("Automatic printer start failed");
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "job_1" },
      data: {
        assignmentBlockedReason: "Automatic printer start failed: connect ECONNREFUSED 192.168.10.125:3030"
      }
    });
  });
});
