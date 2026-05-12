"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft, ArrowRight, Boxes, CheckCircle2, Printer, ShieldCheck } from "lucide-react";
import {
  buildBootstrapSecuritySummary,
  type BootstrapInputDraft
} from "@/domain/bootstrap";
import { DEFAULT_FILAMENT_ROLL_GRAMS, planCompletedPrintAssignments, type CompletedPrinterHistoryItem } from "@/domain/filament-usage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StorageCheck = { storageClass: string; path: string; configured: boolean };

const steps = ["Owner", "Brand", "Printer", "Filament", "Prints", "Security"];

export function SetupForm({ storageChecks: _storageChecks, storageRoot: _storageRoot }: { storageChecks: StorageCheck[]; storageRoot: string }) {
  void _storageChecks;
  void _storageRoot;
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("Connection test has not run yet.");
  const [connectionOk, setConnectionOk] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("Printer history has not been pulled yet.");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [completedPrints, setCompletedPrints] = useState<CompletedPrinterHistoryItem[]>([]);
  const [assignedPrintIds, setAssignedPrintIds] = useState<string[]>([]);
  const [ignoredPrintIds, setIgnoredPrintIds] = useState<string[]>([]);
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

  const assignmentPlan = planCompletedPrintAssignments({
    rollCostCents: draft.filament.rollCostCents ?? 0,
    completedPrints,
    assignedIds: assignedPrintIds,
    ignoredIds: ignoredPrintIds
  });
  const assignedPrints = assignmentPlan.assignedPrints;
  const ignoredPrints = assignmentPlan.ignoredPrints;
  const filamentUsage = assignmentPlan.usage;

  const summary = useMemo(
    () =>
      buildBootstrapSecuritySummary({
        ownerEmail: draft.owner.email || "not set",
        brandName: draft.company.brandName || "not set",
        primaryColor: draft.company.primaryColor,
        lowFilamentThresholdGrams: draft.company.lowFilamentThresholdGrams,
        printerPublicName: draft.printer.publicName || "not set",
        printerInternalIp: draft.printer.internalIp || "not set",
        assignedPrintCount: assignedPrints.length,
        ignoredPrintCount: ignoredPrints.length,
        remainingGrams: filamentUsage.remainingGrams
      }),
    [
      assignedPrints.length,
      draft.company.brandName,
      draft.company.lowFilamentThresholdGrams,
      draft.company.primaryColor,
      draft.owner.email,
      draft.printer.internalIp,
      draft.printer.publicName,
      filamentUsage.remainingGrams,
      ignoredPrints.length
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

  function updateFilament(field: keyof BootstrapInputDraft["filament"], value: string | number) {
    setDraft((current) => ({ ...current, filament: { ...current.filament, [field]: value } }));
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
      if (!draft.filament.color.trim() || !draft.filament.brand.trim()) {
        setMessage("Add the first filament roll details before continuing.");
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

  function toggleAssignedPrint(printId: string) {
    setIgnoredPrintIds((current) => current.filter((id) => id !== printId));
    setAssignedPrintIds((current) => (current.includes(printId) ? current.filter((id) => id !== printId) : [...current, printId]));
  }

  function toggleIgnoredPrint(printId: string) {
    setAssignedPrintIds((current) => current.filter((id) => id !== printId));
    setIgnoredPrintIds((current) => (current.includes(printId) ? current.filter((id) => id !== printId) : [...current, printId]));
  }

  async function finish() {
    if (!validateStep()) return;
    setSubmitting(true);
    setMessage("");
    const assignedPrinterHistory = assignedPrints.map((print) => ({
      ...print,
      materialCostCents: filamentUsage.assignedPrintCosts.find((cost) => cost.id === print.id)?.materialCostCents
    }));
    const payload: BootstrapInputDraft = {
      ...draft,
      filament: {
        ...draft.filament,
        startingGrams: DEFAULT_FILAMENT_ROLL_GRAMS,
        remainingGrams: filamentUsage.remainingGrams,
        assignedPrinterHistory,
        ignoredPrinterHistory: ignoredPrints
      }
    };
    const response = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      await signIn("credentials", {
        email: payload.owner.email,
        password: payload.owner.password,
        callbackUrl: "/admin"
      });
      return;
    }
    setSubmitting(false);
    setMessage(result.error ?? "Setup failed");
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 rounded-lg border bg-white p-4 md:grid-cols-6">
        {steps.map((label, index) => (
          <div key={label} className={`rounded-md border p-3 text-sm ${index === step ? "border-primary bg-primary/5" : "bg-muted/30"}`}>
            <div className="flex items-center gap-2 font-medium">
              {index < step ? <CheckCircle2 className="size-4 text-primary" /> : <span className="grid size-4 place-items-center rounded-full border text-[10px]">{index + 1}</span>}
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
              <Input id="primary-color" type="color" value={draft.company.primaryColor ?? "#0f8f7f"} onChange={(event) => updateCompany("primaryColor", event.target.value)} className="h-10 w-16 p-1" />
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

          <div className="md:col-span-2 rounded-md border p-4">
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
        <Panel title="Filament roll" description="Add the first roll. New rolls start at 1kg; completed prints are assigned on the next step.">
          <div className="grid gap-2">
            <Label htmlFor="filamentMaterial">Material</Label>
            <select
              id="filamentMaterial"
              value={draft.filament.material}
              onChange={(event) => updateFilament("material", event.target.value as BootstrapInputDraft["filament"]["material"])}
              className="h-10 rounded-md border bg-white px-3 text-sm"
            >
              {["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"].map((material) => (
                <option key={material}>{material}</option>
              ))}
            </select>
          </div>
          <Field label="Filament color" value={draft.filament.color} onChange={(value) => updateFilament("color", value)} />
          <Field label="Filament brand" value={draft.filament.brand} onChange={(value) => updateFilament("brand", value)} />
          <Field label="Roll cost dollars" type="number" value={String(((draft.filament.rollCostCents ?? 0) / 100).toFixed(2))} onChange={(value) => updateFilament("rollCostCents", Math.round(Number(value) * 100))} />
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <p className="text-muted-foreground">Starting weight</p>
            <p className="mt-1 text-lg font-semibold">{DEFAULT_FILAMENT_ROLL_GRAMS}g</p>
          </div>
        </Panel>
      ) : null}

      {step === 4 ? (
        <Panel title="Assign completed prints" description="Pull completed printer history, assign prints to this roll, or ignore test prints you do not want tracked.">
          <div className="md:col-span-2 rounded-md border p-4">
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
                  <div key={print.id} className="grid gap-3 rounded border p-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
                    <span>
                      <span className="font-medium">{print.name}</span>
                      <span className="ml-2 text-muted-foreground">{print.gramsUsed ?? 0}g</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Button type="button" size="sm" variant={assignedPrintIds.includes(print.id) ? "default" : "outline"} onClick={() => toggleAssignedPrint(print.id)}>
                        Assign
                      </Button>
                      <Button type="button" size="sm" variant={ignoredPrintIds.includes(print.id) ? "secondary" : "outline"} onClick={() => toggleIgnoredPrint(print.id)}>
                        Ignore
                      </Button>
                    </span>
                  </div>
                ))
              ) : (
                <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">No completed prints with material usage loaded yet.</p>
              )}
            </div>
          </div>

          <div className="md:col-span-2 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm md:grid-cols-4">
            <Metric label="Starting" value={`${draft.filament.startingGrams ?? 1000}g`} />
            <Metric label="Assigned used" value={`${filamentUsage.assignedGrams}g`} />
            <Metric label="Remaining" value={`${filamentUsage.remainingGrams}g`} />
            <Metric label="Cost / gram" value={`$${(filamentUsage.costPerGramCents / 100).toFixed(3)}`} />
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
            <pre className="whitespace-pre-wrap rounded border bg-white p-4 text-sm leading-6 text-muted-foreground">{summary}</pre>
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
    <section className="space-y-5 rounded-lg border bg-white p-5">
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
