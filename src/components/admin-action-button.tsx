"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AdminActionButton({
  endpoint,
  payload,
  children,
  variant = "outline",
  confirm
}: {
  endpoint: string;
  payload: Record<string, unknown>;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
  confirm?: string;
}) {
  const [message, setMessage] = useState("");

  async function run() {
    if (confirm && !window.confirm(confirm)) {
      return;
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setMessage(response.ok ? "Updated" : "Blocked");
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant={variant} onClick={run}>
        {children}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
