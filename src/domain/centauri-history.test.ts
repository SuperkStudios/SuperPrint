import { describe, expect, it } from "vitest";
import { extractCentauriTaskIds } from "./centauri-history";

describe("Centauri history extraction", () => {
  it("keeps every printer-history id instead of capping at 50", () => {
    const ids = Array.from({ length: 75 }, (_, index) => `task-${index + 1}`);

    expect(extractCentauriTaskIds([{ Data: { HistoryData: ids } }])).toHaveLength(75);
  });
});
