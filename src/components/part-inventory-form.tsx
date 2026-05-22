"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PartInventoryForm({
  productPartId,
  initialColor,
  initialQuantity,
  initialLocation,
  initialNotes
}: {
  productPartId: string;
  initialColor?: string;
  initialQuantity?: number;
  initialLocation?: string;
  initialNotes?: string | null;
}) {
  const [color, setColor] = useState(initialColor ?? "");
  const [quantityOnHand, setQuantityOnHand] = useState(initialQuantity ?? 0);
  const [location, setLocation] = useState(initialLocation ?? "Storage");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Saving...");
    const response = await fetch("/api/admin/parts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productPartId, color, quantityOnHand, location, notes })
    });
    const body = await response.json().catch(() => null);
    setMessage(response.ok ? "Saved" : body?.error ?? "Could not save");
  }

  return (
    <form onSubmit={submit} className="grid gap-2 md:grid-cols-[1fr_90px_120px_1fr_auto]">
      <Input value={color} onChange={(event) => setColor(event.target.value)} placeholder="Color" required />
      <Input type="number" min={0} value={quantityOnHand} onChange={(event) => setQuantityOnHand(Number(event.target.value))} aria-label="Quantity on hand" />
      <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location" required />
      <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes" />
      <div className="flex items-center gap-2">
        <Button type="submit" size="icon" variant="outline" aria-label="Save inventory">
          <Save className="h-4 w-4" />
        </Button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    </form>
  );
}
