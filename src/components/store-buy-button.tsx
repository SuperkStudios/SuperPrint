"use client";

import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StoreBuyButton({
  productId,
  signedIn,
  selectedMaterial,
  selectedColor,
  selectedFilamentMaterialId,
  selectedFilamentMaterialIds,
  selectedColors,
  fulfillment,
  loginNext,
  disabled = false
}: {
  productId: string;
  signedIn: boolean;
  selectedMaterial?: string;
  selectedColor?: string;
  selectedFilamentMaterialId?: string;
  selectedFilamentMaterialIds?: string[];
  selectedColors?: string[];
  fulfillment: {
    method: "SHIP" | "PICKUP";
    address: {
      name: string;
      street1: string;
      street2?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      phone?: string;
      email?: string;
    };
  };
  loginNext?: string;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function buy() {
    if (!signedIn) {
      window.location.href = `/login?mode=signup&next=${encodeURIComponent(loginNext ?? window.location.pathname)}`;
      return;
    }
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, selectedMaterial, selectedColor, selectedFilamentMaterialId, selectedFilamentMaterialIds, selectedColors, quantity: 1 })
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Could not add this item.");
      return;
    }
    window.location.href = "/cart";
  }

  return (
    <div>
      <Button size="sm" onClick={buy} disabled={loading || disabled}>
        <ShoppingCart className="size-4" />
        {loading ? "Adding..." : "Add to cart"}
      </Button>
      {message ? <p className="mt-2 text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
