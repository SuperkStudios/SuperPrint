"use client";

import Link from "next/link";
import { StlModelViewer } from "@/components/stl-model-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";

export function StoreProductCard({
  product
}: {
  product: {
    id: string;
    slug: string;
    name: string;
    description: string;
    imageUrl: string;
    modelUrl: string | null;
    modelFormat?: "stl" | "3mf";
    priceCents: number;
    estimatedPrintMinutes: number;
    defaultMaterial: string;
  };
}) {
  return (
    <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <CardHeader>
        <Link href={`/store/${product.slug}`} className="mb-4 block h-56 overflow-hidden rounded-md bg-muted/20">
          {product.modelUrl ? (
            <StlModelViewer src={product.modelUrl} modelFormat={product.modelFormat} className="h-full border-0" />
          ) : (
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          )}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="w-fit bg-primary/10 text-primary">Queue-ready</Badge>
          <Badge className="w-fit bg-secondary">{product.defaultMaterial}</Badge>
        </div>
        <CardTitle>
          <Link href={`/store/${product.slug}`}>{product.name}</Link>
        </CardTitle>
        <CardDescription>{product.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{money(product.priceCents)}</p>
          <p className="text-sm text-muted-foreground">{product.estimatedPrintMinutes} min production estimate</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/store/${product.slug}`}>View</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
