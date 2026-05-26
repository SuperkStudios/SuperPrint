"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Gauge,
  Layers3,
  PackageCheck,
  Play,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LoopState = {
  printer: null | {
    id: string;
    name: string;
    modelName: string;
    status: string;
    cameraStatus: string;
    currentFilament: null | {
      id: string;
      name: string;
      color: string;
      material: string;
      remainingGrams: number;
    };
  };
  nextAction: {
    type: string;
    title: string;
    detail: string;
    primaryButton: string;
  };
  nextPlate: null | Plate;
  plates: Plate[];
  batches: Array<{
    label: string;
    color: string;
    material: string | null;
    totalQuantity: number;
    plateCount: number;
  }>;
  readyOrders: Array<{
    id: string;
    orderNumber: string;
    productName: string;
    customerEmail: string;
    fulfillmentMethod: string;
    assemblyParts: Array<{
      productName: string;
      partName: string;
      role: string;
      color: string;
      quantityNeeded: number;
      quantityOnHand: number;
    }>;
  }>;
  maintenance: Array<{
    id: string;
    title: string;
    description: string;
    printerName: string;
    dueAt: string;
    status: string;
  }>;
  camera: null | {
    status: string;
    streamUrl: string;
    recentFrameAvailable: boolean;
    lastFrameAt: string | null;
  };
  telemetry: null | {
    progressPercent?: number | null;
    printStatus?: number | null;
    currentFileName?: string | null;
    remainingSeconds?: number | null;
    bedTemperatureC?: number | null;
    nozzleTemperatureC?: number | null;
  };
  counts: {
    plates: number;
    printing: number;
    readyToPrint: number;
    needsSlicing: number;
    readyOrders: number;
  };
};

type Plate = {
  id: string;
  status: string;
  productName: string;
  partName: string;
  color: string;
  quantityPlanned: number;
  plateIndex: number;
  plateCount: number;
  material: string;
  filament: null | { id: string; name: string; color: string; material: string };
  estimate: null | { minutes: number; grams: number; message?: string | null };
  estimateLabel: string;
  aiPlateCheck: { status?: string | null; confidence?: number | null; reason?: string | null };
  filamentConfirmedAt: string | null;
  plateClearConfirmedAt: string | null;
  partManifest: Array<{ partName: string; color: string; quantityPlanned: number; quantityPerProduct: number }>;
  orderRefs: Array<{ orderNumber: string; quantity: number; customerEmail: string }>;
};

const actionByType: Record<string, string> = {
  start_production: "startProduction",
  change_filament: "confirmFilamentChanged",
  camera_plate_check: "runAiPlateCheck",
  confirm_plate_clear: "confirmPlateClear",
  prepare_gcode: "sendPlateToPrinter",
  send_print: "sendPlateToPrinter",
  remove_finished_parts: "markPartsInventoried"
};

