import { describe, expect, it } from "vitest";
import { buildCentauriHistoryListRequest, extractCentauriTaskIds } from "./centauri-history";

describe("Centauri history extraction", () => {
  it("keeps every printer-history id instead of capping at 50", () => {
    const ids = Array.from({ length: 75 }, (_, index) => `task-${index + 1}`);

    expect(extractCentauriTaskIds([{ Data: { HistoryData: ids } }])).toHaveLength(75);
  });

  it("uses the documented SDCP source field for history list requests", () => {
    expect(buildCentauriHistoryListRequest("mainboard-1").Data.From).toBe(0);
  });
});
