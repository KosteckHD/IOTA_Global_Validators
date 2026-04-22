const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="#020617"/><circle cx="32" cy="32" r="22" fill="none" stroke="url(#g)" stroke-width="5"/><circle cx="32" cy="32" r="6" fill="#93c5fd"/></svg>`;

export async function GET() {
  return new Response(ICON_SVG, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
