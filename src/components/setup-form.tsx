"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Boxes, CheckCircle2, Printer, ShieldCheck } from "lucide-react";
import {
  buildBootstrapSecuritySummary,
  type BootstrapFilamentInput,
  type BootstrapInputDraft
} from "@/domain/bootstrap";
import { DEFAULT_FILAMENT_ROLL_GRAMS, planFilamentStockAssignments, type CompletedPrinterHistoryItem } from "@/domain/filament-usage";
import { buildThemeCssVariables, normalizePrimaryColor } from "@/domain/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const steps = ["Owner", "Brand", "Printer", "Filament", "Prints", "Security"];

type FilamentStockDraft = Omit<BootstrapFilamentInput, "startingGrams" | "remainingGrams" | "assignedPrinterHistory" | "ignoredPrinterHistory"> & {
  localId: string;
  startingGrams?: number;
  remainingGrams?: number;
  assignedPrinterHistory?: BootstrapFilamentInput["assignedPrinterHistory"];
  ignoredPrinterHistory?: BootstrapFilamentInput["ignoredPrinterHistory"];
};

function createEmptySpool(index: number): FilamentStockDraft {
  return {
    localId: `spool-${Date.now()}-${index}`,
    material: "PLA",
    color: "",
    brand: "",
    startingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
    remainingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
    rollCostCents: 0,
    assignedPrinterHistory: [],
    ignoredPrinterHistory: []
  };
}

