import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadCompletedPrintTimelapse } from "./timelapse-media";

describe("timelapse media service", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  });

  it("downloads the matched printer timelapse and attaches it to the order", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "superprint-timelapse-"));
    const attachExistingOrderMedia = vi.fn().mockResolvedValue({ id: "video-1" });
    const fetchHistoryMessages = vi.fn().mockResolvedValue([
      {
        Data: {
          Data: {
            HistoryDetailList: [
              {
                TaskId: "task-1",
                TaskName: "/local/dragon.gcode",
                EndTime: 1778726400,
                TimeLapseVideoStatus: 1,
                TimeLapseVideoUrl: "http://printer/local/aic_tlp/dragon.mp4",
                SliceInformation: { print_time: 90 }
              }
            ]
          }
        }
      }
    ]);
    const download = vi.fn().mockResolvedValue(Buffer.from("mp4-bytes"));
    const triggerExport = vi.fn().mockResolvedValue(undefined);

    const result = await downloadCompletedPrintTimelapse(
      {
        id: "job-1",
        orderId: "order-1",
        orderNumber: "SP-1001",
        printerControlApiUrl: "ws://printer:3030/websocket",
        gcodePath: "/data/sliced/dragon.gcode",
        startedAt: new Date("2026-05-14T02:00:00.000Z"),
        completedAt: new Date("2026-05-14T02:45:00.000Z")
      },
      {
        dataRoot: tempDir,
        fetchHistoryMessages,
        triggerExport,
        download,
        attachExistingOrderMedia
      }
    );

    expect(result).toMatchObject({ attached: true, storageKey: "timelapses/SP-1001-job-1.mp4" });
    expect(triggerExport).toHaveBeenCalledWith("ws://printer:3030/websocket", "/local/aic_tlp/dragon.mp4", 30000);
    expect(await readFile(path.join(tempDir, "timelapses", "SP-1001-job-1.mp4"), "utf8")).toBe("mp4-bytes");
    expect(attachExistingOrderMedia).toHaveBeenCalledWith("order-1", {
      title: "Timelapse for SP-1001",
      videoKey: "timelapses/SP-1001-job-1.mp4",
      timelapseKey: "timelapses/SP-1001-job-1.mp4",
      durationSec: 90
    });
  });
});
