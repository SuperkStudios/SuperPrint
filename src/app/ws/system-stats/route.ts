import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = async () => {
        const [orders, jobs, events] = await Promise.all([prisma.order.count(), prisma.printJob.count(), prisma.platformEvent.count()]);
        controller.enqueue(encoder.encode(`event: system-stats\ndata: ${JSON.stringify({ orders, jobs, events })}\n\n`));
      };
      await send();
      const interval = setInterval(send, 10000);
      return () => clearInterval(interval);
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" }
  });
}
