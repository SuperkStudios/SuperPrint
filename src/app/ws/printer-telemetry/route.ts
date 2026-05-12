import { getPublicQueueState } from "@/services/queue";
import { readPrinterTelemetry, refreshPrinterHeartbeat } from "@/services/printer-heartbeat";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = async () => {
        const [queue, printer] = await Promise.all([
          getPublicQueueState(),
          prisma.printer.findFirst({ orderBy: { publicName: "asc" } })
        ]);
        const liveTelemetry = printer ? await readPrinterTelemetry(printer.id) : null;
        if (printer) await refreshPrinterHeartbeat(printer.id);
        controller.enqueue(encoder.encode(`event: printer-telemetry\ndata: ${JSON.stringify(liveTelemetry ?? queue.current?.telemetry ?? null)}\n\n`));
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
