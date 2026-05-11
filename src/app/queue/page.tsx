import { LiveQueue } from "@/components/live-queue";
import { getPublicQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const queue = await getPublicQueueState();
  return (
    <main>
      <LiveQueue queue={queue} />
    </main>
  );
}
