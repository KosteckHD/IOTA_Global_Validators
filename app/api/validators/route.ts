import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidators } from '@/lib/validators';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const network = searchParams.get('network') === 'testnet' ? 'testnet' : 'mainnet';

  const payload = await getLiveValidators(false, network);
  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    },
  });
}
