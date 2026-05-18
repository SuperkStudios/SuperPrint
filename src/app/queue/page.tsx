import { redirect } from "next/navigation";
import { LiveFactorySection } from "@/components/homepage/cyber-homepage";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { listPublicEvents } from "@/services/events";
import { getPublicQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const [queue, events] = await Promise.all([getPublicQueueState(), listPublicEvents(10)]);

  return (
    <main className="app-shell overflow-hidden text-foreground">
      <LiveFactorySection queue={queue} events={events} />
    </main>
  );
}
