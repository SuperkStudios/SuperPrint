export type ProductionLoopPlate = {
  id: string;
  filamentId?: string | null;
  material?: string | null;
  color: string;
  quantityPlanned: number;
  createdAt: Date | string;
};

export type ProductionLoopGroup = {
  key: string;
  filamentId: string | null;
  material: string | null;
  color: string;
  totalQuantity: number;
  plateCount: number;
  plateIds: string[];
};

export function planProductionPlateOrder(input: {
  plates: ProductionLoopPlate[];
  currentFilamentId?: string | null;
  currentMaterial?: string | null;
  currentColor?: string | null;
}) {
  const groups = new Map<string, ProductionLoopGroup & { firstCreatedAt: number }>();
  for (const plate of input.plates) {
    const key = filamentKey(plate);
    const existing = groups.get(key);
    const createdAt = new Date(plate.createdAt).getTime();
    if (existing) {
      existing.totalQuantity += plate.quantityPlanned;
      existing.plateCount += 1;
      existing.plateIds.push(plate.id);
      existing.firstCreatedAt = Math.min(existing.firstCreatedAt, createdAt);
      continue;
    }
    groups.set(key, {
      key,
      filamentId: plate.filamentId ?? null,
      material: plate.material ?? null,
      color: plate.color,
      totalQuantity: plate.quantityPlanned,
      plateCount: 1,
      plateIds: [plate.id],
      firstCreatedAt: createdAt
    });
  }

  const currentKey = input.currentFilamentId
    ? `id:${input.currentFilamentId}`
    : input.currentMaterial
      ? `mc:${input.currentMaterial}:${input.currentColor ?? ""}`.toLowerCase()
      : null;

  const orderedGroups = [...groups.values()].sort((a, b) => {
    const quantity = b.totalQuantity - a.totalQuantity;
    if (quantity) return quantity;
    const plates = b.plateCount - a.plateCount;
    if (plates) return plates;
    if (currentKey) {
      const aLoaded = a.key === currentKey ? 1 : 0;
      const bLoaded = b.key === currentKey ? 1 : 0;
      if (aLoaded !== bLoaded) return bLoaded - aLoaded;
    }
    return a.firstCreatedAt - b.firstCreatedAt;
  });

  return {
    groups: orderedGroups.map(({ firstCreatedAt: _firstCreatedAt, ...group }) => group),
    orderedPlateIds: orderedGroups.flatMap((group) => group.plateIds)
  };
}

export function hasUsableSlicerEstimate(plate: {
  outputStorageKey?: string | null;
  estimatedPrintMinutes?: number | null;
  estimatedGrams?: number | null;
}) {
  return Boolean(plate.outputStorageKey && /\.(?:gcode|gco|g)$/i.test(plate.outputStorageKey) && plate.estimatedPrintMinutes && plate.estimatedGrams);
}

export function filamentLabel(input: { color?: string | null; material?: string | null; name?: string | null }) {
  return [input.color, input.material].filter(Boolean).join(" ") || input.name || "unknown filament";
}

function filamentKey(plate: ProductionLoopPlate) {
  if (plate.filamentId) return `id:${plate.filamentId}`;
  return `mc:${plate.material ?? ""}:${plate.color}`.toLowerCase();
}
