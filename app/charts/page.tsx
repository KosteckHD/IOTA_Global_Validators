import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Validators', href: '/validators' },
  { label: 'Charts', href: '/charts' },
  { label: 'Stacking', href: '/stacking' },
];

export default function ChartsPage() {
  return (
    <main className="flex min-h-screen flex-col overflow-x-clip text-blue-50">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 overflow-x-clip px-4 py-4 md:px-8 md:py-8">
        <Navbar items={navItems} activeHref="/charts" isLive={true} />

        <section className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-black/40 p-6 text-center shadow-2xl backdrop-blur-md md:p-12">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-purple-400">In Progress</p>
          <h1 className="font-title mt-3 text-3xl font-bold text-white md:text-5xl">Charts</h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-400 md:text-base">
            Sorry, this panel is still in production. We'll be adding analytics, charts, and detailed network visualizations in the next update.
          </p>
        </section>

        <Footer />
      </div>
    </main>
  );
}
