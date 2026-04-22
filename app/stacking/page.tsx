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
    <main className="min-h-screen overflow-x-clip text-blue-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 overflow-x-clip px-4 py-4 md:px-8 md:py-8">
        <Navbar items={navItems} activeHref="/stacking" isLive={true} />

        <section className="futuristic-panel p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-sky-300">Stacking</p>
          <h1 className="font-title mt-2 text-3xl text-white md:text-4xl">Stake Positioning</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            This section can host staking allocation views, next-epoch stake deltas and APY comparison flows.
          </p>
        </section>

        <Footer />
      </div>
    </main>
  );
}
