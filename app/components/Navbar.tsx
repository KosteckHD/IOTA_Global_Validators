'use client';
import { memo, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
};

type NavbarProps = {
  items: NavItem[];
  activeHref: string;
  isLive: boolean;
};

function Navbar({
  items,
  activeHref,
  isLive,
}: NavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // const network = searchParams?.get('network') === 'testnet' ? 'testnet' : 'mainnet';

  // const handleNetworkChange = (newNetwork: string) => {
  //   const params = new URLSearchParams(searchParams?.toString() || '');
  //   if (newNetwork === 'mainnet') {
  //     params.delete('network');
  //   } else {
  //     params.set('network', newNetwork);
  //   }
    
  //   startTransition(() => {
  //     router.push(`${pathname}?${params.toString()}`);
  //   });
  // };

  return (
    <header className="w-full animate-fade-in-up border-b border-white/10 bg-black/40 backdrop-blur-xl shrink-0 z-[100] relative">
      <div className="mx-auto flex w-full max-w-7xl flex-col md:flex-row md:items-center justify-between px-4 py-3 md:px-8 md:py-4">
        
        {/* Logo and Title (Lewa strona - ma flex-1 żeby zrównoważyć prawą stronę) */}
        <div className="flex-1 flex items-center justify-start">
          <Link href="/" className="group flex items-center gap-4 transition-transform hover:scale-[1.02]">
            <div>
              <p className="text-4xl font-bold leading-none uppercase tracking-[0.32em] text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.3)] transition-colors group-hover:text-purple-200">
                IOTA
              </p>
              <div className="flex items-center gap-2 mt-1">
                <h1 className="font-title text-xl text-white md:text-2xl leading-none">Validators</h1>
                {/* Wskaźnik LIVE na mobile */}
                <div className={`md:hidden shrink-0 h-2 w-2 rounded-full ${
                  isLive ? 'bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                }`} />
              </div>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation (Center - naturalnie zajmuje tylko środek) */}
        <nav className="hidden md:flex justify-center gap-3 items-center shrink-0" aria-label="Desktop Navigation">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full border px-5 py-2 text-sm font-medium transition-all duration-300 ${
                activeHref === item.href
                  ? 'border-purple-400 bg-purple-500/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                  : 'border-zinc-800/50 bg-black/20 text-zinc-400 hover:border-purple-400/60 hover:text-white hover:bg-white/5 hover:scale-105'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Network & Live Badge (Prawa strona - ma flex-1 i justowanie do prawej) */}
        <div className="hidden md:flex flex-1 items-center justify-end gap-3">
          
          {/* <div 
            role="status"
            aria-live="polite"
            className={`rounded-full border px-3 py-1 text-[10px] md:text-xs font-semibold tracking-[0.15em] transition-colors duration-500 whitespace-nowrap ${
              isLive 
                ? 'border-purple-400/40 bg-purple-400/10 text-purple-200 animate-pulse-glow'
                : 'border-red-500/40 bg-red-500/10 text-red-300'
            }`}
          >
            {isLive ? 'LIVE ' : 'RECONNECTING...'}
          </div> */}
          <select 
            // value={network}
            // onChange={(e) => handleNetworkChange(e.target.value)}
            disabled={isPending}
            className="appearance-none bg-black/40 border border-zinc-800 text-zinc-300 text-sm font-semibold px-3 py-1.5 pr-8 rounded-full outline-none focus:border-purple-400/50 hover:bg-zinc-900 transition-colors uppercase tracking-wider cursor-pointer"
            style={{
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.5rem center',
              backgroundSize: '1em 1em'
            }}
          >
            <option value="mainnet">Mainnet</option>
            <option value="testnet">Testnet</option>
          </select>

          
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="border-t border-white/5 bg-black/20 px-4 py-3 md:hidden flex flex-wrap justify-center gap-2" aria-label="Mobile Navigation">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              activeHref === item.href
                ? 'border-purple-400/80 bg-purple-500/20 text-white'
                : 'border-zinc-800/50 bg-black/20 text-zinc-400 hover:border-purple-400/60 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function NavbarSuspense({ items, activeHref, isLive }: NavbarProps) {
  return (
    <Suspense fallback={
       <header className="w-full animate-fade-in-up border-b border-white/10 bg-black/40 backdrop-blur-xl h-16 shrink-0" />
    }>
      <Navbar items={items} activeHref={activeHref} isLive={isLive} />
    </Suspense>
  );
}

export default memo(NavbarSuspense);
