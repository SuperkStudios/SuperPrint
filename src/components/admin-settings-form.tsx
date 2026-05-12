"use client";

import { useEffect, useState } from "react";
import { buildThemeCssVariables, normalizePrimaryColor } from "@/domain/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminSettingsForm({
  brandName,
  primaryColor,
  lowFilamentThresholdGrams
}: {
  brandName: string;
  primaryColor: string;
  lowFilamentThresholdGrams: number;
}) {
  const [draft, setDraft] = useState({ brandName, primaryColor, lowFilamentThresholdGrams });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const variables = buildThemeCssVariables(draft.primaryColor);
    for (const [key, value] of Object.entries(variables)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [draft.primaryColor]);

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    setMessage(response.ok ? "Settings saved" : result.error ?? "Settings blocked");
  }

  return (
    <div className="grid gap-5 rounded-lg border bg-white p-5 md:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="brand-name">Public brand name</Label>
        <Input id="brand-name" value={draft.brandName} onChange={(event) => setDraft((current) => ({ ...current, brandName: event.target.value }))} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="admin-primary-color">Primary color</Label>
        <div className="flex gap-2">
          <Input
            id="admin-primary-color"
            type="color"
            value={normalizePrimaryColor(draft.primaryColor)}
            onChange={(event) => setDraft((current) => ({ ...current, primaryColor: event.target.value }))}
            className="h-10 w-16 p-1"
          />
          <Input value={draft.primaryColor} onChange={(event) => setDraft((current) => ({ ...current, primaryColor: event.target.value }))} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="low-filament-threshold">Low filament alert grams</Label>
        <Input
          id="low-filament-threshold"
          type="number"
          value={draft.lowFilamentThresholdGrams}
          onChange={(event) => setDraft((current) => ({ ...current, lowFilamentThresholdGrams: Number(event.target.value) }))}
        />
      </div>

      <div className="flex items-end gap-3">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
