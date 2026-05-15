import { describe, expect, it } from "vitest";
import { extractCentauriTimelapseRecords, selectTimelapseForPrintJob } from "./centauri-timelapse";

describe("Centauri timelapse media", () => {
  it("extracts ready timelapse URLs from nested printer history details", () => {
    const records = extractCentauriTimelapseRecords([
      {
        Data: {
          Data: {
            HistoryDetailList: [
              {
                TaskId: "task-1",
                TaskName: "/local/dragon.gcode",
                EndTime: 1778774100,
                TimeLapseVideoStatus: 1,
                TimeLapseVideoUrl: "http://192.168.10.125/local/aic_tlp/dragon.mp4",
                SliceInformation: { print_time: 120 }
              }
            ]
          }
        }
      }
    ]);

    expect(records).toEqual([
      {
        taskId: "task-1",
        taskName: "/local/dragon.gcode",
        completedAt: new Date(1778774100 * 1000).toISOString(),
        durationSec: 120,
        status: "READY",
        url: "http://192.168.10.125/local/aic_tlp/dragon.mp4"
      }
    ]);
  });

  it("selects the matching ready timelapse for the completed print job", () => {
    const selected = selectTimelapseForPrintJob(
      [
        {
          taskId: "old",
          taskName: "/local/dragon.gcode",
          completedAt: "2026-05-14T01:00:00.000Z",
          status: "READY",
          url: "http://printer/local/aic_tlp/old.mp4"
        },
        {
          taskId: "job",
          taskName: "/local/dragon.gcode",
          completedAt: "2026-05-14T02:40:00.000Z",
          status: "READY",
          url: "http://printer/local/aic_tlp/job.mp4"
        }
      ],
      {
        gcodePath: "/data/sliced/dragon.gcode",
        startedAt: new Date("2026-05-14T02:00:00.000Z"),
        completedAt: new Date("2026-05-14T02:45:00.000Z")
      }
    );

    expect(selected?.url).toBe("http://printer/local/aic_tlp/job.mp4");
  });
});
