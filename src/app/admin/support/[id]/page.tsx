import { notFound } from "next/navigation";
import { SupportTicketPanel } from "@/components/support-ticket-panel";
import { getAdminTicket } from "@/services/support";

export const dynamic = "force-dynamic";

export default async function AdminSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await getAdminTicket(id);
  if (!ticket) notFound();
  return (
    <div className="grid gap-5">
      <SupportTicketPanel ticket={ticket} admin />
    </div>
  );
}
