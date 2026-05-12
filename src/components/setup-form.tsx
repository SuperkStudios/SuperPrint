"use client";

import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { ArrowLeft, ArrowRight, CheckCircle2, Printer, ShieldCheck } from "lucide-react";
import {
  buildBootstrapSecuritySummary,
  type BootstrapInputDraft
} from "@/domain/bootstrap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StorageCheck = { storageClass: string; path: string; configured: boolean };

const steps = ["Owner", "Brand", "Printer", "Security"];

export function SetupForm({ storageChecks, storageRoot }: { storageChecks: StorageCheck[]; storageRoot: string }) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("Connection test has not run yet.");
  const [connectionOk, setConnectionOk] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<BootstrapInputDraft>({
    owner: { name: "", email: "", password: "" },
    company: { brandName: "SuperPrint" },
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
      remainingGrams: 1000,
      thresholdGrams: 150,
      location: ""
    }
  });

  const summary = useMemo(
    () =>
      buildBootstrapSecuritySummary({
        ownerEmail: draft.owner.email || "not set",
        brandName: draft.company.brandName || "not set",
        printerPublicName: draft.printer.publicName || "not set",
        printerInternalIp: draft.printer.internalIp || "not set",
        storageRoot,
        storageClasses: storageChecks.map((check) => check.storageClass)
      }),
    [draft.company.brandName, draft.owner.email, draft.printer.internalIp, draft.printer.publicName, storageChecks, storageRoot]
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
      if (!draft.filament.color.trim() || !draft.filament.brand.trim() || !draft.filament.location.trim()) {
        setMessage("Add the first filament spool details before continuing.");
        return false;
      }
      if (!connectionOk) {
        setMessage("Run the printer connection test before continuing.");
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

  async function finish() {
    if (!validateStep()) return;
    setSubmitting(true);
    setMessage("");
    const response = await fetch("/api/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      await signIn("credentials", {
        email: draft.owner.email,
        password: draft.owner.password,
        callbackUrl: "/admin"
      });
      return;
    }
    setSubmitting(false);
    setMessage(result.error ?? "Setup failed");
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-2 rounded-lg border bg-white p-4 md:grid-cols-4">
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
        <Panel title="Brand info and storage" description="Set the public name customers see and confirm Docker volume storage is mounted.">
          <Field label="Public brand name" value={draft.company.brandName} onChange={(value) => updateCompany("brandName", value)} />
          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-medium">Mounted local storage</p>
            <div className="grid gap-2 text-sm">
              {storageChecks.map((check) => (
                <div key={check.storageClass} className="flex items-center justify-between rounded border p-3">
                  <span>{check.storageClass}</span>
                  <span className="text-muted-foreground">{check.path}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : null}

      {step === 2 ? (
        <Panel title="Printer setup and connection test" description="Register the first printer profile and first loaded filament spool. The test opens the Centauri Carbon SDCP WebSocket and then closes it without sending printer commands.">
          <Field label="Internal printer name" value={draft.printer.name} onChange={(value) => updatePrinter("name", value)} />
          <Field label="Public printer name" value={draft.printer.publicName} onChange={(value) => updatePrinter("publicName", value)} />
          <Field label="Internal IP or hostname" value={draft.printer.internalIp} onChange={(value) => updatePrinter("internalIp", value)} />
          <Field label="Control API URL" value={draft.printer.controlApiUrl} onChange={(value) => updatePrinter("controlApiUrl", value)} />

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
          <Field label="Remaining grams" type="number" value={String(draft.filament.remainingGrams)} onChange={(value) => updateFilament("remainingGrams", Number(value))} />
          <Field label="Low threshold grams" type="number" value={String(draft.filament.thresholdGrams)} onChange={(value) => updateFilament("thresholdGrams", Number(value))} />
          <Field label="Storage location" value={draft.filament.location} onChange={(value) => updateFilament("location", value)} />

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
