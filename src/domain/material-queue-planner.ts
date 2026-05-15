export type MaterialQueueJob = {
  id: string;
  queuePosition: number | null;
  material?: string | null;
};

export function planMaterialAwareQueue(input: {
  currentMaterial?: string | null;
  jobs: MaterialQueueJob[];
}) {
  const ordered = [...input.jobs].sort((a, b) => (a.queuePosition ?? Number.MAX_SAFE_INTEGER) - (b.queuePosition ?? Number.MAX_SAFE_INTEGER));
  const currentMaterial = input.currentMaterial ?? null;
  if (!currentMaterial || ordered.length <= 1) {
    const next = ordered[0];
    return {
      orderedJobIds: ordered.map((job) => job.id),
      requiredFilamentChange: next?.material && currentMaterial && next.material !== currentMaterial
        ? {
            fromMaterial: currentMaterial,
            toMaterial: next.material,
            reason: `Next queued job requires ${next.material}, but ${currentMaterial} is loaded`
          }
        : null
    };
  }

  const compatible = ordered.filter((job) => job.material === currentMaterial);
  const incompatible = ordered.filter((job) => job.material !== currentMaterial);
  const planned = compatible.length ? [...compatible, ...incompatible] : ordered;
  const next = planned[0];

  return {
    orderedJobIds: planned.map((job) => job.id),
    requiredFilamentChange: next?.material && next.material !== currentMaterial
      ? {
          fromMaterial: currentMaterial,
          toMaterial: next.material,
          reason: `Next queued job requires ${next.material}, but ${currentMaterial} is loaded`
        }
      : null
  };
}
