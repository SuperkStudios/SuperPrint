"use client";

import { useMemo, useState } from "react";
import { StoreBuyButton } from "@/components/store-buy-button";
import { StlModelViewer } from "@/components/stl-model-viewer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { filamentColorToHex } from "@/lib/filament-colors";
import { money } from "@/lib/utils";

export function StoreProductCard({
  product,
  colors,
  signedIn
}: {
  product: {
    id: string;
    name: string;
    description: string;
    imageUrl: string;
    modelUrl: string | null;
    priceCents: number;
    estimatedPrintMinutes: number;
    defaultMaterial: string;
  };
  colors: string[];
  signedIn: boolean;
}) {
  const options = colors.length ? colors : [product.defaultMaterial];
  const [selectedColor, setSelectedColor] = useState(options[0]);
  const previewColor = useMemo(() => filamentColorToHex(selectedColor), [selectedColor]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="mb-4 h-48 overflow-hidden rounded-md bg-slate-50">
          {product.modelUrl ? (
            <StlModelViewer src={product.modelUrl} color={previewColor} className="h-full border-0" />
          ) : (
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="w-fit bg-primary/10 text-primary">Queue-ready</Badge>
          {options.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`Preview ${color}`}
              onClick={() => setSelectedColor(color)}
              className={`size-6 rounded-full border-2 ${selectedColor === color ? "border-slate-950" : "border-white shadow"}`}
              style={{ backgroundColor: filamentColorToHex(color) }}
            />
          ))}
        </div>
        <CardTitle>{product.name}</CardTitle>
        <CardDescription>{product.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{money(product.priceCents)}</p>
          <p className="text-sm text-muted-foreground">{product.estimatedPrintMinutes} min · {selectedColor} {product.defaultMaterial}</p>
        </div>
        <StoreBuyButton productId={product.id} signedIn={signedIn} />
      </CardContent>
    </Card>
  );
}
