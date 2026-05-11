import { LiveQueue } from "@/components/live-queue";
import { getPublicQueueState } from "@/services/queue";
import { listPublicEvents } from "@/services/events";
import { getBootstrapStatus } from "@/lib/bootstrap";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  if (!(await getBootstrapStatus()).isComplete) {
    redirect("/setup");
  }
  const [queue, events] = await Promise.all([getPublicQueueState(), listPublicEvents(10)]);
  return (
    <main>
      <LiveQueue queue={queue} events={events} />
    </main>
  );
}
