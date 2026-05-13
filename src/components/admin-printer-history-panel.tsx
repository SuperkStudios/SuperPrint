"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type HistoryPrint = {
  id: string;
  name: string;
  status: string;
  gramsUsed?: number;
  gramsSource?: string;
  completedAt?: string;
  printedLayers?: number;
  totalLayers?: number;
  material?: string;
};

type Spool = {
  id: string;
  label: string;
};

export function AdminPrinterHistoryPanel({ spools }: { spools: Spool[] }) {
  const [prints, setPrints] = useState<HistoryPrint[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [manualGrams, setManualGrams] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Pull printer history to review completed, stopped, and failed prints.");
  const [loading, setLoading] = useState(false);

  async function pullHistory() {
    setLoading(true);
    setMessage("Pulling printer history...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);
    try {
      const response = await fetch("/api/admin/printer-history", { method: "POST", signal: controller.signal });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(body?.message ?? body?.error ?? "Could not pull printer history.");
        return;
      }
      setPrints(body.completedPrints ?? []);
      setMessage(body.message ?? "History updated.");
    } catch (error) {
      setMessage(error instanceof DOMException && error.name === "AbortError" ? "Printer history pull timed out. Try again or check the printer connection." : "Could not pull printer history.");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function act(action: "assign" | "ignore" | "importCompleted", print: HistoryPrint) {
    const spoolId = assignments[print.id];
    const gramsUsed = Number(manualGrams[print.id] ?? print.gramsUsed ?? 0);
    if ((action === "assign" || action === "importCompleted") && !spoolId) {
      setMessage("Choose a filament roll first.");
      return;
    }
    if ((action === "assign" || action === "importCompleted") && (!Number.isFinite(gramsUsed) || gramsUsed <= 0)) {
      setMessage("Enter grams used before assigning this print.");
      return;
    }
    const response = await fetch("/api/admin/printer-history", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, print: { ...print, gramsUsed }, spoolId })
    });
    const body = await response.json().catch(() => null);
    setMessage(response.ok ? body?.message ?? "Saved." : body?.error ?? "Action failed.");
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button type="button" onClick={pullHistory} disabled={loading}>
          {loading ? "Pulling..." : "Pull printer history"}
        </Button>
      </div>
      <div className="overflow-hidden rounded border">
        <div className="grid grid-cols-[1fr_110px_130px_180px_230px] bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Print file</span>
          <span>Status</span>
          <span>Grams</span>
          <span>Filament roll</span>
          <span>Actions</span>
        </div>
        {prints.length ? prints.map((print) => (
          <div key={print.id} className="grid grid-cols-[minmax(0,1fr)_110px_130px_180px_230px] items-center gap-3 border-t px-3 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{print.name}</p>
              <p className="text-xs text-muted-foreground">
                {print.completedAt ? new Date(print.completedAt).toLocaleString() : "End time unknown"}
                {print.printedLayers && print.totalLayers ? ` · ${print.printedLayers}/${print.totalLayers} layers` : ""}
                {print.material ? ` · ${print.material}` : ""}
              </p>
            </div>
            <span className={`w-fit rounded-full px-2 py-1 text-xs font-medium ${statusClassName(print.status)}`}>{print.status.toLowerCase()}</span>
            <input
              value={manualGrams[print.id] ?? (print.gramsUsed ? String(print.gramsUsed) : "")}
              onChange={(event) => setManualGrams((current) => ({ ...current, [print.id]: event.target.value }))}
              placeholder={print.gramsSource ? print.gramsSource.toLowerCase().replaceAll("_", " ") : "grams"}
              type="number"
              min="0.01"
              step="0.01"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            />
            <select
              value={assignments[print.id] ?? ""}
              onChange={(event) => setAssignments((current) => ({ ...current, [print.id]: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Select roll</option>
              {spools.map((spool) => <option key={spool.id} value={spool.id}>{spool.label}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => act("assign", print)}>Assign</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => act("importCompleted", print)}>Import</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => act("ignore", print)}>Ignore</Button>
            </div>
          </div>
        )) : (
          <div className="border-t p-6 text-sm text-muted-foreground">No pulled printer-history rows yet.</div>
        )}
      </div>
    </div>
  );
}

function statusClassName(status: string) {
  if (status === "COMPLETED") return "bg-emerald-500/10 text-emerald-700";
  if (status === "FAILED") return "bg-red-500/10 text-red-700";
  if (status === "STOPPED") return "bg-amber-500/10 text-amber-700";
  return "bg-muted text-muted-foreground";
}
