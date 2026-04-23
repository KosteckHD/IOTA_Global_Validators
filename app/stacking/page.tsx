import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Validators', href: '/validators' },
  { label: 'Charts', href: '/charts' },
  { label: 'Stacking', href: '/stacking' },
];

export default function StackingPage() {
  return (
    <main className="flex min-h-screen flex-col overflow-x-clip text-blue-50">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 overflow-x-clip px-4 py-4 md:px-8 md:py-8">
        <Navbar items={navItems} activeHref="/stacking" isLive={true} />

        <section className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-black/40 p-6 text-center shadow-2xl backdrop-blur-md md:p-12">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple-400">In Progress</p>
          <h1 className="font-title mt-3 text-3xl font-bold text-white md:text-5xl">Stacking</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400 md:text-base">
            Sorry, this panel is still in production. We'll be adding analytics, staking tools, and search placement capabilities soon.
          </p>
        </section>

        <Footer />
      </div>
    </main>
  );
}
