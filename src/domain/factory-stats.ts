export type HomepageStatsInput = {
  completedPrints: number;
  failedPrints: number;
  stoppedPrints: number;
  runtimeMinutes: number;
  filamentGramsUsed: number;
  activeQueueJobs: number;
};

export function calculateHomepageStats(input: HomepageStatsInput) {
  const totalSuccessEligible = input.completedPrints + input.failedPrints;
  return {
    completedPrints: input.completedPrints,
    runtimeHours: Math.round(input.runtimeMinutes / 60),
    successRate: totalSuccessEligible > 0 ? Math.round((input.completedPrints / totalSuccessEligible) * 100) : 100,
    filamentKg: Number((input.filamentGramsUsed / 1000).toFixed(1)),
    activeQueueJobs: input.activeQueueJobs
  };
}
