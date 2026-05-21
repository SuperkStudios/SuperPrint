export type MaterialQueueJob = {
  id: string;
  queuePosition: number | null;
  material?: string | null;
  color?: string | null;
  filamentId?: string | null;
};

export function planMaterialAwareQueue(input: {
  currentMaterial?: string | null;
  currentColor?: string | null;
  currentFilamentId?: string | null;
  jobs: MaterialQueueJob[];
}) {
  const ordered = [...input.jobs].sort((a, b) => (a.queuePosition ?? Number.MAX_SAFE_INTEGER) - (b.queuePosition ?? Number.MAX_SAFE_INTEGER));
  const currentMaterial = input.currentMaterial ?? null;
  const currentColor = input.currentColor ?? null;
  const currentFilamentId = input.currentFilamentId ?? null;
  const currentKey = filamentKey({ material: currentMaterial, color: currentColor, filamentId: currentFilamentId });
  if (!currentKey || ordered.length <= 1) {
    const next = ordered[0];
    const nextKey = next ? filamentKey(next) : null;
    return {
      orderedJobIds: ordered.map((job) => job.id),
      requiredFilamentChange: next?.material && currentMaterial && nextKey && currentKey && nextKey !== currentKey
        ? {
            fromMaterial: currentMaterial,
            fromColor: currentColor,
            toMaterial: next.material,
            toColor: next.color ?? null,
            reason: `Next queued job requires ${labelFilament(next)}, but ${labelFilament({ material: currentMaterial, color: currentColor })} is loaded`
          }
        : null
    };
  }

  const compatible = ordered.filter((job) => filamentKey(job) === currentKey);
  const remaining = ordered.filter((job) => filamentKey(job) !== currentKey);
  const grouped = groupByFilament(remaining);
  const planned = compatible.length ? [...compatible, ...grouped] : grouped;
  const next = planned[0];
  const nextKey = next ? filamentKey(next) : null;

  return {
    orderedJobIds: planned.map((job) => job.id),
    requiredFilamentChange: next?.material && nextKey !== currentKey
      ? {
          fromMaterial: currentMaterial,
          fromColor: currentColor,
          toMaterial: next.material,
          toColor: next.color ?? null,
          reason: `Next queued job requires ${labelFilament(next)}, but ${labelFilament({ material: currentMaterial, color: currentColor })} is loaded`
        }
      : null
  };
}

function groupByFilament(jobs: MaterialQueueJob[]) {
  const groups = new Map<string, MaterialQueueJob[]>();
  for (const job of jobs) {
    const key = filamentKey(job) ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.values()].flat();
}

function filamentKey(input: { material?: string | null; color?: string | null; filamentId?: string | null }) {
  if (!input.material) return null;
  return `${input.material}:${input.color ?? ""}`.toLowerCase();
}

function labelFilament(input: { material?: string | null; color?: string | null }) {
  return [input.color, input.material].filter(Boolean).join(" ") || "unknown filament";
}
