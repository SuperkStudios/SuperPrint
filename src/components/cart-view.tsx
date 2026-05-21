"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/utils";

type CartSummary = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl: string;
    quantity: number;
    selectedMaterial?: string | null;
    selectedColor?: string | null;
    selectedColors?: string[];
    unitPriceCents: number;
    subtotalCents: number;
  }>;
  subtotalCents: number;
  itemCount: number;
};

export function CartView({ initialSummary }: { initialSummary: CartSummary }) {
  const [summary, setSummary] = useState(initialSummary);
  const [loadingItemId, setLoadingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function updateQuantity(itemId: string, quantity: number) {
    setLoadingItemId(itemId);
    setMessage("");
    const response = await fetch("/api/cart", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId, quantity })
    });
    const body = await response.json().catch(() => null);
    setLoadingItemId(null);
    if (!response.ok) {
      setMessage(body?.error ?? "Could not update cart.");
      return;
    }
    setSummary(body);
  }

  async function removeItem(itemId: string) {
    setLoadingItemId(itemId);
    setMessage("");
    const response = await fetch("/api/cart", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId })
    });
    const body = await response.json().catch(() => null);
    setLoadingItemId(null);
    if (!response.ok) {
      setMessage(body?.error ?? "Could not remove item.");
      return;
    }
    setSummary(body);
  }

  if (!summary.items.length) {
    return (
      <div className="rounded-md border bg-card p-6 text-card-foreground">
        <p className="font-medium">Your cart is empty.</p>
        <Button asChild className="mt-4"><Link href="/store">Browse store</Link></Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid gap-3">
        {summary.items.map((item) => (
          <div key={item.id} className="grid gap-4 rounded-md border bg-card p-4 text-card-foreground sm:grid-cols-[96px_1fr_auto]">
            <Link href={`/store/${item.slug}`} className="h-24 overflow-hidden rounded-md border bg-muted/20">
              <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
            </Link>
            <div>
              <Link href={`/store/${item.slug}`} className="font-semibold hover:underline">{item.name}</Link>
              <p className="mt-1 text-sm text-muted-foreground">{(item.selectedColors?.length ? item.selectedColors.join(" + ") : item.selectedColor)} {item.selectedMaterial}</p>
              <p className="mt-2 text-sm">{money(item.unitPriceCents)} each</p>
            </div>
            <div className="flex items-center gap-2 sm:justify-end">
              <Button type="button" size="icon" variant="outline" disabled={loadingItemId === item.id} onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Decrease quantity">
                <Minus className="size-4" />
              </Button>
              <span className="grid h-9 w-10 place-items-center rounded-md border text-sm font-medium">{item.quantity}</span>
              <Button type="button" size="icon" variant="outline" disabled={loadingItemId === item.id} onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity">
                <Plus className="size-4" />
              </Button>
              <Button type="button" size="icon" variant="outline" disabled={loadingItemId === item.id} onClick={() => removeItem(item.id)} aria-label="Remove item">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </div>
      <aside className="h-fit rounded-md border bg-card p-4 text-card-foreground">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Items</span>
          <span>{summary.itemCount}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3 font-semibold">
          <span>Subtotal</span>
          <span>{money(summary.subtotalCents)}</span>
        </div>
        <Button asChild className="mt-4 w-full"><Link href="/checkout">Checkout</Link></Button>
        <Button asChild variant="outline" className="mt-2 w-full"><Link href="/store">Keep shopping</Link></Button>
      </aside>
    </div>
  );
}
