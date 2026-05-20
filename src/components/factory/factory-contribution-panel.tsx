"use client";

import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function FactoryContributionPanel({ goalId }: { goalId: string }) {
  const [amount, setAmount] = useState(10);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function contribute(amountDollars = amount) {
    setLoading(true);
    setError("");
    const response = await fetch("/api/factory/contributions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId, amountCents: Math.round(amountDollars * 100), message, anonymous })
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Contribution could not be created.");
      return;
    }
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        {[5, 20, 50].map((preset) => (
          <Button key={preset} type="button" variant="outline" className="bg-card/50" disabled={loading} onClick={() => contribute(preset)}>
            ${preset}
          </Button>
        ))}
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`custom-${goalId}`}>Custom amount</Label>
        <div className="flex gap-2">
          <Input id={`custom-${goalId}`} type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
          <Button type="button" disabled={loading} onClick={() => contribute()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Back
          </Button>
        </div>
      </div>
      <Input value={message} maxLength={240} placeholder="Optional supporter message" onChange={(event) => setMessage(event.target.value)} />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
        Show as anonymous
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
