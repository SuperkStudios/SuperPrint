"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProductDraft = {
  id?: string;
  name: string;
  slug?: string;
  description: string;
  imageUrl: string;
  priceCents: number;
  estimatedPrintMinutes: number;
  defaultMaterial: string;
  status: string;
};

export function AdminProductForm({ product }: { product?: ProductDraft }) {
  const [message, setMessage] = useState("");

  async function submit(formData: FormData) {
    setMessage("");
    const payload = {
      id: product?.id,
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      description: String(formData.get("description") ?? ""),
      imageUrl: String(formData.get("imageUrl") ?? ""),
      priceCents: Math.round(Number(formData.get("priceDollars") ?? 0) * 100),
      estimatedPrintMinutes: Number(formData.get("estimatedPrintMinutes") ?? 0),
      defaultMaterial: String(formData.get("defaultMaterial") ?? "PLA"),
      status: String(formData.get("status") ?? "ACTIVE")
    };
    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
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
        <Input id="imageUrl" name="imageUrl" defaultValue={product?.imageUrl} required />
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
          <Label htmlFor="defaultMaterial">Material</Label>
          <select id="defaultMaterial" name="defaultMaterial" defaultValue={product?.defaultMaterial ?? "PLA"} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"].map((material) => <option key={material}>{material}</option>)}
          </select>
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
