import Link from "next/link";
import { SupportTicketStatus } from "@prisma/client";
import { listAdminTickets } from "@/services/support";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const status = params.status && params.status in SupportTicketStatus ? params.status as SupportTicketStatus : "ALL";
  const tickets = await listAdminTickets(status);
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Support tickets</h2>
        <p className="mt-1 text-muted-foreground">Reply to customers, handle email-linked tickets, and open or close support work.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {["ALL", "OPEN", "AWAITING_ADMIN", "AWAITING_CUSTOMER", "CLOSED"].map((option) => (
          <Link key={option} href={option === "ALL" ? "/admin/support" : `/admin/support?status=${option}`} className={`rounded border px-3 py-2 text-xs uppercase tracking-[0.16em] ${status === option ? "border-primary text-primary" : "text-muted-foreground"}`}>
            {formatStatus(option)}
          </Link>
        ))}
      </div>
      <div className="grid gap-3">
        {tickets.map((ticket) => (
          <Link key={ticket.id} href={`/admin/support/${ticket.id}`} className="rounded-lg border bg-card p-4 transition hover:border-primary">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{ticket.ticketNumber} · {ticket.customer.name || ticket.customer.email}</p>
                <h3 className="mt-1 font-semibold">{ticket.subject}</h3>
                <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{ticket.messages[0]?.body ?? "No messages yet."}</p>
              </div>
              <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatStatus(ticket.status)}</span>
            </div>
          </Link>
        ))}
        {!tickets.length ? <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No support tickets in this view.</div> : null}
      </div>
    </div>
  );
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w|\s\w/g, (match) => match.toUpperCase());
}
