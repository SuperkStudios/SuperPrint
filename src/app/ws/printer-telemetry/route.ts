import { getPublicQueueState } from "@/services/queue";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = async () => {
        const queue = await getPublicQueueState();
        controller.enqueue(encoder.encode(`event: printer-telemetry\ndata: ${JSON.stringify(queue.current?.telemetry ?? null)}\n\n`));
      };
      await send();
      const interval = setInterval(send, 5000);
      return () => clearInterval(interval);
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" }
  });
}
