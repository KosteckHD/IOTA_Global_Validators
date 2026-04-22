import { memo } from 'react';

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="futuristic-panel mt-2 flex flex-col gap-2 px-4 py-4 text-xs text-zinc-400 md:flex-row md:items-center md:justify-between md:px-6">
      <p>Built for IOTA validator observability and live network exploration.</p>
      <p>Nightly IOTAGV made by KosteckHD {year}</p>
    </footer>
  );
}

export default memo(Footer);
