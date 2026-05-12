"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProductDraft = {
  id?: string;
  name: string;
  slug?: string;
  description: string;
  imageUrl: string;
  imageStorageKey?: string | null;
  productFileStorageKey?: string | null;
  priceCents: number;
  estimatedPrintMinutes: number;
  estimatedGrams: number;
  materialCostCents: number;
  defaultMaterial: string;
  status: string;
};

export function AdminProductForm({ product }: { product?: ProductDraft }) {
  const [message, setMessage] = useState("");
  const [estimatedGrams, setEstimatedGrams] = useState(product?.estimatedGrams ?? 50);
  const [rollCostDollars, setRollCostDollars] = useState(20);
  const materialCost = useMemo(() => ((estimatedGrams / 1000) * rollCostDollars).toFixed(2), [estimatedGrams, rollCostDollars]);

  async function submit(formData: FormData) {
    setMessage("");
    if (product?.id) formData.set("id", product.id);
    formData.set("priceCents", String(Math.round(Number(formData.get("priceDollars") ?? 0) * 100)));
    formData.set("materialCostCents", String(Math.round(Number(formData.get("materialCostDollars") ?? 0) * 100)));
    const response = await fetch("/api/admin/products", {
      method: "POST",
      body: formData
    });
    setMessage(response.ok ? "Product saved." : (await response.json().catch(() => null))?.error ?? "Product save failed.");
    if (response.ok) window.location.reload();
  }

  return (
    <form action={submit} className="grid gap-4 rounded border bg-white p-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={product?.name} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" defaultValue={product?.slug} placeholder="auto-generated if blank" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" defaultValue={product?.description} required className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="imageUrl">Product image URL</Label>
        <Input id="imageUrl" name="imageUrl" defaultValue={product?.imageUrl?.startsWith("/api/") ? "" : product?.imageUrl} placeholder="Optional when uploading an image" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="imageFile">Upload product image</Label>
        <Input id="imageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="printFile">Upload product STL/G-code file</Label>
        <Input id="printFile" name="printFile" type="file" accept=".stl,.gcode,.3mf,model/stl,text/plain,application/octet-stream" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="priceDollars">Price</Label>
          <Input id="priceDollars" name="priceDollars" type="number" min="0.01" step="0.01" defaultValue={product ? (product.priceCents / 100).toFixed(2) : "25.00"} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimatedPrintMinutes">ETA minutes</Label>
          <Input id="estimatedPrintMinutes" name="estimatedPrintMinutes" type="number" min="1" defaultValue={product?.estimatedPrintMinutes ?? 60} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimatedGrams">Estimated grams</Label>
          <Input
            id="estimatedGrams"
            name="estimatedGrams"
            type="number"
            min="1"
            value={estimatedGrams}
            onChange={(event) => setEstimatedGrams(Number(event.target.value))}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultMaterial">Material</Label>
          <select id="defaultMaterial" name="defaultMaterial" defaultValue={product?.defaultMaterial ?? "PLA"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"].map((material) => <option key={material}>{material}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="rollCostDollars">Cost basis per 1kg roll</Label>
          <Input id="rollCostDollars" name="rollCostDollars" type="number" min="0" step="0.01" value={rollCostDollars} onChange={(event) => setRollCostDollars(Number(event.target.value))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="materialCostDollars">Calculated material cost</Label>
          <Input id="materialCostDollars" name="materialCostDollars" type="number" min="0" step="0.01" value={materialCost} readOnly />
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Product cost preview</p>
          <p className="mt-2">{estimatedGrams}g from a ${rollCostDollars.toFixed(2)} roll = ${materialCost}</p>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue={product?.status ?? "ACTIVE"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option>ACTIVE</option>
          <option>ARCHIVED</option>
        </select>
      </div>
      <Button type="submit">Save product</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
