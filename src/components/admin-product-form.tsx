"use client";

import { useMemo, useState } from "react";
import { calculateProductMaterialCostCents, parseProductPrintFileEstimates } from "@/domain/products";
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

type MaterialOption = {
  material: string;
  rollCostCents: number;
};

const fallbackMaterials: MaterialOption[] = [{ material: "PLA", rollCostCents: 0 }];

export function AdminProductForm({ product, materials = fallbackMaterials }: { product?: ProductDraft; materials?: MaterialOption[] }) {
  const [message, setMessage] = useState("");
  const [estimatedGrams, setEstimatedGrams] = useState(product?.estimatedGrams ?? 50);
  const [estimatedPrintMinutes, setEstimatedPrintMinutes] = useState(product?.estimatedPrintMinutes ?? 60);
  const [selectedMaterial, setSelectedMaterial] = useState(product?.defaultMaterial ?? materials[0]?.material ?? "PLA");
  const selectedRollCostCents = materials.find((item) => item.material === selectedMaterial)?.rollCostCents ?? 0;
  const materialCostCents = useMemo(
    () => calculateProductMaterialCostCents({ estimatedGrams, rollCostCents: selectedRollCostCents }),
    [estimatedGrams, selectedRollCostCents]
  );
  const materialCost = (materialCostCents / 100).toFixed(2);

  async function submit(formData: FormData) {
    setMessage("");
    if (product?.id) formData.set("id", product.id);
    formData.set("priceCents", String(Math.round(Number(formData.get("priceDollars") ?? 0) * 100)));
    formData.set("materialCostCents", String(materialCostCents));
    const response = await fetch("/api/admin/products", {
      method: "POST",
      body: formData
    });
    setMessage(response.ok ? "Product saved." : (await response.json().catch(() => null))?.error ?? "Product save failed.");
    if (response.ok) window.location.reload();
  }

  async function readPrintFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(gcode|gco|g)$/i.test(file.name)) {
      setMessage("Print file stored. STL/3MF estimates need slicing or manual estimates.");
      return;
    }
    const estimates = parseProductPrintFileEstimates(await file.text());
    if (estimates.estimatedGrams) setEstimatedGrams(estimates.estimatedGrams);
    if (estimates.estimatedPrintMinutes) setEstimatedPrintMinutes(estimates.estimatedPrintMinutes);
    setMessage(estimates.estimatedGrams || estimates.estimatedPrintMinutes ? "Loaded estimates from G-code comments." : "No safe estimates found in G-code comments.");
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
        <Label htmlFor="imageFile">Upload product image</Label>
        <Input id="imageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" required={!product?.imageStorageKey} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="printFile">Upload product STL/G-code file</Label>
        <Input id="printFile" name="printFile" type="file" accept=".stl,.gcode,.gco,.g,.3mf,model/stl,text/plain,application/octet-stream" onChange={readPrintFile} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="priceDollars">Price</Label>
          <Input id="priceDollars" name="priceDollars" type="number" min="0.01" step="0.01" defaultValue={product ? (product.priceCents / 100).toFixed(2) : "25.00"} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="estimatedPrintMinutes">ETA minutes</Label>
          <Input id="estimatedPrintMinutes" name="estimatedPrintMinutes" type="number" min="1" value={estimatedPrintMinutes} onChange={(event) => setEstimatedPrintMinutes(Number(event.target.value))} required />
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
          <select id="defaultMaterial" name="defaultMaterial" value={selectedMaterial} onChange={(event) => setSelectedMaterial(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {materials.map((item) => <option key={item.material}>{item.material}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-4 rounded-md border bg-muted/30 p-3 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="materialCostDollars">Calculated material cost</Label>
          <Input id="materialCostDollars" name="materialCostDollars" type="number" min="0" step="0.01" value={materialCost} readOnly />
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Product cost preview</p>
          <p className="mt-2">{estimatedGrams}g of {selectedMaterial} = ${materialCost}</p>
          <p className="mt-1">Cost basis comes from filament stock.</p>
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
