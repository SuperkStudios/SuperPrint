"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Clock3, Coins, Scale3D } from "lucide-react";
import { filamentColorToHex } from "@/lib/filament-colors";
import { calculateProductMaterialCostCents, parseProductPrintFileEstimates } from "@/domain/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StlModelViewer } from "@/components/stl-model-viewer";
import { money } from "@/lib/utils";

type ProductDraft = {
  id?: string;
  name: string;
  slug?: string;
  description: string;
  imageUrl: string;
  imageStorageKey?: string | null;
  productFileStorageKey?: string | null;
  priceCents: number;
  pricingMode?: "FIXED" | "DYNAMIC";
  fixedPriceCents?: number | null;
  baseLaborMinutes?: number;
  basePackagingCents?: number;
  estimatedPrintMinutes: number;
  estimatedGrams: number;
  materialCostCents: number;
  defaultMaterial: string;
  defaultFilamentMaterialId?: string | null;
  status: string;
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

export function AdminProductForm({ product, materials = fallbackMaterials, pricingQuotes = [] }: { product?: ProductDraft; materials?: MaterialOption[]; pricingQuotes?: PricingQuote[] }) {
  const materialOptions = materials.length ? materials : fallbackMaterials;
  const initialDefaultFilamentId = product?.defaultFilamentMaterialId ?? materialOptions[0]?.id ?? "";
  const initialAllowedIds = new Set(product?.allowedFilaments?.length ? product.allowedFilaments.map((item) => item.filamentMaterialId) : initialDefaultFilamentId ? [initialDefaultFilamentId] : []);
  const [message, setMessage] = useState("");
  const [estimatedGrams, setEstimatedGrams] = useState(product?.estimatedGrams ?? 50);
  const [estimatedPrintMinutes, setEstimatedPrintMinutes] = useState(product?.estimatedPrintMinutes ?? 60);
  const [baseLaborMinutes, setBaseLaborMinutes] = useState(product?.baseLaborMinutes ?? 10);
  const [basePackagingCents, setBasePackagingCents] = useState(product?.basePackagingCents ?? 150);
  const [pricingMode, setPricingMode] = useState<"FIXED" | "DYNAMIC">(product?.pricingMode ?? "DYNAMIC");
  const [fixedPriceDollars, setFixedPriceDollars] = useState(product?.fixedPriceCents ? (product.fixedPriceCents / 100).toFixed(2) : "");
  const [defaultFilamentId, setDefaultFilamentId] = useState(initialDefaultFilamentId);
  const [allowedIds, setAllowedIds] = useState<string[]>([...initialAllowedIds]);
  const [previewQuotes, setPreviewQuotes] = useState<PricingQuote[]>(pricingQuotes);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const selectedDefaultFilament = materialOptions.find((item) => item.id === defaultFilamentId) ?? materialOptions[0];
  const [selectedMaterial, setSelectedMaterial] = useState(product?.defaultMaterial ?? selectedDefaultFilament?.material ?? "PLA");
  const [selectedModelFile, setSelectedModelFile] = useState<File | null>(null);
  const selectedRollCostCents = selectedDefaultFilament?.rollCostCents ?? 0;
  const colorOptions = useMemo(() => materialOptions.filter((item) => item.material === selectedMaterial).map((item) => item.color).filter(Boolean), [materialOptions, selectedMaterial]);
  const [selectedColor, setSelectedColor] = useState(selectedDefaultFilament?.color ?? selectedMaterial);
  const previewColor = filamentColorToHex(selectedColor);
  const materialCostCents = useMemo(
    () => calculateProductMaterialCostCents({ estimatedGrams, rollCostCents: selectedRollCostCents }),
    [estimatedGrams, selectedRollCostCents]
  );
  const materialCost = (materialCostCents / 100).toFixed(2);
  const quoteRows = previewQuotes.length ? previewQuotes : pricingQuotes;
  const suggestedQuote = quoteRows.find((quote) => quote.filamentMaterialId === defaultFilamentId);
  const suggestedPriceCents = suggestedQuote?.finalCustomerPriceCents ?? null;

  useEffect(() => {
    if (!defaultFilamentId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const filamentMaterialIds = [...new Set([defaultFilamentId, ...allowedIds])].filter(Boolean);
        const response = await fetch("/api/admin/products/pricing-preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId: product?.id,
            estimatedGrams,
            estimatedPrintMinutes,
            baseLaborMinutes,
            basePackagingCents,
            pricingMode,
            fixedPriceCents: pricingMode === "FIXED" && Number(fixedPriceDollars) > 0 ? Math.round(Number(fixedPriceDollars) * 100) : null,
            filamentMaterialIds
          }),
          signal: controller.signal
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Pricing preview failed.");
        setPreviewQuotes(body?.quotes ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreviewError(error instanceof Error ? error.message : "Pricing preview failed.");
      } finally {
        setPreviewLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [allowedIds, baseLaborMinutes, basePackagingCents, defaultFilamentId, estimatedGrams, estimatedPrintMinutes, fixedPriceDollars, pricingMode, product?.id]);

  async function submit(formData: FormData) {
    setMessage("");
    if (product?.id) formData.set("id", product.id);
    formData.set("priceCents", String(suggestedPriceCents ?? product?.priceCents ?? 1));
    formData.set("fixedPriceCents", pricingMode === "FIXED" ? String(Math.round(Number(fixedPriceDollars) * 100)) : "");
    formData.set("defaultFilamentMaterialId", defaultFilamentId);
    formData.set("defaultMaterial", selectedDefaultFilament?.material ?? selectedMaterial);
    formData.set("materialCostCents", String(materialCostCents));
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="pricingMode">Pricing mode</Label>
          <select
            id="pricingMode"
            name="pricingMode"
            value={pricingMode}
            onChange={(event) => setPricingMode(event.target.value as "FIXED" | "DYNAMIC")}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="DYNAMIC">Dynamic</option>
            <option value="FIXED">Fixed</option>
          </select>
        </div>
        {pricingMode === "FIXED" ? (
          <div className="grid gap-2">
            <Label htmlFor="fixedPriceDollars">Fixed price</Label>
            <Input id="fixedPriceDollars" name="fixedPriceDollars" type="number" min="0.01" step="0.01" value={fixedPriceDollars} onChange={(event) => setFixedPriceDollars(event.target.value)} placeholder={suggestedPriceCents ? (suggestedPriceCents / 100).toFixed(2) : "0.00"} />
          </div>
        ) : (
          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <p className="font-medium text-foreground">Suggested price</p>
            <p className="mt-1 text-2xl font-semibold">{suggestedPriceCents ? money(suggestedPriceCents) : "Calculating..."}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {previewError ? previewError : previewLoading ? "Refreshing from pricing settings..." : suggestedQuote ? "Live quote from the backend pricing engine." : "Choose a default filament to calculate a price."}
            </p>
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="baseLaborMinutes">Labor minutes</Label>
          <Input id="baseLaborMinutes" name="baseLaborMinutes" type="number" min="0" value={baseLaborMinutes} onChange={(event) => setBaseLaborMinutes(Math.max(0, Math.round(Number(event.target.value) || 0)))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="basePackagingCents">Packaging cents</Label>
          <Input id="basePackagingCents" name="basePackagingCents" type="number" min="0" value={basePackagingCents} onChange={(event) => setBasePackagingCents(Math.max(0, Math.round(Number(event.target.value) || 0)))} />
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
      </div>
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Allowed filaments</p>
          <p className="mt-1 text-xs text-muted-foreground">Enable every material/color customers may choose. Optional overrides tune price per filament.</p>
        </div>
        <div className="grid gap-3">
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
      </div>
      {quoteRows.length ? (
        <div className="overflow-x-auto rounded-md border bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">Suggested price by filament</p>
          <div className="mt-3 min-w-[640px]">
            <div className="grid grid-cols-[1fr_110px_110px_110px_1fr] gap-3 border-b pb-2 text-xs font-medium uppercase text-muted-foreground">
              <span>Filament</span>
              <span>Cost</span>
              <span>Price</span>
              <span>Margin</span>
              <span>Status</span>
            </div>
            {quoteRows.map((quote) => {
              const filament = materialOptions.find((item) => item.id === quote.filamentMaterialId);
              return (
                <div key={quote.filamentMaterialId} className="grid grid-cols-[1fr_110px_110px_110px_1fr] gap-3 border-b py-2 text-sm last:border-b-0">
                  <span>{filament ? `${filament.color} ${filament.material} · ${filament.brand}` : quote.filamentMaterialId}</span>
                  <span>{money(quote.internalCostCents)}</span>
                  <span>{money(quote.finalCustomerPriceCents)}</span>
                  <span>{money(quote.marginCents)} ({Math.round(quote.marginPercent * 100)}%)</span>
                  <span className={quote.unavailableReason || quote.marginWarning ? "text-destructive" : "text-muted-foreground"}>
                    {quote.unavailableReason ?? quote.marginWarning ?? "Ready"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 rounded-md border bg-muted/20 p-4">
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
              className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs font-medium ${selectedColor === color ? "border-primary bg-primary/10 text-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              <span className="size-4 rounded-full border" style={{ backgroundColor: filamentColorToHex(color) }} />
              {color}
            </button>
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
