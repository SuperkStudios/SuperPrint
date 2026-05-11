"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupForm({ storageChecks }: { storageChecks: Array<{ storageClass: string; path: string; configured: boolean }> }) {
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      owner: {
        name: String(form.get("ownerName")),
        email: String(form.get("ownerEmail")),
        password: String(form.get("ownerPassword"))
      },
      company: { brandName: String(form.get("brandName")) },
      printer: {
        name: String(form.get("printerName")),
        publicName: String(form.get("printerPublicName")),
        internalIp: String(form.get("printerInternalIp")),
        controlApiUrl: String(form.get("printerControlApiUrl"))
      },
      filament: {
        material: String(form.get("filamentMaterial")),
        color: String(form.get("filamentColor")),
        brand: String(form.get("filamentBrand")),
        remainingGrams: Number(form.get("remainingGrams")),
        thresholdGrams: Number(form.get("thresholdGrams")),
        location: String(form.get("filamentLocation"))
      },
      security: {
        mediaTokenSecretSet: form.get("mediaTokenSecretSet") === "on",
        backupPassphraseSet: form.get("backupPassphraseSet") === "on"
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
    setMessage(result.error ?? "Setup failed");
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <Section title="1. Create owner account">
        <Field name="ownerName" label="Owner name" defaultValue="" />
        <Field name="ownerEmail" label="Owner email" type="email" defaultValue="" />
        <Field name="ownerPassword" label="Password" type="password" defaultValue="" />
      </Section>

      <Section title="2. Company and public brand">
        <Field name="brandName" label="Public brand name" defaultValue="SuperPrint" />
      </Section>

      <Section title="3. Local storage paths">
        <div className="grid gap-2 text-sm">
          {storageChecks.map((check) => (
            <div key={check.storageClass} className="flex items-center justify-between rounded border p-3">
              <span>{check.storageClass}</span>
              <span className="text-muted-foreground">{check.path}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="4. Register first printer">
        <Field name="printerName" label="Internal printer name" defaultValue="" />
        <Field name="printerPublicName" label="Public printer name" defaultValue="" />
        <Field name="printerInternalIp" label="Internal IP or hostname" defaultValue="" />
        <Field name="printerControlApiUrl" label="Control API URL" defaultValue="http://10.0.0.10/api" />
      </Section>

      <Section title="5. Add first filament spool">
        <div className="grid gap-2">
          <Label htmlFor="filamentMaterial">Material</Label>
          <select id="filamentMaterial" name="filamentMaterial" className="h-10 rounded-md border bg-white px-3 text-sm">
            {["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"].map((material) => (
              <option key={material}>{material}</option>
            ))}
          </select>
        </div>
        <Field name="filamentColor" label="Color" defaultValue="" />
        <Field name="filamentBrand" label="Brand" defaultValue="" />
        <Field name="remainingGrams" label="Remaining grams" type="number" defaultValue="1000" />
        <Field name="thresholdGrams" label="Low threshold grams" type="number" defaultValue="150" />
        <Field name="filamentLocation" label="Storage location" defaultValue="" />
      </Section>

      <Section title="6. Confirm security">
        <label className="flex gap-3 rounded border p-3 text-sm">
          <input name="mediaTokenSecretSet" type="checkbox" className="mt-1" />
          <span>`MEDIA_TOKEN_SECRET` is set to a production-grade secret.</span>
        </label>
        <label className="flex gap-3 rounded border p-3 text-sm">
          <input name="backupPassphraseSet" type="checkbox" className="mt-1" />
          <span>`BACKUP_ENCRYPTION_PASSPHRASE` is set and stored safely.</span>
        </label>
      </Section>

      <div className="flex items-center gap-3">
        <Button type="submit">Finish setup</Button>
        {message ? <p className="text-sm text-destructive">{message}</p> : null}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ name, label, type = "text", defaultValue }: { name: string; label: string; type?: string; defaultValue: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required />
    </div>
  );
}