export function OperatorConsole() {
  const [state, setState] = useState<LoopState | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/production-loop", { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Production loop unavailable");
      return;
    }
    setError("");
    setState(payload);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function act(action: string, plateJobId?: string, orderId?: string) {
    setWorking(action);
    const response = await fetch("/api/admin/production-loop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, plateJobId, orderId })
    });
    const payload = await response.json().catch(() => null);
    setWorking("");
    if (!response.ok) {
      setError(payload?.error ?? "Action failed");
      return;
    }
    setError("");
    setState(payload.state ?? payload);
  }

  const nextActionName = state ? actionByType[state.nextAction.type] : undefined;
  const canRunPrimary = Boolean(nextActionName && (state?.nextPlate || nextActionName === "startProduction"));
  const progress = Math.max(0, Math.min(100, Number(state?.telemetry?.progressPercent ?? 0)));
  const totalMinutes = useMemo(() => {
    return state?.plates.reduce((total, plate) => total + (plate.estimate?.minutes ?? 0), 0) ?? 0;
  }, [state]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-muted-foreground">SuperPrint operator console</p>
            <h1 className="mt-2 text-3xl font-semibold text-foreground sm:text-5xl">Print the next right plate.</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button type="button" onClick={() => void act("startProduction")} disabled={working === "startProduction"}>
              <Sparkles className="size-4" />
              Rebuild Jobs
            </Button>
          </div>
        </header>

        {error ? (
          <div className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4" />
            <p>{error}</p>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <Badge className="border-emerald-300/30 bg-emerald-300/10 text-emerald-700 dark:text-emerald-100">
                  Next action
                </Badge>
                <h2 className="mt-4 text-3xl font-semibold text-foreground">{state?.nextAction.title ?? "Loading factory state"}</h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                  {state?.nextAction.detail ?? "Reading printer, slicer, plate, camera, and inventory state."}
                </p>
              </div>
              <Button
                type="button"
              className="h-12 px-5"
              onClick={() => nextActionName && void act(nextActionName, state?.nextPlate?.id)}
              disabled={!canRunPrimary || Boolean(working)}
              >
                {primaryIcon(state?.nextAction.type)}
                {working ? "Working..." : state?.nextAction.primaryButton ?? "Loading"}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={Gauge} label="Printer" value={state?.printer ? `${state.printer.name} - ${state.printer.status}` : "No printer"} />
              <Metric icon={Layers3} label="Plate backlog" value={`${state?.counts.plates ?? 0} plates`} />
              <Metric icon={Clock} label="Known slicer time" value={formatMinutes(totalMinutes)} />
              <Metric icon={PackageCheck} label="Assembly ready" value={`${state?.counts.readyOrders ?? 0} orders`} />
            </div>

            {state?.nextPlate ? <NextPlate plate={state.nextPlate} progress={progress} /> : null}
          </div>

          <aside className="grid gap-4">
            <StatusPanel
              title="Loaded filament"
              icon={Route}
              rows={[
                ["Current", state?.printer?.currentFilament?.name ?? "Not set"],
                ["Target", state?.nextPlate?.filament?.name ?? state?.nextPlate?.color ?? "No next plate"],
                ["Remaining", state?.printer?.currentFilament ? `${state.printer.currentFilament.remainingGrams}g` : "Unknown"]
              ]}
            />
            <StatusPanel
              title="Camera and telemetry"
              icon={Camera}
              rows={[
                ["Camera", state?.camera ? `${state.camera.status}${state.camera.recentFrameAvailable ? " - fresh frame" : ""}` : "No camera"],
                ["File", state?.telemetry?.currentFileName ?? "No active file"],
                ["Temps", formatTemps(state?.telemetry)]
              ]}
            />
            <StatusPanel
              title="Maintenance"
              icon={Wrench}
              rows={state?.maintenance.length
                ? state.maintenance.slice(0, 3).map((task) => [task.printerName, task.title])
                : [["Status", "No blocking tasks"]]}
            />
          </aside>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <Panel title="Color batches" icon={Route}>
            <div className="grid gap-2">
              {state?.batches.length ? state.batches.map((batch) => (
                <div key={`${batch.label}-${batch.totalQuantity}`} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <p className="font-medium text-foreground">{batch.label}</p>
                    <p className="text-sm text-muted-foreground">{batch.plateCount} plates - {batch.totalQuantity} parts</p>
                  </div>
                  <span className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: batch.color.toLowerCase() }} />
                </div>
              )) : <Empty label="No active batches" />}
            </div>
          </Panel>

          <Panel title="Plate queue" icon={Layers3}>
            <div className="grid gap-2">
              {state?.plates.length ? state.plates.slice(0, 8).map((plate) => (
                <div key={plate.id} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-muted text-muted-foreground">{plate.status}</Badge>
                      <p className="font-medium text-foreground">{plate.productName} - {plate.color} - plate {plate.plateIndex}/{plate.plateCount}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{partSummary(plate)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {plate.status === "PRINTED" ? (
                      <Button type="button" size="sm" variant="secondary" onClick={() => void act("markPartsInventoried", plate.id)} disabled={Boolean(working)}>
                        <Check className="size-4" />
                        Inventoried
                      </Button>
                    ) : null}
                    <span className="text-sm text-muted-foreground">{plate.estimateLabel}</span>
                  </div>
                </div>
              )) : <Empty label="Start production to build plate jobs" />}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function NextPlate({ plate, progress }: { plate: Plate; progress: number }) {
  return (
    <div className="mt-6 rounded-md border border-border bg-background p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Next plate</p>
          <h3 className="mt-1 text-2xl font-semibold text-foreground">{plate.productName} - {plate.color}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{partSummary(plate)}</p>
        </div>
        <Badge>{plate.status}</Badge>
      </div>
      <div className="mt-5 h-2 rounded bg-muted">
        <div className="h-2 rounded bg-primary" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric icon={Layers3} label="Plate" value={`${plate.plateIndex}/${plate.plateCount}`} />
        <Metric icon={Clock} label="Slicer estimate" value={plate.estimate ? `${plate.estimate.minutes} min - ${plate.estimate.grams}g` : "Needs G-code"} />
        <Metric icon={ShieldCheck} label="Plate check" value={plate.plateClearConfirmedAt ? "Cleared" : plate.aiPlateCheck.status ?? "Pending"} />
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusPanel({ title, icon, rows }: { title: string; icon: LucideIcon; rows: string[][] }) {
  return (
    <Panel title={title} icon={icon}>
      <div className="grid gap-3">
        {rows.map(([label, value]) => (
          <div key={`${label}-${value}`} className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{label}</div>;
}

function primaryIcon(type?: string) {
  if (type === "camera_plate_check") return <Camera className="size-4" />;
  if (type === "send_print") return <Play className="size-4" />;
  if (type === "maintenance_due") return <Wrench className="size-4" />;
  return <ChevronRight className="size-4" />;
}

function partSummary(plate: Plate) {
  return plate.partManifest.length
    ? plate.partManifest.map((part) => `${part.quantityPlanned} ${part.color} ${part.partName}`).join(", ")
    : `${plate.quantityPlanned} ${plate.partName}`;
}

function formatMinutes(minutes: number) {
  if (!minutes) return "Waiting for slicer";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatTemps(telemetry?: LoopState["telemetry"]) {
  if (!telemetry) return "No telemetry";
  const nozzle = telemetry.nozzleTemperatureC == null ? "?" : `${Math.round(telemetry.nozzleTemperatureC)}C`;
  const bed = telemetry.bedTemperatureC == null ? "?" : `${Math.round(telemetry.bedTemperatureC)}C`;
  return `Nozzle ${nozzle} - Bed ${bed}`;
}
