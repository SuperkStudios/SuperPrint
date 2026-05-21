"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Clock3, Coins, Scale3D } from "lucide-react";
import { filamentColorToHex } from "@/lib/filament-colors";
import { calculateProductMaterialCostCents, parseProductPrintFileEstimates } from "@/domain/products";
import { shippingPackagePresetById, shippingPackagePresets } from "@/domain/shipping-packages";
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
  previewPlateStorageKey?: string | null;
  priceCents: number;
  pricingMode?: "FIXED" | "DYNAMIC";
  fixedPriceCents?: number | null;
  baseLaborMinutes?: number;
  basePackagingCents?: number;
  shippingPackagePreset?: string;
  shippingParcelTemplateId?: string | null;
  shippingPackageLengthIn?: number;
  shippingPackageWidthIn?: number;
  shippingPackageHeightIn?: number;
  shippingPackageWeightOz?: number;
  estimatedPrintMinutes: number;
  estimatedGrams: number;
  materialCostCents: number;
  defaultMaterial: string;
  defaultFilamentMaterialId?: string | null;
  colorSlotCount?: number;
  maxBatchQuantity?: number;
  status: string;
  parts?: Array<{
    id?: string;
    name: string;
    fileStorageKey: string;
    role: string;
    colorSlotIndex: number;
    colorSlotPattern?: number[];
    quantityPerUnit: number;
    displayOrder: number;
  }>;
  allowedFilaments?: Array<{
    filamentMaterialId: string;
    estimatedGramsOverride: number | null;
    estimatedPrintMinutesOverride: number | null;
    priceAdjustmentCents: number;
    enabled: boolean;
  }>;
};

type MaterialOption = {
  id: string;
  material: string;
  rollCostCents: number;
  color: string;
  brand: string;
  remainingGrams: number;
  requiresAdminApproval?: boolean;
};

const fallbackMaterials: MaterialOption[] = [{ id: "PLA", material: "PLA", rollCostCents: 0, color: "Default", brand: "Unbranded", remainingGrams: 0 }];

function formatPrintTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (hours <= 0) return `${remainingMinutes}m`;
  if (remainingMinutes <= 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

type PricingQuote = {
  filamentMaterialId: string;
  finalCustomerPriceCents: number;
  internalCostCents: number;
  marginCents: number;
  marginPercent: number;
  unavailableReason: string | null;
  marginWarning: string | null;
};

type ProductPartDraft = {
  id?: string;
  name: string;
  fileStorageKey?: string;
  file?: File;
  role: string;
  colorSlotIndex: number;
  colorSlotPattern?: number[];
  quantityPerUnit: number;
  displayOrder: number;
};

export function AdminProductForm({ product, materials = fallbackMaterials }: { product?: ProductDraft; materials?: MaterialOption[]; pricingQuotes?: PricingQuote[] }) {
  const materialOptions = materials.length ? materials : fallbackMaterials;
  const initialDefaultFilamentId = product?.defaultFilamentMaterialId ?? materialOptions[0]?.id ?? "";
  const initialAllowedIds = new Set(product?.allowedFilaments?.length ? product.allowedFilaments.map((item) => item.filamentMaterialId) : initialDefaultFilamentId ? [initialDefaultFilamentId] : []);
  const [message, setMessage] = useState("");
  const [estimatedGrams, setEstimatedGrams] = useState(product?.estimatedGrams ?? 50);
  const [estimatedPrintMinutes, setEstimatedPrintMinutes] = useState(product?.estimatedPrintMinutes ?? 60);
  const [baseLaborMinutes, setBaseLaborMinutes] = useState(product?.baseLaborMinutes ?? 10);
  const [basePackagingCents, setBasePackagingCents] = useState(product?.basePackagingCents ?? 150);
  const initialPackagePreset = shippingPackagePresetById(product?.shippingPackagePreset);
  const [shippingPackagePreset, setShippingPackagePreset] = useState(product?.shippingPackagePreset ?? initialPackagePreset.id);
  const [shippingPackageLengthIn, setShippingPackageLengthIn] = useState(product?.shippingPackageLengthIn ?? initialPackagePreset.lengthIn);
  const [shippingPackageWidthIn, setShippingPackageWidthIn] = useState(product?.shippingPackageWidthIn ?? initialPackagePreset.widthIn);
  const [shippingPackageHeightIn, setShippingPackageHeightIn] = useState(product?.shippingPackageHeightIn ?? initialPackagePreset.heightIn);
  const [shippingPackageWeightOz, setShippingPackageWeightOz] = useState(product?.shippingPackageWeightOz ?? initialPackagePreset.weightOz);
  const [colorSlotCount, setColorSlotCount] = useState(product?.colorSlotCount ?? 1);
  const [maxBatchQuantity, setMaxBatchQuantity] = useState(product?.maxBatchQuantity ?? 1);
  const [fixedPriceDollars, setFixedPriceDollars] = useState(((product?.fixedPriceCents ?? product?.priceCents ?? 0) / 100).toFixed(2));
  const [defaultFilamentId, setDefaultFilamentId] = useState(initialDefaultFilamentId);
  const [allowedIds, setAllowedIds] = useState<string[]>([...initialAllowedIds]);
  const selectedDefaultFilament = materialOptions.find((item) => item.id === defaultFilamentId) ?? materialOptions[0];
  const [selectedMaterial, setSelectedMaterial] = useState(product?.defaultMaterial ?? selectedDefaultFilament?.material ?? "PLA");
  const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
  const selectedRollCostCents = selectedDefaultFilament?.rollCostCents ?? 0;
  const colorOptions = useMemo(() => materialOptions.filter((item) => item.material === selectedMaterial).map((item) => item.color).filter(Boolean), [materialOptions, selectedMaterial]);
  const [selectedColor, setSelectedColor] = useState(selectedDefaultFilament?.color ?? selectedMaterial);
  const [previewSlotColors, setPreviewSlotColors] = useState<string[]>(() => Array.from({ length: product?.colorSlotCount ?? 1 }, (_, index) => materialOptions[index]?.color ?? selectedDefaultFilament?.color ?? selectedMaterial));
  const [partRows, setPartRows] = useState<ProductPartDraft[]>(() => (product?.parts ?? []).map((part, index) => ({ ...part, displayOrder: part.displayOrder ?? index })));
  const previewColor = filamentColorToHex(selectedColor);
  const previewColors = Array.from({ length: colorSlotCount }, (_, index) => previewSlotColors[index] ?? previewSlotColors[0] ?? selectedColor);
  const materialCostCents = useMemo(
    () => calculateProductMaterialCostCents({ estimatedGrams, rollCostCents: selectedRollCostCents }),
    [estimatedGrams, selectedRollCostCents]
  );
  const materialCost = (materialCostCents / 100).toFixed(2);

  useEffect(() => {
    setPreviewSlotColors((current) => Array.from({ length: colorSlotCount }, (_, index) => current[index] ?? current[0] ?? selectedColor));
  }, [colorSlotCount, selectedColor]);

  async function submit(formData: FormData) {
    setMessage("");
    if (product?.id) formData.set("id", product.id);
    const fixedPriceCents = Math.max(1, Math.round(Number(fixedPriceDollars) * 100));
    formData.set("pricingMode", "FIXED");
    formData.set("priceCents", String(fixedPriceCents));
    formData.set("fixedPriceCents", fixedPriceCents && fixedPriceCents > 0 ? String(fixedPriceCents) : "");
    formData.set("defaultFilamentMaterialId", defaultFilamentId);
    formData.set("defaultMaterial", selectedDefaultFilament?.material ?? selectedMaterial);
    formData.set("materialCostCents", String(materialCostCents));
    formData.set("shippingPackagePreset", shippingPackagePreset);
    formData.set("shippingPackageLengthIn", String(shippingPackageLengthIn));
    formData.set("shippingPackageWidthIn", String(shippingPackageWidthIn));
    formData.set("shippingPackageHeightIn", String(shippingPackageHeightIn));
    formData.set("shippingPackageWeightOz", String(shippingPackageWeightOz));
    formData.set("existingParts", JSON.stringify(partRows.filter((part) => part.fileStorageKey).map(({ file, ...part }) => part)));
    formData.set("uploadedPartMeta", JSON.stringify(partRows.filter((part) => part.file).map(({ file, ...part }) => part)));
    formData.delete("partFiles");
    for (const part of partRows) {
      if (part.file) formData.append("partFiles", part.file);
    }
    const response = await fetch("/api/admin/products", {
      method: "POST",
      body: formData
    });
    setMessage(response.ok ? "Product saved." : (await response.json().catch(() => null))?.error ?? "Product save failed.");
    if (response.ok) window.location.reload();
  }

  async function deleteProduct() {
    if (!product?.id) return;
    if (!window.confirm(`Delete ${product.name}? Products with existing orders will be archived instead.`)) return;
    setMessage("Deleting product...");
    const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, {
      method: "DELETE"
    });
    const body = await response.json().catch(() => null);
    setMessage(response.ok ? body?.message ?? "Product deleted." : body?.error ?? "Product delete failed.");
    if (response.ok) window.location.reload();
  }

  async function readPrintFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (/\.(stl|3mf)$/i.test(file.name)) setSelectedModelFile(file);
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

  function addPartFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setPartRows((current) => [
      ...current,
      ...files.map((file, index) => {
        const cleanName = file.name.replace(/\.(stl|3mf)$/i, "");
        return {
          name: cleanName,
          file,
          role: inferPartRole(cleanName),
          colorSlotIndex: inferPartColorSlot(cleanName),
          colorSlotPattern: [],
          quantityPerUnit: inferPartQuantity(cleanName),
          displayOrder: current.length + index
        };
      })
    ]);
  }

  function updatePart(index: number, patch: Partial<ProductPartDraft>) {
    setPartRows((current) => current.map((part, partIndex) => {
      if (partIndex !== index) return part;
      const next = { ...part, ...patch };
      if (patch.quantityPerUnit || patch.colorSlotIndex != null) {
        next.colorSlotPattern = normalizePartColorPattern(next.colorSlotPattern, next.quantityPerUnit, next.colorSlotIndex);
      }
      return next;
    }));
  }

  function updatePartCopyColor(partIndex: number, copyIndex: number, slot: number) {
    setPartRows((current) => current.map((part, index) => {
      if (index !== partIndex) return part;
      const pattern = normalizePartColorPattern(part.colorSlotPattern, part.quantityPerUnit, part.colorSlotIndex);
      pattern[copyIndex] = Math.min(colorSlotCount - 1, Math.max(0, slot));
      return { ...part, colorSlotPattern: pattern };
    }));
  }

  function removePart(index: number) {
    setPartRows((current) => current.filter((_, partIndex) => partIndex !== index).map((part, displayOrder) => ({ ...part, displayOrder })));
  }

  return (
    <form action={submit} className="grid gap-4 rounded border bg-card p-4 text-card-foreground shadow-sm">
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
        <textarea id="description" name="description" defaultValue={product?.description} required className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="imageFile">Fallback product image</Label>
        <Input id="imageFile" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="printFile">Upload product STL/G-code file</Label>
        <Input id="printFile" name="printFile" type="file" accept=".stl,.gcode,.gco,.g,.3mf,model/stl,text/plain,application/octet-stream" onChange={readPrintFile} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="previewPlateFile">Max build plate preview</Label>
        <Input id="previewPlateFile" name="previewPlateFile" type="file" accept=".stl,.3mf,model/stl,application/octet-stream" />
        <p className="text-xs text-muted-foreground">Optional. Upload the full/max plate STL or 3MF from ElegooSlicer so customers see the plate layout with their colors.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="partFiles">Individual part files</Label>
        <Input id="partFiles" type="file" accept=".stl,.3mf,model/stl,application/octet-stream" multiple onChange={addPartFiles} />
        <p className="text-xs text-muted-foreground">Upload every distinct part once, then set how many are needed for one finished product.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <input type="hidden" name="pricingMode" value="FIXED" />
        <div className="grid gap-2">
          <Label htmlFor="fixedPriceDollars">Price</Label>
          <Input id="fixedPriceDollars" type="number" min="0.01" step="0.01" value={fixedPriceDollars} onChange={(event) => setFixedPriceDollars(event.target.value)} placeholder="0.00" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultFilamentMaterialId">Default filament</Label>
          <select
            id="defaultFilamentMaterialId"
            name="defaultFilamentMaterialId"
            value={defaultFilamentId}
            onChange={(event) => {
              const filament = materialOptions.find((item) => item.id === event.target.value);
              setDefaultFilamentId(event.target.value);
              if (filament) {
                setSelectedMaterial(filament.material);
                setSelectedColor(filament.color);
                setAllowedIds((current) => current.includes(filament.id) ? current : [...current, filament.id]);
              }
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {materialOptions.map((item) => <option key={item.id} value={item.id}>{item.color} {item.material} · {item.brand}</option>)}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="colorSlotCount">Customer color choices</Label>
          <Input
            id="colorSlotCount"
            name="colorSlotCount"
            type="number"
            min="1"
            max="6"
            value={colorSlotCount}
            onChange={(event) => setColorSlotCount(Math.min(6, Math.max(1, Math.round(Number(event.target.value) || 1))))}
          />
          <p className="text-xs text-muted-foreground">Use 2 for spinner-style products where the customer picks two colors and production batches each color separately.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="maxBatchQuantity">Max products per build plate</Label>
          <Input
            id="maxBatchQuantity"
            name="maxBatchQuantity"
            type="number"
            min="1"
            max="200"
            value={maxBatchQuantity}
            onChange={(event) => setMaxBatchQuantity(Math.min(200, Math.max(1, Math.round(Number(event.target.value) || 1))))}
          />
          <p className="text-xs text-muted-foreground">Example: set 14 when a full spinner plate fits fourteen ordered units of one color pass.</p>
        </div>
      </div>
      <details className="rounded-md border bg-muted/20 p-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Packaging settings</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="baseLaborMinutes">Labor minutes</Label>
            <Input id="baseLaborMinutes" name="baseLaborMinutes" type="number" min="0" value={baseLaborMinutes} onChange={(event) => setBaseLaborMinutes(Math.max(0, Math.round(Number(event.target.value) || 0)))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="basePackagingCents">Packaging cents</Label>
            <Input id="basePackagingCents" name="basePackagingCents" type="number" min="0" value={basePackagingCents} onChange={(event) => setBasePackagingCents(Math.max(0, Math.round(Number(event.target.value) || 0)))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingPackagePreset">Package tier</Label>
            <select
              id="shippingPackagePreset"
              name="shippingPackagePreset"
              value={shippingPackagePreset}
              onChange={(event) => {
                const preset = shippingPackagePresetById(event.target.value);
                setShippingPackagePreset(preset.id);
                setShippingPackageLengthIn(preset.lengthIn);
                setShippingPackageWidthIn(preset.widthIn);
                setShippingPackageHeightIn(preset.heightIn);
                setShippingPackageWeightOz(preset.weightOz);
                setBasePackagingCents(preset.packagingCents);
              }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {shippingPackagePresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingParcelTemplateId">Shippo parcel template ID</Label>
            <Input id="shippingParcelTemplateId" name="shippingParcelTemplateId" defaultValue={product?.shippingParcelTemplateId ?? ""} placeholder="optional Shippo template object ID" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingPackageLengthIn">Package length in</Label>
            <Input id="shippingPackageLengthIn" name="shippingPackageLengthIn" type="number" min="0.1" step="0.1" value={shippingPackageLengthIn} onChange={(event) => setShippingPackageLengthIn(Math.max(0.1, Number(event.target.value) || 0.1))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingPackageWidthIn">Package width in</Label>
            <Input id="shippingPackageWidthIn" name="shippingPackageWidthIn" type="number" min="0.1" step="0.1" value={shippingPackageWidthIn} onChange={(event) => setShippingPackageWidthIn(Math.max(0.1, Number(event.target.value) || 0.1))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingPackageHeightIn">Package height in</Label>
            <Input id="shippingPackageHeightIn" name="shippingPackageHeightIn" type="number" min="0.1" step="0.1" value={shippingPackageHeightIn} onChange={(event) => setShippingPackageHeightIn(Math.max(0.1, Number(event.target.value) || 0.1))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="shippingPackageWeightOz">Packed weight oz</Label>
            <Input id="shippingPackageWeightOz" name="shippingPackageWeightOz" type="number" min="0.1" step="0.1" value={shippingPackageWeightOz} onChange={(event) => setShippingPackageWeightOz(Math.max(0.1, Number(event.target.value) || 0.1))} />
          </div>
        </div>
      </details>
      {partRows.length ? (
        <div className="grid gap-3 rounded-md border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Product parts</p>
            <p className="mt-1 text-xs text-muted-foreground">One row per distinct file. Set quantity, role, and copy colors for one finished product.</p>
          </div>
          <div className="grid gap-2">
            {partRows.map((part, index) => (
              <div key={part.fileStorageKey ?? `${part.name}-${index}`} className="grid gap-3 rounded-md border bg-background p-3 text-sm">
                <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_5rem_8rem_8rem_auto]">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Part</span>
                    <Input value={part.name} onChange={(event) => updatePart(index, { name: event.target.value })} aria-label="Part name" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Qty</span>
                    <Input type="number" min="1" value={part.quantityPerUnit} onChange={(event) => updatePart(index, { quantityPerUnit: Math.max(1, Math.round(Number(event.target.value) || 1)) })} aria-label="Quantity per product" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Role</span>
                    <select value={part.role} onChange={(event) => updatePart(index, { role: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Part role">
                      <option value="gear">Gear</option>
                      <option value="connector">Connector</option>
                      <option value="part">Part</option>
                    </select>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Default</span>
                    <select value={part.colorSlotIndex} onChange={(event) => updatePart(index, { colorSlotIndex: Number(event.target.value), colorSlotPattern: [] })} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Default part color slot">
                      {Array.from({ length: colorSlotCount }, (_, slot) => <option key={slot} value={slot}>Color {slot + 1}</option>)}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" onClick={() => removePart(index)}>Remove</Button>
                  </div>
                </div>
                {part.quantityPerUnit > 1 ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <span className="pb-2 text-xs font-medium text-muted-foreground">Copy colors</span>
                    {normalizePartColorPattern(part.colorSlotPattern, part.quantityPerUnit, part.colorSlotIndex).map((slotValue, copyIndex) => (
                      <label key={copyIndex} className="grid gap-1">
                        <span className="text-xs text-muted-foreground">#{copyIndex + 1}</span>
                        <select
                          value={Math.min(colorSlotCount - 1, slotValue)}
                          onChange={(event) => updatePartCopyColor(index, copyIndex, Number(event.target.value))}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {Array.from({ length: colorSlotCount }, (_, slot) => <option key={slot} value={slot}>Color {slot + 1}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <details className="rounded-md border bg-muted/20 p-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">Allowed filaments</summary>
        <p className="mt-2 text-xs text-muted-foreground">Enable the colors customers can choose. Advanced overrides are hidden here to keep the main form clean.</p>
        <div className="mt-4 grid gap-3">
          {materialOptions.map((item) => {
            const existing = product?.allowedFilaments?.find((allowed) => allowed.filamentMaterialId === item.id);
            const checked = allowedIds.includes(item.id);
            return (
              <div key={item.id} className="grid gap-3 rounded-md border bg-background p-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem]">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="allowedFilamentIds"
                    value={item.id}
                    checked={checked}
                    onChange={(event) => setAllowedIds((current) => event.target.checked ? [...new Set([...current, item.id])] : current.filter((id) => id !== item.id))}
                  />
                  <span>
                    {item.color} {item.material} · {item.brand}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {item.remainingGrams}g left{item.requiresAdminApproval ? " · approval required" : ""}
                    </span>
                  </span>
                </label>
                <Input name={`overrideGrams:${item.id}`} type="number" placeholder={`${estimatedGrams}g`} defaultValue={existing?.estimatedGramsOverride ?? ""} disabled={!checked} />
                <Input name={`overrideMinutes:${item.id}`} type="number" placeholder={`${estimatedPrintMinutes}m`} defaultValue={existing?.estimatedPrintMinutesOverride ?? ""} disabled={!checked} />
                <Input name={`priceAdjustmentCents:${item.id}`} type="number" placeholder="Adj cents" defaultValue={existing?.priceAdjustmentCents ?? 0} disabled={!checked} />
              </div>
            );
          })}
        </div>
      </details>
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">3D product preview</p>
          <p className="mt-1 text-xs text-muted-foreground">Drag the model to inspect it. Pick a filament color to preview the finish.</p>
        </div>
        <StlModelViewer
          file={selectedModelFile}
          src={!selectedModelFile && product?.productFileStorageKey ? `/api/products/${product.id}/model` : null}
          parts={partRows.map((part) => ({
            src: product?.id && part.id ? `/api/products/${product.id}/parts/${part.id}/model` : undefined,
            file: part.file,
            quantity: part.quantityPerUnit,
            colorIndex: Math.min(colorSlotCount - 1, Math.max(0, part.colorSlotIndex)),
            copyColorIndexes: normalizePartColorPattern(part.colorSlotPattern, part.quantityPerUnit, part.colorSlotIndex).map((slot) => Math.min(colorSlotCount - 1, Math.max(0, slot))),
            modelFormat: part.file && /\.3mf$/i.test(part.file.name) ? "3mf" : part.fileStorageKey && /\.3mf$/i.test(part.fileStorageKey) ? "3mf" : "stl"
          }))}
          modelFormat={selectedModelFile && /\.3mf$/i.test(selectedModelFile.name) ? "3mf" : product?.productFileStorageKey && /\.3mf$/i.test(product.productFileStorageKey) ? "3mf" : "stl"}
          color={previewColor}
          colors={previewColors.map(filamentColorToHex)}
          className="h-72"
        />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: colorSlotCount }, (_, slot) => (
            <div key={slot} className="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
              <span className="text-xs font-medium text-muted-foreground">Color {slot + 1}</span>
              <select
                value={previewColors[slot]}
                onChange={(event) => {
                  setSelectedColor(event.target.value);
                  setPreviewSlotColors((current) => current.map((color, index) => index === slot ? event.target.value : color));
                }}
                className="h-8 rounded border bg-background px-2 text-xs"
              >
                {(colorOptions.length ? colorOptions : [selectedMaterial]).map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
              <span className="size-4 rounded-full border" style={{ backgroundColor: filamentColorToHex(previewColors[slot]) }} />
            </div>
          ))}
        </div>
      </div>
      <input type="hidden" name="estimatedPrintMinutes" value={estimatedPrintMinutes} />
      <input type="hidden" name="estimatedGrams" value={estimatedGrams} />
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4">
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
        <select id="status" name="status" defaultValue={product?.status ?? "ACTIVE"} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option>ACTIVE</option>
          <option>ARCHIVED</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save product</Button>
        {product?.id ? (
          <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={deleteProduct}>
            Delete product
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}

function inferPartRole(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("gear")) return "gear";
  if (lower.includes("connector") || lower.includes("bar")) return "connector";
  return "part";
}

function inferPartColorSlot(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("right") || lower.includes("second") || lower.includes("color2")) return 1;
  return 0;
}

function inferPartQuantity(name: string) {
  const match = name.match(/(?:qty|x|quantity)[-_ ]?(\d+)/i);
  return match ? Math.max(1, Number(match[1])) : 1;
}

function normalizePartColorPattern(pattern: number[] | undefined, quantity: number, fallbackSlot: number) {
  return Array.from({ length: Math.max(1, quantity) }, (_, index) => {
    const slot = pattern?.[index];
    return Number.isFinite(slot) ? Number(slot) : fallbackSlot;
  });
}

function CalculatedValue({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border bg-background p-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
