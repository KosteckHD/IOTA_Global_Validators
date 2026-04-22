import { NextRequest } from 'next/server';
import { getCheckpointRefreshMs, getLiveValidators, getRefreshMs } from '@/lib/validators';

export const runtime = 'nodejs';

type Controller = ReadableStreamDefaultController<Uint8Array>;

function write(controller: Controller, message: string) {
  try {
    controller.enqueue(new TextEncoder().encode(message));
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network') === 'testnet' ? 'testnet' : 'mainnet';

  const refreshMs = Math.max(5000, getRefreshMs());
  const checkpointRefreshMs = Math.max(400, getCheckpointRefreshMs());
  const pushMs = Math.max(300, Math.min(1500, Math.floor(checkpointRefreshMs * 0.9)));
  let ticker: NodeJS.Timeout | null = null;
  let closed = false;
  let lastSentSignature = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!write(controller, `retry: ${pushMs}\n\n`)) {
        closed = true;
        return;
      }

      let firstSend = true;

      const send = async () => {
        if (closed) {
          return;
        }

        const payload = await getLiveValidators(firstSend, network);
        firstSend = false;

        const signature = [
          payload.updatedAt ?? '',
          payload.total,
          payload.latestCheckpoint ?? '',
          payload.error ?? '',
          payload.validators.length,
          payload.checkpointHistory[payload.checkpointHistory.length - 1] ?? '',
        ].join('|');

        if (signature === lastSentSignature) {
          write(controller, `: heartbeat ${Date.now()}\n\n`);
          return;
        }

        lastSentSignature = signature;
        const ok = write(controller, `data: ${JSON.stringify(payload)}\n\n`);
        if (!ok) {
          closed = true;
          if (ticker) {
            clearInterval(ticker);
            ticker = null;
          }
        }
      };

      await send();
      ticker = setInterval(send, pushMs);
    },
    cancel() {
      closed = true;
      if (ticker) {
        clearInterval(ticker);
        ticker = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
