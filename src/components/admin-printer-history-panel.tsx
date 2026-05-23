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
  printTimeSeconds?: number;
  printedLayers?: number;
  totalLayers?: number;
  material?: string;
};

type Spool = {
  id: string;
  label: string;
};

const pageSize = 50;

export function AdminPrinterHistoryPanel({ spools }: { spools: Spool[] }) {
  const [prints, setPrints] = useState<HistoryPrint[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Pull printer history to review completed, stopped, and failed prints.");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(prints.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pagePrints = prints.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

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
      setPage(0);
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
    const gramsUsed = Number(print.gramsUsed ?? 0);
    if ((action === "assign" || action === "importCompleted") && !spoolId) {
      setMessage("Choose a filament roll first.");
      return;
    }
    if ((action === "assign" || action === "importCompleted") && (!Number.isFinite(gramsUsed) || gramsUsed <= 0)) {
      setMessage("This printer-history row did not include material usage. Pull history again or check that G-code enrichment is available.");
      return;
    }
    const response = await fetch("/api/admin/printer-history", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, print: { ...print, gramsUsed }, spoolId })
    });
    const body = await response.json().catch(() => null);
    if (response.ok) {
      setPrints((current) => current.filter((item) => item.id !== print.id));
    }
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
      {prints.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Showing {currentPage * pageSize + 1}-{Math.min(prints.length, (currentPage + 1) * pageSize)} of {prints.length}
          </span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>Previous</Button>
            <Button type="button" size="sm" variant="outline" disabled={currentPage >= totalPages - 1} onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}>Next</Button>
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden rounded border">
        <div className="grid grid-cols-[1fr_110px_130px_180px_230px] bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Print file</span>
          <span>Status</span>
          <span>Grams</span>
          <span>Filament roll</span>
          <span>Actions</span>
        </div>
        {pagePrints.length ? pagePrints.map((print) => (
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
            <div className="text-sm">
              {print.gramsUsed ? (
                <>
                  <p className="font-medium">{Math.round(print.gramsUsed)}g</p>
                  <p className="text-xs text-muted-foreground">{print.gramsSource ? print.gramsSource.toLowerCase().replaceAll("_", " ") : "printer"}</p>
                </>
              ) : (
                <p className="text-xs text-destructive">No printer grams</p>
              )}
            </div>
            <select
              value={assignments[print.id] ?? ""}
              onChange={(event) => setAssignments((current) => ({ ...current, [print.id]: event.target.value }))}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select roll</option>
              {spools.map((spool) => <option key={spool.id} value={spool.id}>{spool.label}</option>)}
            </select>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => act("assign", print)}>Save usage</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => act("importCompleted", print)}>Import stats</Button>
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
