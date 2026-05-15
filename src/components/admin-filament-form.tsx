"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const materials = ["PLA", "PLA_PLUS", "PETG", "ABS", "TPU", "NYLON", "RESIN"];

export function AdminFilamentForm() {
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      material: String(formData.get("material") ?? "PLA"),
      color: String(formData.get("color") ?? ""),
      brand: String(formData.get("brand") ?? ""),
      startingGrams: 1000,
      remainingGrams: 1000,
      thresholdGrams: Number(formData.get("thresholdGrams") ?? 150),
      rollCostCents: Math.round(Number(formData.get("rollCostDollars") ?? 0) * 100),
      location: "Stock"
    };
    const response = await fetch("/api/admin/filament", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Filament added." : (await response.json().catch(() => null))?.error ?? "Could not add filament.");
    if (response.ok) window.location.reload();
  }

  return (
    <form action={submit} className="grid gap-4 rounded border bg-card p-4 text-card-foreground shadow-sm">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="material">Material</Label>
          <select id="material" name="material" className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {materials.map((material) => <option key={material}>{material}</option>)}
          </select>
        </div>
        <Field name="color" label="Color" placeholder="Black, Blue, #33ccff" />
        <Field name="brand" label="Brand" placeholder="Elegoo, Polymaker, Overture" />
        <Field name="rollCostDollars" label="1kg roll cost" type="number" step="0.01" defaultValue="20.00" />
        <Field name="thresholdGrams" label="Low alert grams" type="number" defaultValue="150" />
      </div>
      <Button type="submit">Add 1kg filament roll</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  step,
  defaultValue,
  placeholder
}: {
  name: string;
  label: string;
  type?: string;
  step?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} placeholder={placeholder} required />
    </div>
  );
}
