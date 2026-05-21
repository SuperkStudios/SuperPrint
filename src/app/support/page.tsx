import { AuthRequired } from "@/components/auth-required";
import { SupportForm } from "@/components/support-form";
import { PageHero, PageSection, PageShell } from "@/components/cyber-page";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { listCustomerTickets } from "@/services/support";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const session = await getCurrentSession();
  if (!session) {
    return <AuthRequired title="Sign in for support" copy="Support threads attach to your SuperPrint account and continue by email." />;
  }
  const tickets = await listCustomerTickets(session.user.id);

  return (
    <PageShell>
      <PageSection>
        <PageHero eyebrow="Support" title="Support tickets" copy="Send order questions, pickup changes, shipping issues, or account help. Continue from the dashboard or by email." />
        <SupportForm />
        <div className="mt-6 grid gap-3">
          {tickets.map((ticket) => (
            <Link key={ticket.id} href={`/support/${ticket.id}`} className="rounded-lg border bg-card p-4 transition hover:border-primary">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{ticket.ticketNumber}</p>
                  <h2 className="mt-1 font-semibold">{ticket.subject}</h2>
                  <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{ticket.messages[0]?.body ?? "No messages yet."}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{formatStatus(ticket.status)}</span>
              </div>
            </Link>
          ))}
          {!tickets.length ? <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No support tickets yet.</div> : null}
        </div>
      </PageSection>
    </PageShell>
  );
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w|\s\w/g, (match) => match.toUpperCase());
}
