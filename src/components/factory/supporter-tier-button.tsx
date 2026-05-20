"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SupporterTierButton({ tierId }: { tierId: string }) {
  const [loading, setLoading] = useState(false);

  async function join() {
    setLoading(true);
    const response = await fetch("/api/factory/supporter-tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId })
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    if (response.ok) window.location.reload();
  }

  return (
    <Button type="button" size="sm" variant="outline" className="mt-3 bg-card/50" disabled={loading} onClick={join}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
      Select tier
    </Button>
  );
}
