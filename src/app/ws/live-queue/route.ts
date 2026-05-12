import { getPublicQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  return eventStream(async () => getPublicQueueState());
}

function eventStream(snapshot: () => Promise<unknown>) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = async () => controller.enqueue(encoder.encode(`event: live-queue\ndata: ${JSON.stringify(await snapshot())}\n\n`));
      await send();
      const interval = setInterval(send, 5000);
      return () => clearInterval(interval);
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" }
  });
}
