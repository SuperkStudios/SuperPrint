"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UploadForm() {
  const [fileName, setFileName] = useState("custom-bracket.stl");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName, notes })
    });
    setMessage(response.ok ? "Upload registered and waiting for admin approval." : "Sign in before uploading.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fileName">STL file name</Label>
        <Input id="fileName" value={fileName} onChange={(event) => setFileName(event.target.value)} />
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
