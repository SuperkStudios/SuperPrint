import { getPublicFactoryEvolution } from "@/services/factory-evolution";

export const dynamic = "force-dynamic";

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = async () => {
        const data = await getPublicFactoryEvolution();
        controller.enqueue(encoder.encode(`event: factory-evolution\ndata: ${JSON.stringify(data)}\n\n`));
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
