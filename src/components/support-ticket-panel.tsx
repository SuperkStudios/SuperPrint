"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Ticket = {
  id: string;
  ticketNumber: string;
  subject: string;
  status: string;
  messages: Array<{
    id: string;
    authorType: string;
    body: string;
    channel: string;
    emailFrom?: string | null;
    createdAt: string | Date;
    author?: { name?: string | null; email?: string | null } | null;
  }>;
};

export function SupportTicketPanel({ ticket, admin = false }: { ticket: Ticket; admin?: boolean }) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(ticket.status);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const endpoint = admin ? `/api/admin/support/${ticket.id}` : `/api/support/${ticket.id}`;

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setNotice(body?.error ?? "Could not update ticket.");
      return;
    }
    window.location.reload();
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{ticket.ticketNumber}</p>
            <h2 className="mt-1 text-2xl font-semibold">{ticket.subject}</h2>
          </div>
          <span className="rounded border px-3 py-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatStatus(ticket.status)}</span>
        </div>
      </div>

      <div className="grid gap-3">
        {ticket.messages.map((item) => (
          <article key={item.id} className={`rounded-lg border p-4 ${item.authorType === "ADMIN" ? "bg-primary/10" : "bg-card"}`}>
            <div className="flex flex-wrap justify-between gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              <span>{messageAuthor(item)}</span>
              <span>{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.body}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-3 rounded-lg border bg-card p-5">
        <textarea
          rows={6}
          value={message}
          placeholder={admin ? "Reply to the customer..." : "Reply to support..."}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onChange={(event) => setMessage(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy || message.trim().length < 1} onClick={() => send({ action: "reply", message })}>
            Send reply
          </Button>
          {admin ? (
            <>
              <select value={status} className="rounded-md border bg-background px-3 py-2 text-sm" onChange={(event) => setStatus(event.target.value)}>
                {["OPEN", "AWAITING_ADMIN", "AWAITING_CUSTOMER", "CLOSED"].map((option) => <option key={option} value={option}>{formatStatus(option)}</option>)}
              </select>
              <Button type="button" variant="outline" disabled={busy} onClick={() => send({ action: "status", status, message: message || undefined })}>
                Update status
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={busy} onClick={() => send({ action: "close", message: message || undefined })}>
                Close ticket
              </Button>
              {ticket.status === "CLOSED" ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => send({ action: "reopen", message: message || undefined })}>
                  Reopen
                </Button>
              ) : null}
            </>
          )}
          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </div>
      </div>
    </div>
  );
}

function messageAuthor(message: Ticket["messages"][number]) {
  if (message.authorType === "ADMIN") return "SuperPrint Support";
  if (message.authorType === "SYSTEM") return "Status update";
  return message.author?.name || message.author?.email || message.emailFrom || "Customer";
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w|\s\w/g, (match) => match.toUpperCase());
}
