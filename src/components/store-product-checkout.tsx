"use client";

import { useMemo, useState } from "react";
import { StoreBuyButton } from "@/components/store-buy-button";
import { StlModelViewer } from "@/components/stl-model-viewer";
import { Badge } from "@/components/ui/badge";
import { filamentColorToHex } from "@/lib/filament-colors";
import { money } from "@/lib/utils";

type MaterialOption = {
  material: string;
  colors: string[];
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
  const materialOptions = materials.length ? materials : [{ material: product.defaultMaterial, colors: [product.defaultMaterial] }];
  const defaultMaterial = materialOptions.some((option) => option.material === product.defaultMaterial) ? product.defaultMaterial : materialOptions[0].material;
  const [selectedMaterial, setSelectedMaterial] = useState(defaultMaterial);
  const selectedMaterialColors = useMemo(
    () => materialOptions.find((option) => option.material === selectedMaterial)?.colors ?? [selectedMaterial],
    [materialOptions, selectedMaterial]
  );
  const [selectedColor, setSelectedColor] = useState(selectedMaterialColors[0] ?? selectedMaterial);
  const previewColor = filamentColorToHex(selectedColor);

  function chooseMaterial(material: string) {
    const colors = materialOptions.find((option) => option.material === material)?.colors ?? [material];
    setSelectedMaterial(material);
    setSelectedColor(colors[0] ?? material);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="min-h-[420px] overflow-hidden rounded-lg border bg-slate-50">
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

        <div className="grid gap-3 rounded-md border bg-white p-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-semibold">{money(product.priceCents)}</p>
              <p className="text-sm text-muted-foreground">{product.estimatedPrintMinutes} min · {product.estimatedGrams}g estimate</p>
            </div>
            <StoreBuyButton
              productId={product.id}
              signedIn={signedIn}
              selectedMaterial={selectedMaterial}
              selectedColor={selectedColor}
              loginNext={`/store/${product.slug}`}
            />
          </div>
          {!signedIn ? <p className="text-sm text-muted-foreground">Create an account or sign in before checkout so we can attach the order to your queue and media.</p> : null}
        </div>

        <div className="grid gap-4 rounded-md border bg-white p-4">
          <div>
            <p className="text-sm font-medium">Material</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {materialOptions.map((option) => (
                <button
                  key={option.material}
                  type="button"
                  onClick={() => chooseMaterial(option.material)}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${selectedMaterial === option.material ? "border-slate-950 bg-slate-950 text-white" : "bg-white hover:bg-muted"}`}
                >
                  {option.material}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Color</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedMaterialColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${selectedColor === color ? "border-slate-950 bg-slate-50" : "bg-white hover:bg-muted"}`}
                >
                  <span className="size-5 rounded-full border" style={{ backgroundColor: filamentColorToHex(color) }} />
                  {color}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
