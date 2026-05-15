"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filamentMaterials } from "@/domain/printer-profile";

type PrinterProfileFormProps = {
  printer?: {
    id: string;
    name: string;
    publicName: string;
    modelName: string;
    nozzleSizeMm: number;
    buildVolumeXmm: number;
    buildVolumeYmm: number;
    buildVolumeZmm: number;
    supportedMaterials: unknown;
    currentFilamentId: string | null;
    cameraSource: string | null;
    maintenanceProfile: string;
    internalIp: string;
    controlApiUrl: string;
    healthDescription: string;
  };
  spools: Array<{ id: string; material: string; color: string; brand: string }>;
};

export function PrinterProfileForm({ printer, spools }: PrinterProfileFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const supportedMaterials = Array.isArray(printer?.supportedMaterials) ? printer.supportedMaterials.map(String) : ["PLA", "PETG"];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      id: printer?.id,
      name: String(form.get("name")),
      publicName: String(form.get("publicName")),
      modelName: String(form.get("modelName")),
      nozzleSizeMm: Number(form.get("nozzleSizeMm")),
      buildVolumeXmm: Number(form.get("buildVolumeXmm")),
      buildVolumeYmm: Number(form.get("buildVolumeYmm")),
      buildVolumeZmm: Number(form.get("buildVolumeZmm")),
      supportedMaterials: form.getAll("supportedMaterials").map(String),
      currentFilamentId: String(form.get("currentFilamentId") || "") || null,
      cameraSource: String(form.get("cameraSource") || "") || null,
      maintenanceProfile: String(form.get("maintenanceProfile")),
      internalIp: String(form.get("internalIp")),
      controlApiUrl: String(form.get("controlApiUrl")),
      healthDescription: String(form.get("healthDescription")),
      status: "OFFLINE",
      heartbeatStatus: "UNKNOWN"
    };
    const response = await fetch("/api/admin/printers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      router.push("/admin/printers");
      router.refresh();
      return;
    }
    const result = await response.json().catch(() => ({}));
    setMessage(result.error ?? "Printer profile could not be saved");
  }

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-lg border bg-card p-5 text-card-foreground shadow-sm md:grid-cols-2">
      <Field name="name" label="Internal name" defaultValue={printer?.name ?? ""} />
      <Field name="publicName" label="Public name" defaultValue={printer?.publicName ?? ""} />
      <Field name="modelName" label="Model name" defaultValue={printer?.modelName ?? "Elegoo Centauri Carbon"} />
      <Field name="nozzleSizeMm" label="Nozzle size (mm)" type="number" step="0.01" defaultValue={String(printer?.nozzleSizeMm ?? 0.4)} />
      <Field name="buildVolumeXmm" label="Build volume X (mm)" type="number" defaultValue={String(printer?.buildVolumeXmm ?? 256)} />
      <Field name="buildVolumeYmm" label="Build volume Y (mm)" type="number" defaultValue={String(printer?.buildVolumeYmm ?? 256)} />
      <Field name="buildVolumeZmm" label="Build volume Z (mm)" type="number" defaultValue={String(printer?.buildVolumeZmm ?? 256)} />
      <div className="grid gap-2">
        <Label>Supported materials</Label>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {filamentMaterials.map((material) => (
            <label key={material} className="flex items-center gap-2 rounded border bg-background px-3 py-2">
              <input
                name="supportedMaterials"
                value={material}
                type="checkbox"
                defaultChecked={supportedMaterials.includes(material)}
              />
              {material}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="currentFilamentId">Active filament spool</Label>
        <select id="currentFilamentId" name="currentFilamentId" defaultValue={printer?.currentFilamentId ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">No active spool</option>
          {spools.map((spool) => (
            <option key={spool.id} value={spool.id}>{spool.color} {spool.material} · {spool.brand}</option>
          ))}
        </select>
      </div>
      <Field name="cameraSource" label="Camera source" defaultValue={printer?.cameraSource ?? ""} />
      <Field name="maintenanceProfile" label="Maintenance profile" defaultValue={printer?.maintenanceProfile ?? "Elegoo Centauri Carbon standard maintenance"} />
      <Field name="internalIp" label="Internal IP or hostname" defaultValue={printer?.internalIp ?? ""} />
      <Field name="controlApiUrl" label="Control API URL" defaultValue={printer?.controlApiUrl ?? "http://10.0.0.10/api"} />
      <div className="md:col-span-2">
        <Field name="healthDescription" label="Health description" defaultValue={printer?.healthDescription ?? "Waiting for first SuperNode heartbeat"} />
      </div>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit">Save printer</Button>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  step,
  defaultValue
}: {
  name: string;
  label: string;
  type?: string;
  step?: string;
  defaultValue: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} required={name !== "cameraSource"} />
    </div>
  );
}
