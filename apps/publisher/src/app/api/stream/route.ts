import { subscribe } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: { type: string; data: unknown }) => {
        const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        controller.enqueue(enc.encode(payload));
      };
      send({ type: "hello", data: { ts: Date.now() } });
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: heartbeat\n\n`));
        } catch {}
      }, 15000);
      const unsub = subscribe(send);
      const close = () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {}
      };
      // @ts-expect-error: Node ReadableStream supports cancel signal via controller
      controller.signal?.addEventListener?.("abort", close);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
