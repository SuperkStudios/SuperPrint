export const factoryUpgradeCategories = ["printer", "material", "camera", "automation", "facility", "livestream", "quality", "experimental"] as const;
export const factoryUpgradeStatuses = ["active", "funded", "installing", "completed", "cancelled"] as const;
export const factoryVisibilities = ["public", "private"] as const;
export const factoryMilestoneMetrics = ["completed_prints", "filament_grams", "queue_watch_hours", "printer_uptime_hours", "contribution_cents", "livestream_engagement", "custom"] as const;

export type FactoryUpgradeCategory = (typeof factoryUpgradeCategories)[number];
export type FactoryUpgradeStatus = (typeof factoryUpgradeStatuses)[number];
export type FactoryVisibility = (typeof factoryVisibilities)[number];
export type FactoryMilestoneMetric = (typeof factoryMilestoneMetrics)[number];

export function parseLines(value: unknown) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function slugifyFactoryTitle(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `factory-${Date.now()}`;
}

export function factoryProgressPercent(currentAmountCents: number, targetAmountCents: number) {
  if (targetAmountCents <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentAmountCents / targetAmountCents) * 100)));
}

export function milestoneProgressPercent(currentValue: number, targetValue: number) {
  if (targetValue <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((currentValue / targetValue) * 100)));
}

export function publicSupporterName(input: { anonymous?: boolean | null; name?: string | null; username?: string | null; email?: string | null }) {
  if (input.anonymous) return "Anonymous supporter";
  return input.username || input.name || input.email?.split("@")[0] || "Supporter";
}
