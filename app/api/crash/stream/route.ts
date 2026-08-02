import { NextRequest } from 'next/server';
import { getManager } from '@/lib/crash-manager';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const manager = getManager();
  const address = req.nextUrl.searchParams.get('address');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send(manager.snapshotForStream(address));
      const unsub = manager.subscribe(address, s => {
        send(s);
      });
      const ka = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);
      req.signal.addEventListener('abort', () => {
        clearInterval(ka);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
