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
  loginNext,
  disabled = false
}: {
  productId: string;
  signedIn: boolean;
  selectedMaterial?: string;
  selectedColor?: string;
  selectedFilamentMaterialId?: string;
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
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, selectedMaterial, selectedColor, selectedFilamentMaterialId })
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(body?.error ?? "Checkout failed.");
      return;
    }
    if (body.checkoutUrl?.startsWith("/api/orders/")) {
      await fetch(body.checkoutUrl, { method: "POST" });
      window.location.href = "/orders";
      return;
    }
    window.location.href = body.checkoutUrl ?? "/orders";
  }

  return (
    <div>
      <Button size="sm" onClick={buy} disabled={loading || disabled}>
        <ShoppingCart className="size-4" />
        {loading ? "Opening..." : "Checkout"}
      </Button>
      {message ? <p className="mt-2 text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
