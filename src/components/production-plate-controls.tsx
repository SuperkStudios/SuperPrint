"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ProductionPlateControls({ jobId }: { jobId?: string }) {
  const [message, setMessage] = useState("");

  async function post(body: unknown) {
    setMessage("Working...");
    const response = await fetch("/api/admin/production-plates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error ?? "Update failed");
      return;
    }
    setMessage("Updated");
    window.location.reload();
  }

  if (!jobId) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => post({ action: "rebuild" })}>Rebuild plate jobs</Button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => post({ action: "status", id: jobId, status: "NEEDS_FILAMENT" })}>Needs filament</Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => post({ action: "status", id: jobId, status: "PRINTING" })}>Printing</Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => post({ action: "status", id: jobId, status: "PRINTED" })}>Printed</Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => post({ action: "status", id: jobId, status: "INVENTORIED" })}>Inventoried</Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
