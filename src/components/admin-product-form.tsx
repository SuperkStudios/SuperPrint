"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Clock3, Coins, Scale3D } from "lucide-react";
import { filamentColorToHex } from "@/lib/filament-colors";
import { calculateProductMaterialCostCents, parseProductPrintFileEstimates } from "@/domain/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StlModelViewer } from "@/components/stl-model-viewer";

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
  colors?: string[];
};

const fallbackMaterials: MaterialOption[] = [{ material: "PLA", rollCostCents: 0 }];

function formatPrintTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (hours <= 0) return `${remainingMinutes}m`;
  if (remainingMinutes <= 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

export function AdminProductForm({ product, materials = fallbackMaterials }: { product?: ProductDraft; materials?: MaterialOption[] }) {
  const [message, setMessage] = useState("");
  const [estimatedGrams, setEstimatedGrams] = useState(product?.estimatedGrams ?? 50);
  const [estimatedPrintMinutes, setEstimatedPrintMinutes] = useState(product?.estimatedPrintMinutes ?? 60);
  const [selectedMaterial, setSelectedMaterial] = useState(product?.defaultMaterial ?? materials[0]?.material ?? "PLA");
  const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
  const selectedRollCostCents = materials.find((item) => item.material === selectedMaterial)?.rollCostCents ?? 0;
  const colorOptions = useMemo(() => materials.find((item) => item.material === selectedMaterial)?.colors?.filter(Boolean) ?? [], [materials, selectedMaterial]);
  const [selectedColor, setSelectedColor] = useState(colorOptions[0] ?? selectedMaterial);
  const previewColor = filamentColorToHex(selectedColor);
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
    if (/\.stl$/i.test(file.name)) setSelectedModelFile(file);
    if (/\.(stl)$/i.test(file.name)) {
      setMessage("Asking slicer for estimates...");
      const formData = new FormData();
      formData.set("printFile", file);
      formData.set("material", selectedMaterial);
      const response = await fetch("/api/admin/products/estimate", {
        method: "POST",
        body: formData
      });
      const estimate = await response.json().catch(() => null) as null | {
        estimatedGrams?: number | null;
        estimatedPrintMinutes?: number | null;
        source?: string;
        message?: string;
      };
      if (response.ok && estimate?.estimatedGrams && estimate.estimatedPrintMinutes) {
        setEstimatedGrams(estimate.estimatedGrams);
        setEstimatedPrintMinutes(estimate.estimatedPrintMinutes);
        setMessage(estimate.source === "slicer" ? "Loaded estimates from slicer." : "Loaded fallback geometry estimates. Start the host slicer bridge for exact slicer values.");
      } else {
        setMessage(estimate?.message ?? "Could not calculate estimates from this STL.");
      }
      return;
    }
    if (!/\.(gcode|gco|g)$/i.test(file.name)) {
      setMessage("Print file stored. Upload STL or G-code to calculate estimates.");
      return;
    }
    const estimates = parseProductPrintFileEstimates(await file.text(), selectedMaterial);
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
        <Label htmlFor="imageFile">Fallback product image</Label>
        <Input id="imageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="printFile">Upload product STL/G-code file</Label>
        <Input id="printFile" name="printFile" type="file" accept=".stl,.gcode,.gco,.g,.3mf,model/stl,text/plain,application/octet-stream" onChange={readPrintFile} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="priceDollars">Price</Label>
          <Input id="priceDollars" name="priceDollars" type="number" min="0.01" step="0.01" defaultValue={product ? (product.priceCents / 100).toFixed(2) : "25.00"} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultMaterial">Material</Label>
          <select
            id="defaultMaterial"
            name="defaultMaterial"
            value={selectedMaterial}
            onChange={(event) => {
              const nextMaterial = event.target.value;
              const nextColors = materials.find((item) => item.material === nextMaterial)?.colors?.filter(Boolean) ?? [];
              setSelectedMaterial(nextMaterial);
              setSelectedColor(nextColors[0] ?? nextMaterial);
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {materials.map((item) => <option key={item.material}>{item.material}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 rounded-md border bg-slate-50/80 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">3D product preview</p>
          <p className="mt-1 text-xs text-muted-foreground">Drag the model to inspect it. Pick a filament color to preview the finish.</p>
        </div>
        <StlModelViewer
          file={selectedModelFile}
          src={!selectedModelFile && product?.productFileStorageKey ? `/api/products/${product.id}/model` : null}
          color={previewColor}
          className="h-72"
        />
        <div className="flex flex-wrap gap-2">
          {(colorOptions.length ? colorOptions : [selectedMaterial]).map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Preview ${color}`}
              onClick={() => setSelectedColor(color)}
              className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium ${selectedColor === color ? "border-slate-900 bg-white text-slate-950" : "bg-white/70 text-muted-foreground"}`}
            >
              <span className="size-4 rounded-full border" style={{ backgroundColor: filamentColorToHex(color) }} />
              {color}
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="estimatedPrintMinutes" value={estimatedPrintMinutes} />
      <input type="hidden" name="estimatedGrams" value={estimatedGrams} />
      <div className="grid gap-3 rounded-md border bg-slate-50/80 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Calculated print values</p>
          <p className="mt-1 text-xs text-muted-foreground">Loaded from the uploaded STL/G-code and filament stock.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <CalculatedValue icon={<Clock3 className="h-4 w-4" />} label="Print time" value={formatPrintTime(estimatedPrintMinutes)} detail={`${estimatedPrintMinutes} total minutes`} />
          <CalculatedValue icon={<Scale3D className="h-4 w-4" />} label="Filament" value={`${estimatedGrams}g`} detail={selectedMaterial} />
          <CalculatedValue icon={<Coins className="h-4 w-4" />} label="Material cost" value={`$${materialCost}`} detail={`${estimatedGrams}g from stock`} />
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

function CalculatedValue({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
