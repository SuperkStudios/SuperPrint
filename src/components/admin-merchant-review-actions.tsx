"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminMerchantReviewActions({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function act(action: "approve" | "reject" | "needs_review") {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/merchants/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setSaving(false);
    setMessage(response.ok ? "Updated. Refresh to see the latest status." : "Could not update merchant.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" onClick={() => act("approve")} disabled={saving}>Approve</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => act("needs_review")} disabled={saving}>Needs review</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => act("reject")} disabled={saving}>Reject</Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
