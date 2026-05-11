"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadReviewActions({
  uploadId,
  printers
}: {
  uploadId: string;
  printers: Array<{ id: string; publicName: string; modelName: string }>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function submit(action: "approve" | "reject", form: FormData) {
    const payload =
      action === "approve"
        ? {
            uploadId,
            action,
            adminNotes: String(form.get("adminNotes") ?? ""),
            estimatedPriceCents: Number(form.get("estimatedPriceCents") || 0) || undefined,
            estimatedGrams: Number(form.get("estimatedGrams")),
            estimatedPrintMinutes: Number(form.get("estimatedPrintMinutes")),
            selectedMaterial: String(form.get("selectedMaterial")),
            selectedPrinterId: String(form.get("selectedPrinterId"))
          }
        : {
            uploadId,
            action,
            rejectionReason: String(form.get("rejectionReason") || "Model needs revision.")
          };
    const response = await fetch("/api/admin/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Review saved" : result.error ?? "Review blocked");
    router.refresh();
  }

  return (
    <form
      className="grid gap-3 rounded border bg-muted/30 p-3 md:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit("approve", new FormData(event.currentTarget));
      }}
    >
      <Field name="estimatedGrams" label="Estimated grams" type="number" defaultValue="80" />
      <Field name="estimatedPrintMinutes" label="Estimated minutes" type="number" defaultValue="180" />
      <Field name="estimatedPriceCents" label="Price cents" type="number" defaultValue="4200" />
      <div className="grid gap-2">
        <Label htmlFor={`material-${uploadId}`}>Material</Label>
        <select id={`material-${uploadId}`} name="selectedMaterial" className="h-10 rounded-md border bg-white px-3 text-sm">
          {["PLA", "PETG", "ABS", "TPU", "NYLON", "RESIN"].map((material) => (
            <option key={material}>{material}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`printer-${uploadId}`}>Printer profile</Label>
        <select id={`printer-${uploadId}`} name="selectedPrinterId" className="h-10 rounded-md border bg-white px-3 text-sm">
          {printers.map((printer) => (
            <option key={printer.id} value={printer.id}>
              {printer.publicName} · {printer.modelName}
            </option>
          ))}
        </select>
      </div>
      <Field name="adminNotes" label="Review notes" defaultValue="" />
      <div className="flex flex-wrap items-end gap-2 md:col-span-3">
        <Button type="submit" size="sm" disabled={printers.length === 0}>
          Approve and create slice job
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={(event) => submit("reject", new FormData(event.currentTarget.form!))}
        >
          Reject
        </Button>
        <Input name="rejectionReason" placeholder="Rejection reason" className="max-w-sm" />
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    </form>
  );
}

function Field({ name, label, type = "text", defaultValue }: { name: string; label: string; type?: string; defaultValue: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} />
    </div>
  );
}
