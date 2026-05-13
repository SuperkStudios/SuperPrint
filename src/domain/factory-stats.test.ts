import { describe, expect, it } from "vitest";
import { calculateHomepageStats } from "./factory-stats";

describe("calculateHomepageStats", () => {
  it("excludes stopped prints from completed totals and success-rate failures", () => {
    const stats = calculateHomepageStats({
      completedPrints: 14,
      failedPrints: 0,
      stoppedPrints: 11,
      runtimeMinutes: 240,
      filamentGramsUsed: 1234,
      activeQueueJobs: 2
    });

    expect(stats.completedPrints).toBe(14);
    expect(stats.successRate).toBe(100);
    expect(stats.runtimeHours).toBe(4);
    expect(stats.filamentKg).toBe(1.2);
  });
});
