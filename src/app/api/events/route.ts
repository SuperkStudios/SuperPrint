import { listPublicEvents } from "@/services/events";

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const events = await listPublicEvents(12);
      controller.enqueue(encoder.encode(`event: snapshot\ndata: ${JSON.stringify(events)}\n\n`));

      const interval = setInterval(async () => {
        const nextEvents = await listPublicEvents(12);
        controller.enqueue(encoder.encode(`event: platform\ndata: ${JSON.stringify(nextEvents)}\n\n`));
      }, 5000);

      return () => clearInterval(interval);
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
