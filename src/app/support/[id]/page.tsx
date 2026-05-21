import { notFound } from "next/navigation";
import { AuthRequired } from "@/components/auth-required";
import { PageSection, PageShell } from "@/components/cyber-page";
import { SupportTicketPanel } from "@/components/support-ticket-panel";
import { getCurrentSession } from "@/lib/auth";
import { getCustomerTicket } from "@/services/support";

export const dynamic = "force-dynamic";

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return <AuthRequired title="Sign in for support" copy="Support tickets attach to your SuperPrint account." />;
  }
  const { id } = await params;
  const ticket = await getCustomerTicket(session.user.id, id);
  if (!ticket) notFound();
  return (
    <PageShell>
      <PageSection>
        <SupportTicketPanel ticket={ticket} />
      </PageSection>
    </PageShell>
  );
}