export function SetupForm() {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("Connection test has not run yet.");
  const [connectionOk, setConnectionOk] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("Printer history has not been pulled yet.");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [completedPrints, setCompletedPrints] = useState<CompletedPrinterHistoryItem[]>([]);
  const [printAssignments, setPrintAssignments] = useState<Record<string, string>>({});
  const [ignoredPrintIds, setIgnoredPrintIds] = useState<string[]>([]);
  const [stockSpools, setStockSpools] = useState<FilamentStockDraft[]>([createEmptySpool(0)]);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<BootstrapInputDraft>({
    owner: { name: "", email: "", password: "" },
    company: { brandName: "SuperPrint", primaryColor: "#0f8f7f", lowFilamentThresholdGrams: 150 },
    printer: {
      name: "centauri-carbon-1",
      publicName: "Centauri Carbon 1",
      internalIp: "192.168.10.125",
      controlApiUrl: "ws://192.168.10.125:3030/websocket"
    },
    filament: {
      material: "PLA",
      color: "",
      brand: "",
      startingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
      remainingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
      rollCostCents: 0,
      assignedPrinterHistory: [],
      ignoredPrinterHistory: []
    }
  });

  const assignmentPlan = planFilamentStockAssignments({
    spools: stockSpools,
    completedPrints,
    assignments: printAssignments,
    ignoredIds: ignoredPrintIds
  });
  const ignoredPrints = assignmentPlan.ignoredPrints;
  const totalAssignedPrintCount = assignmentPlan.spools.reduce((total, spool) => total + spool.assignedPrints.length, 0);
  const totalRemainingGrams = assignmentPlan.spools.reduce((total, spool) => total + spool.usage.remainingGrams, 0);
  const totalAssignedGrams = assignmentPlan.spools.reduce((total, spool) => total + spool.usage.assignedGrams, 0);

  useEffect(() => {
    const variables = buildThemeCssVariables(draft.company.primaryColor);
    for (const [key, value] of Object.entries(variables)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [draft.company.primaryColor]);

  const summary = useMemo(
    () =>
      buildBootstrapSecuritySummary({
        ownerEmail: draft.owner.email || "not set",
        brandName: draft.company.brandName || "not set",
        primaryColor: draft.company.primaryColor,
        lowFilamentThresholdGrams: draft.company.lowFilamentThresholdGrams,
        printerPublicName: draft.printer.publicName || "not set",
        printerInternalIp: draft.printer.internalIp || "not set",
        assignedPrintCount: totalAssignedPrintCount,
        ignoredPrintCount: ignoredPrints.length,
        filamentStock: assignmentPlan.spools.map((spool, index) => ({
          label: `Roll ${index + 1}: ${spool.color || "Uncolored"} ${spool.material} ${spool.brand || "Unbranded"}`,
          remainingGrams: spool.usage.remainingGrams
        }))
      }),
    [
      draft.company.brandName,
      draft.company.lowFilamentThresholdGrams,
      draft.company.primaryColor,
      draft.owner.email,
      draft.printer.internalIp,
      draft.printer.publicName,
      ignoredPrints.length,
      totalAssignedPrintCount,
      totalRemainingGrams,
      assignmentPlan.spools
    ]
  );

  function updateOwner(field: keyof BootstrapInputDraft["owner"], value: string) {
    setDraft((current) => ({ ...current, owner: { ...current.owner, [field]: value } }));
  }

  function updateCompany(field: keyof BootstrapInputDraft["company"], value: string) {
    setDraft((current) => ({ ...current, company: { ...current.company, [field]: value } }));
  }

  function updatePrinter(field: keyof BootstrapInputDraft["printer"], value: string) {
    setConnectionOk(false);
    setConnectionMessage("Connection test has not run yet.");
    setDraft((current) => ({ ...current, printer: { ...current.printer, [field]: value } }));
  }

  function updateSpool(localId: string, field: keyof FilamentStockDraft, value: string | number) {
    setStockSpools((current) => current.map((spool) => (spool.localId === localId ? { ...spool, [field]: value } : spool)));
  }

  function addSpool() {
    setStockSpools((current) => [...current, createEmptySpool(current.length)]);
  }

  function removeSpool(localId: string) {
    if (stockSpools.length === 1) return;
    setStockSpools((current) => current.filter((spool) => spool.localId !== localId));
    setPrintAssignments((current) =>
      Object.fromEntries(Object.entries(current).filter(([, assignedSpoolId]) => assignedSpoolId !== localId))
    );
  }

  function validateStep() {
    setMessage("");
    if (step === 0) {
      if (!draft.owner.name.trim() || !draft.owner.email.trim() || draft.owner.password.length < 12) {
        setMessage("Add owner name, email, and a password with at least 12 characters.");
        return false;
      }
    }
    if (step === 1 && !draft.company.brandName.trim()) {
      setMessage("Add a public brand name.");
      return false;
    }
    if (step === 2) {
      if (!draft.printer.name.trim() || !draft.printer.publicName.trim() || !draft.printer.internalIp.trim() || !draft.printer.controlApiUrl.trim()) {
        setMessage("Complete the printer profile before continuing.");
        return false;
      }
      if (!connectionOk) {
        setMessage("Run the printer connection test before continuing.");
        return false;
      }
    }
    if (step === 3) {
      if (!stockSpools.length || stockSpools.some((spool) => !spool.color.trim() || !spool.brand.trim())) {
        setMessage("Add material, color, brand, and cost for each filament roll before continuing.");
        return false;
      }
    }
    return true;
  }

  function next() {
    if (validateStep()) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  function back() {
    setMessage("");
    setStep((current) => Math.max(current - 1, 0));
  }

  async function testConnection() {
    setTestingConnection(true);
    setConnectionOk(false);
    setConnectionMessage("Testing printer endpoint...");
    setMessage("");

    try {
      const response = await fetch("/api/bootstrap/printer-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          internalIp: draft.printer.internalIp,
          controlApiUrl: draft.printer.controlApiUrl
        })
      });
      const result = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      setConnectionOk(Boolean(result.ok));
      setConnectionMessage(result.message ?? "Printer connection test failed.");
      setMessage(result.ok ? "" : result.message ?? "Printer connection test failed.");
    } catch (error) {
      setConnectionOk(false);
      setConnectionMessage(error instanceof Error ? error.message : "Printer connection test failed.");
      setMessage(error instanceof Error ? error.message : "Printer connection test failed.");
    } finally {
      setTestingConnection(false);
    }
  }

  async function pullPrinterHistory() {
    setHistoryLoading(true);
    setHistoryMessage("Pulling completed print history...");
    setMessage("");
    try {
      const response = await fetch("/api/bootstrap/printer-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlApiUrl: draft.printer.controlApiUrl })
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        completedPrints?: CompletedPrinterHistoryItem[];
      };
      setCompletedPrints(result.completedPrints ?? []);
      setHistoryMessage(result.message ?? "Printer history pull finished.");
      setMessage(result.ok ? "" : result.message ?? "Could not pull printer history.");
    } catch (error) {
      setCompletedPrints([]);
      setHistoryMessage(error instanceof Error ? error.message : "Could not pull printer history.");
      setMessage(error instanceof Error ? error.message : "Could not pull printer history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleIgnoredPrint(printId: string) {
    setPrintAssignments((current) => {
      const next = { ...current };
      delete next[printId];
      return next;
    });
    setIgnoredPrintIds((current) => (current.includes(printId) ? current.filter((id) => id !== printId) : [...current, printId]));
  }

  function assignPrintToSpool(printId: string, spoolId: string) {
    setIgnoredPrintIds((current) => current.filter((id) => id !== printId));
    setPrintAssignments((current) => {
      const next = { ...current };
      if (spoolId) {
        next[printId] = spoolId;
      } else {
        delete next[printId];
      }
      return next;
    });
  }

  async function finish() {
    if (!validateStep()) return;
    setSubmitting(true);
    setMessage("");
    const filaments = assignmentPlan.spools.map((plannedSpool) => ({
      material: plannedSpool.material as BootstrapFilamentInput["material"],
      color: plannedSpool.color,
      brand: plannedSpool.brand,
      startingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
      remainingGrams: Math.round(plannedSpool.usage.remainingGrams),
      rollCostCents: plannedSpool.rollCostCents ?? 0,
      assignedPrinterHistory: plannedSpool.assignedPrints.map((print) => ({
        ...print,
        materialCostCents: plannedSpool.usage.assignedPrintCosts.find((cost) => cost.id === print.id)?.materialCostCents
      })),
      ignoredPrinterHistory: ignoredPrints
    }));
    const payload: BootstrapInputDraft = {
      ...draft,
      filament: filaments[0],
      filaments
    };
    const response = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payload.owner.email,
          password: payload.owner.password,
          callbackURL: "/admin"
        })
      });
      window.location.href = "/admin";
      return;
    }
    setSubmitting(false);
    setMessage(result.error ?? "Setup failed");
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 rounded-lg border bg-card p-4 text-card-foreground shadow-sm md:grid-cols-6">
        {steps.map((label, index) => (
          <div key={label} className={`rounded-md border p-3 text-sm ${index === step ? "border-primary bg-primary/10 text-foreground" : "bg-muted/30 text-muted-foreground"}`}>
            <div className="flex items-center gap-2 font-medium">
              {index < step ? (
                <CheckCircle2 className="size-5 shrink-0 text-primary" />
              ) : (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] leading-none tabular-nums">
                  {index + 1}
                </span>
              )}
              {label}
            </div>
          </div>
        ))}
      </div>

      {step === 0 ? (
        <Panel title="Create owner account" description="This account becomes the permanent owner and unlocks the admin dashboard after setup.">
          <Field label="Owner name" value={draft.owner.name} onChange={(value) => updateOwner("name", value)} />
          <Field label="Owner email" type="email" value={draft.owner.email} onChange={(value) => updateOwner("email", value)} />
          <Field label="Password" type="password" value={draft.owner.password} onChange={(value) => updateOwner("password", value)} />
        </Panel>
      ) : null}

      {step === 1 ? (
        <Panel title="Brand and platform settings" description="Set the public name, theme color, and platform-level low filament alert threshold.">
          <Field label="Public brand name" value={draft.company.brandName} onChange={(value) => updateCompany("brandName", value)} />
          <div className="grid gap-2">
            <Label htmlFor="primary-color">Primary color</Label>
            <div className="flex gap-2">
              <Input id="primary-color" type="color" value={normalizePrimaryColor(draft.company.primaryColor)} onChange={(event) => updateCompany("primaryColor", event.target.value)} className="h-10 w-16 p-1" />
              <Input value={draft.company.primaryColor ?? "#0f8f7f"} onChange={(event) => updateCompany("primaryColor", event.target.value)} />
            </div>
          </div>
          <Field
            label="Low filament alert grams"
            type="number"
            value={String(draft.company.lowFilamentThresholdGrams ?? 150)}
            onChange={(value) => updateCompany("lowFilamentThresholdGrams", Number(value) as never)}
          />
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="Printer setup and connection test" description="Register the first printer profile. The test opens the Centauri Carbon SDCP WebSocket and then closes it without sending printer commands.">
          <Field label="Internal printer name" value={draft.printer.name} onChange={(value) => updatePrinter("name", value)} />
          <Field label="Public printer name" value={draft.printer.publicName} onChange={(value) => updatePrinter("publicName", value)} />
          <Field label="Internal IP or hostname" value={draft.printer.internalIp} onChange={(value) => updatePrinter("internalIp", value)} />
          <Field label="Control API URL" value={draft.printer.controlApiUrl} onChange={(value) => updatePrinter("controlApiUrl", value)} />

          <div className="md:col-span-2 rounded-md border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Printer className="size-4 text-primary" />
                <p className="font-medium">Printer connection test</p>
              </div>
              <Button type="button" variant="secondary" onClick={testConnection} disabled={testingConnection}>
                {testingConnection ? "Testing..." : "Test connection"}
              </Button>
            </div>
            <p className={`mt-3 text-sm ${connectionOk ? "text-primary" : "text-muted-foreground"}`}>{connectionMessage}</p>
          </div>
        </Panel>
      ) : null}

      {step === 3 ? (
        <Panel title="Filament stock" description="Add every roll currently in stock. New rolls start at 1kg; completed prints are assigned on the next step.">
          <div className="md:col-span-2 grid gap-3">
            {stockSpools.map((spool, index) => (
              <div key={spool.localId} className="grid gap-3 rounded-md border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Roll {index + 1}</p>
                    <p className="text-sm text-muted-foreground">Starting weight {DEFAULT_FILAMENT_ROLL_GRAMS}g</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => removeSpool(spool.localId)} disabled={stockSpools.length === 1}>
                    Remove
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="grid gap-2">
                    <Label htmlFor={`filamentMaterial-${spool.localId}`}>Material</Label>
                    <select
                      id={`filamentMaterial-${spool.localId}`}
                      value={spool.material}
                      onChange={(event) => updateSpool(spool.localId, "material", event.target.value)}
                      className="h-10 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {["PLA", "PLA_PLUS", "PETG", "ABS", "TPU", "NYLON", "RESIN"].map((material) => (
                        <option key={material}>{material}</option>
                      ))}
                    </select>
                  </div>
                  <InlineField id={`color-${spool.localId}`} label="Color" value={spool.color} onChange={(value) => updateSpool(spool.localId, "color", value)} />
                  <InlineField id={`brand-${spool.localId}`} label="Brand" value={spool.brand} onChange={(value) => updateSpool(spool.localId, "brand", value)} />
                  <InlineField
                    id={`cost-${spool.localId}`}
                    label="Cost dollars"
                    type="number"
                    value={String(((spool.rollCostCents ?? 0) / 100).toFixed(2))}
                    onChange={(value) => updateSpool(spool.localId, "rollCostCents", Math.round(Number(value) * 100))}
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={addSpool} className="w-fit">
              Add another roll
            </Button>
          </div>
        </Panel>
      ) : null}

      {step === 4 ? (
        <Panel title="Assign completed prints" description="Pull completed printer history, choose which roll each completed print used, or ignore test prints you do not want tracked.">
          <div className="md:col-span-2 rounded-md border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 text-primary" />
                <p className="font-medium">Completed printer history</p>
              </div>
              <Button type="button" variant="secondary" onClick={pullPrinterHistory} disabled={historyLoading || !connectionOk}>
                {historyLoading ? "Pulling..." : "Pull completed prints"}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{historyMessage}</p>
            <div className="mt-4 grid gap-2">
              {completedPrints.length ? (
                completedPrints.map((print) => (
                  <div key={print.id} className="grid min-w-0 gap-3 rounded border p-3 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_auto] lg:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium" title={print.name}>
                        {print.name}
                      </p>
                      <p className="mt-1 text-muted-foreground">{print.gramsUsed ?? 0}g</p>
                    </div>
                    <select
                      value={ignoredPrintIds.includes(print.id) ? "" : printAssignments[print.id] ?? ""}
                      onChange={(event) => assignPrintToSpool(print.id, event.target.value)}
                      disabled={ignoredPrintIds.includes(print.id)}
                      className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Leave unassigned</option>
                      {stockSpools.map((spool, index) => (
                        <option key={spool.localId} value={spool.localId}>
                          Roll {index + 1}: {spool.color || "color"} {spool.material} {spool.brand || "brand"}
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-start lg:justify-end">
                      <Button type="button" size="sm" variant={ignoredPrintIds.includes(print.id) ? "secondary" : "outline"} onClick={() => toggleIgnoredPrint(print.id)}>
                        Ignore
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">No completed prints with material usage loaded yet.</p>
              )}
            </div>
          </div>

          <div className="md:col-span-2 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm md:grid-cols-3">
            <Metric label="Stock rolls" value={String(stockSpools.length)} />
            <Metric label="Assigned used" value={`${totalAssignedGrams}g`} />
            <Metric label="Remaining" value={`${totalRemainingGrams}g`} />
            {assignmentPlan.spools.map((spool, index) => (
              <Metric key={spool.localId} label={`Roll ${index + 1}`} value={`${spool.usage.remainingGrams}g left`} />
            ))}
          </div>
        </Panel>
      ) : null}

      {step === 5 ? (
        <Panel title="Security summary" description="SuperPrint will hash the owner password, lock bootstrap after setup, and keep physical printer control behind the operator/SuperNode gate.">
          <div className="md:col-span-2 rounded-md border bg-muted/30 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <p className="font-medium">Setup sheet</p>
            </div>
            <pre className="whitespace-pre-wrap rounded border bg-background p-4 text-sm leading-6 text-muted-foreground">{summary}</pre>
            <div className="mt-3">
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                Print setup sheet
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={back} disabled={step === 0 || submitting}>
          <ArrowLeft className="mr-2 size-4" /> Back
        </Button>
        <div className="flex items-center gap-3">
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          {step < steps.length - 1 ? (
            <Button type="button" onClick={next}>
              Next <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : (
            <Button type="button" onClick={finish} disabled={submitting}>
              {submitting ? "Finishing..." : "Finish and enter admin"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-lg border bg-card p-5 text-card-foreground shadow-sm">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replaceAll(" ", "-");
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  );
}

function InlineField({
  id,
  label,
  value,
  onChange,
  type = "text"
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
