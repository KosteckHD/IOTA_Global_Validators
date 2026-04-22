import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';
import ValidatorsTable from './ValidatorsTable';
import { fetchValidators } from '@/lib/validator';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Validators', href: '/validators' },
  { label: 'Charts', href: '/charts' },
  { label: 'Stacking', href: '/stacking' },
];

export const revalidate = 300; // Dane odświeżają się co 5 minut za kulisami

export default async function ValidatorsPage(props: { searchParams?: Promise<{ network?: string }> }) {
  const searchParams = await props.searchParams;
  const network = searchParams?.network === 'testnet' ? 'testnet' : 'mainnet';

  let validators = [] as any[];
  let overview = { totalValidators: 0, totalBlocks: 0, totalFees: 0, burntFees: 0 };
  try {
    const res = await fetchValidators(network);
    validators = res.validators;
    overview = res.overview;
  } catch (error) {
    console.error('Failed to load validators in page', error);
  }

  return (
    <main className="min-h-screen flex bg-gradient-to-rt from-purple-950 via-indigo-950 to-black flex-col overflow-x-clip text-blue-50">
      <Navbar items={navItems} activeHref="/validators" isLive={true} />

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-4 md:px-8 md:py-8 mt-2 md:mt-4">
        <ValidatorsTable validators={validators} overview={overview} />
        <Footer />
      </div>
    </main>
  );
}
