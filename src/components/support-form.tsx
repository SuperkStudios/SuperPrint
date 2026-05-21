"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SupportForm() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setStatus("");
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, message })
    });
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setStatus(body?.error ?? "Could not start support thread.");
      return;
    }
    setSubject("");
    setMessage("");
    setStatus(`Ticket ${body?.ticket?.ticketNumber ?? ""} started. You can reply here or by email.`);
    if (body?.ticket?.id) {
      window.location.href = `/support/${body.ticket.id}`;
    }
  }

  return (
    <div className="grid gap-4 rounded-md border bg-card p-5 text-card-foreground">
      <div className="grid gap-2">
        <Label htmlFor="support-subject">Subject</Label>
        <Input id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="support-message">Message</Label>
        <textarea
          id="support-message"
          rows={8}
          value={message}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={loading || subject.length < 3 || message.length < 10} onClick={submit}>
          {loading ? "Starting..." : "Start support ticket"}
        </Button>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
      </div>
    </div>
  );
}
