"use client";

import { useState } from "react";
import { StoreBuyButton } from "@/components/store-buy-button";
import { StlModelViewer } from "@/components/stl-model-viewer";
import { Badge } from "@/components/ui/badge";
import { filamentColorToHex } from "@/lib/filament-colors";
import { money } from "@/lib/utils";

type MaterialOption = {
  id: string;
  material: string;
  color: string;
  brand: string;
  remainingGrams: number;
  requiresAdminApproval: boolean;
  estimatedPrintMinutes: number;
  finalCustomerPriceCents: number;
  unavailableReason: string | null;
  marginWarning: string | null;
};

export function StoreProductCheckout({
  product,
  materials,
  signedIn
}: {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    imageUrl: string;
    modelUrl: string | null;
    priceCents: number;
    estimatedPrintMinutes: number;
    estimatedGrams: number;
    defaultMaterial: string;
  };
  materials: MaterialOption[];
  signedIn: boolean;
}) {
  const materialOptions = materials.length ? materials : [{
    id: product.defaultMaterial,
    material: product.defaultMaterial,
    color: product.defaultMaterial,
    brand: "Default",
    remainingGrams: 0,
    requiresAdminApproval: false,
    estimatedPrintMinutes: product.estimatedPrintMinutes,
    finalCustomerPriceCents: product.priceCents,
    unavailableReason: null,
    marginWarning: null
  }];
  const [selectedFilamentId, setSelectedFilamentId] = useState(materialOptions[0].id);
  const selectedOption = materialOptions.find((option) => option.id === selectedFilamentId) ?? materialOptions[0];
  const selectedMaterial = selectedOption.material;
  const selectedColor = selectedOption.color;
  const previewColor = filamentColorToHex(selectedColor);
  const checkoutDisabled = Boolean(selectedOption.unavailableReason || selectedOption.requiresAdminApproval);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="min-h-[420px] overflow-hidden rounded-lg border bg-muted/20">
        {product.modelUrl ? (
          <StlModelViewer src={product.modelUrl} color={previewColor} className="h-[420px] border-0" />
        ) : (
          <img src={product.imageUrl} alt="" className="h-[420px] w-full object-cover" />
        )}
      </div>
      <section className="grid content-start gap-6">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-primary/10 text-primary">Queue-ready</Badge>
            <Badge className="bg-secondary">Tested product</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-3 text-muted-foreground">{product.description}</p>
        </div>

        <div className="grid gap-3 rounded-md border bg-card p-4 text-card-foreground shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold">{money(selectedOption.finalCustomerPriceCents)}</p>
              <p className="text-sm text-muted-foreground">{selectedOption.estimatedPrintMinutes} min · {product.estimatedGrams}g estimate</p>
            </div>
            <StoreBuyButton
              productId={product.id}
              signedIn={signedIn}
              selectedFilamentMaterialId={selectedFilamentId}
              selectedMaterial={selectedMaterial}
              selectedColor={selectedColor}
              loginNext={`/store/${product.slug}`}
              disabled={checkoutDisabled}
            />
          </div>
          {selectedOption.unavailableReason ? <p className="text-sm text-destructive">{selectedOption.unavailableReason}</p> : null}
          {selectedOption.requiresAdminApproval ? <p className="text-sm text-secondary-foreground">This material requires approval before checkout.</p> : null}
          {!signedIn ? <p className="text-sm text-muted-foreground">Create an account or sign in before checkout so we can attach the order to your queue and media.</p> : null}
        </div>

        <div className="grid gap-4 rounded-md border bg-card p-4 text-card-foreground shadow-sm">
          <div>
            <p className="text-sm font-medium">Filament</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {materialOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedFilamentId(option.id)}
                  className={`rounded-md border px-3 py-2 text-left text-sm font-medium ${selectedFilamentId === option.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
                >
                  <span className="block">{option.color} {option.material}</span>
                  <span className="block text-xs opacity-75">{option.brand} · {money(option.finalCustomerPriceCents)}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Selected material</p>
            <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="size-5 rounded-full border" style={{ backgroundColor: filamentColorToHex(selectedColor) }} />
              {selectedColor} {selectedMaterial} · {selectedOption.remainingGrams}g in stock
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
