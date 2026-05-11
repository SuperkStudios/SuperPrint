"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("Choose an STL file first.");
      return;
    }
    const body = new FormData();
    body.set("file", file);
    body.set("notes", notes);
    const response = await fetch("/api/uploads", {
      method: "POST",
      body
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Upload registered and waiting for admin approval." : result.error ?? "Sign in before uploading.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">STL file</Label>
        <Input id="file" type="file" accept=".stl,model/stl,application/octet-stream" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Print notes</Label>
        <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>
      <Button type="submit">
        <Upload className="size-4" />
        Request approval
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
