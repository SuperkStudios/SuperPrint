const namedColors: Array<[string, string]> = [
  ["black", "#111827"],
  ["white", "#f8fafc"],
  ["clear", "#dbeafe"],
  ["transparent", "#dbeafe"],
  ["gray", "#6b7280"],
  ["grey", "#6b7280"],
  ["silver", "#c0c4cc"],
  ["red", "#dc2626"],
  ["orange", "#f97316"],
  ["yellow", "#facc15"],
  ["green", "#16a34a"],
  ["teal", "#14b8a6"],
  ["blue", "#2563eb"],
  ["purple", "#7c3aed"],
  ["pink", "#ec4899"],
  ["brown", "#92400e"],
  ["wood", "#b7791f"],
  ["natural", "#f1e4c3"]
];

export function filamentColorToHex(value?: string | null) {
  const color = String(value ?? "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  const normalized = color.toLowerCase();
  return namedColors.find(([name]) => normalized.includes(name))?.[1] ?? "#26a69a";
}
