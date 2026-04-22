import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'globe.gl';

type Validator = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  projectUrl: string;
  address: string;
  netAddress: string;
  p2pAddress: string;
  votingPower: number;
  gasPrice: number;
  commissionRate: number;
  stakingPoolIotaBalance: number;
  nextEpochStake: number;
  location: {
    lat: number;
    lng: number;
    source: string;
    host: string | null;
  };
};

type ApiPayload = {
  updatedAt: string | null;
  total: number;
  validators: Validator[];
  error: string | null;
};

function formatMillions(value: number) {
  const inMillions = value / 1_000_000;
  return `${inMillions.toLocaleString('en-US', { maximumFractionDigits: 2 })} M`;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function useLiveValidators() {
  const [payload, setPayload] = useState<ApiPayload>({
    updatedAt: null,
    total: 0,
    validators: [],
    error: null,
  });
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let retryHandle: number | undefined;
    const source = new EventSource('/api/validators/stream');

    source.onopen = () => setIsLive(true);
    source.onerror = () => {
      setIsLive(false);
      source.close();

      retryHandle = window.setTimeout(async () => {
        const response = await fetch('/api/validators');
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as ApiPayload;
        setPayload(data);
      }, 3000);
    };

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as ApiPayload;
      setPayload(data);
      setIsLive(true);
    };

    return () => {
      source.close();
      if (retryHandle) {
        clearTimeout(retryHandle);
      }
    };
  }, []);

  return { payload, isLive };
}

function App() {
  const globeRef = useRef<HTMLDivElement | null>(null);
  const globeApiRef = useRef<any>(null);
  const [selected, setSelected] = useState<Validator | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const [query, setQuery] = useState('');
  const { payload, isLive } = useLiveValidators();

  const sortedValidators = useMemo(() => {
    return [...payload.validators].sort((a, b) => b.votingPower - a.votingPower);
  }, [payload.validators]);

  const filteredValidators = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return sortedValidators;
    }

    return sortedValidators.filter((validator) => {
      return (
        validator.name.toLowerCase().includes(normalizedQuery) ||
        validator.address.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, sortedValidators]);

  const stats = useMemo(() => {
    const totalVotingPower = sortedValidators.reduce((acc, item) => acc + item.votingPower, 0);
    const avgCommission =
      sortedValidators.length > 0
        ? sortedValidators.reduce((acc, item) => acc + item.commissionRate, 0) / sortedValidators.length
        : 0;
    const totalStake = sortedValidators.reduce((acc, item) => acc + item.stakingPoolIotaBalance, 0);

    return {
      totalVotingPower,
      avgCommission,
      totalStake,
    };
  }, [sortedValidators]);

  useEffect(() => {
    if (!globeRef.current || globeApiRef.current) {
      return;
    }

    const globe = Globe()(globeRef.current)
      .globeImageUrl('/globe/earth-blue-marble.jpg')
      .bumpImageUrl('/globe/earth-topology.png')
      .backgroundImageUrl('/globe/night-sky.png')
      .pointAltitude((d: any) => 0.03 + d.votingPower / 8000)
      .pointRadius((d: any) => 0.25 + d.votingPower / 1700)
      .pointColor((d: any) => {
        if (selected?.id === d.id) {
          return '#f97316';
        }

        return d.commissionRate > 10 ? '#fb7185' : '#22d3ee';
      })
      .pointLabel(
        (d: any) => `<div style="padding:6px"><strong>${d.name}</strong><br/>Voting power: ${d.votingPower.toLocaleString()}<br/>Commission: ${d.commissionRate.toFixed(2)}%</div>`,
      )
      .onPointClick((d: any) => {
        setSelected(d as Validator);
        globe.pointOfView({ lat: d.location.lat, lng: d.location.lng, altitude: 1.8 }, 900);
      });

    const globeMaterial = globe.globeMaterial?.();
    if (globeMaterial) {
      globeMaterial.color.set('#8ecbff');
      globeMaterial.emissive.set('#1e2f4a');
      globeMaterial.emissiveIntensity = 0.22;
      globeMaterial.shininess = 0.7;
    }

    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.35;
    globe.controls().minDistance = 120;
    globe.controls().maxDistance = 450;

    globeApiRef.current = globe;

    const onResize = () => {
      if (!globeRef.current || !globeApiRef.current) {
        return;
      }

      const { width, height } = globeRef.current.getBoundingClientRect();
      globeApiRef.current.width(width);
      globeApiRef.current.height(height);
    };

    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (globeRef.current) {
        globeRef.current.innerHTML = '';
      }
      globeApiRef.current = null;
    };
  }, [selected?.id]);

  useEffect(() => {
    if (!globeApiRef.current) {
      return;
    }

    globeApiRef.current.pointsData(sortedValidators);
    if (selected) {
      const synced = sortedValidators.find((validator) => validator.id === selected.id);
      if (synced) {
        setSelected(synced);
      }
    }
  }, [sortedValidators]);

  useEffect(() => {
    if (!globeApiRef.current) {
      return;
    }

    globeApiRef.current.controls().autoRotate = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    if (!selected && sortedValidators.length > 0) {
      setSelected(sortedValidators[0]);
    }
  }, [selected, sortedValidators]);

  useEffect(() => {
    if (!selected || !globeApiRef.current) {
      return;
    }

    globeApiRef.current.pointOfView(
      {
        lat: selected.location.lat,
        lng: selected.location.lng,
        altitude: 1.8,
      },
      900,
    );
  }, [selected]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute -left-28 top-6 h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-orange-300/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-400/8 blur-3xl" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-5 md:px-8 md:pt-8">
        <header className="relative overflow-hidden rounded-3xl border border-zinc-800/90 bg-zinc-900/75 p-5 shadow-[0_0_80px_rgba(14,165,233,0.12)] backdrop-blur-md md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-10 h-44 w-44 rounded-full border border-zinc-700/80" />
          <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full border border-zinc-700/80" />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                IOTA MAINNET LIVE
              </span>
              <span className="inline-flex items-center rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs tracking-wide text-zinc-300">
                Data source: explorer validators via secured RPC relay
              </span>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <h1 className="font-title text-3xl font-semibold leading-tight md:text-5xl">
                  IOTA Validator Globe
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300 md:text-base">
                  A custom experience inspired by gmonads. Explore active validators on an interactive 3D globe,
                  inspect live stats, and jump between operators with smooth camera transitions.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Live stream</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{isLive ? 'ONLINE' : 'RECONNECTING'}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {payload.updatedAt ? new Date(payload.updatedAt).toLocaleTimeString() : 'Awaiting first snapshot'}
                  </p>
                </article>
                <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Validators</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{payload.total}</p>
                  <p className="mt-2 text-xs text-zinc-500">Active set on current epoch</p>
                </article>
                <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Total stake</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatCompact(stats.totalStake)}</p>
                  <p className="mt-2 text-xs text-zinc-500">Raw on-chain pool balances</p>
                </article>
                <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Avg commission</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{formatPercent(stats.avgCommission)}</p>
                  <p className="mt-2 text-xs text-zinc-500">Mean validator commission rate</p>
                </article>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <article className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/65 p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-400">Interactive Layer</p>
                <h2 className="font-title text-2xl text-white">3D Globe</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAutoRotate((value) => !value)}
                  className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-200 transition hover:border-cyan-300 hover:text-white"
                >
                  {autoRotate ? 'Pause rotation' : 'Resume rotation'}
                </button>
                <button
                  onClick={() => {
                    if (!globeApiRef.current) {
                      return;
                    }
                    globeApiRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 900);
                  }}
                  className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-200 transition hover:border-cyan-300 hover:text-white"
                >
                  Reset view
                </button>
              </div>
            </div>

            <div className="relative h-[52vh] min-h-90 w-full overflow-hidden rounded-2xl border border-zinc-800 bg-black/60 md:h-[64vh]">
              <div ref={globeRef} className="h-full w-full animate-glowPulse" />
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              Tip: click a point on the globe or pick a validator from the ranking panel.
            </p>
          </article>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-title text-xl text-white">Selected Validator</h3>
                {selected && (
                  <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2.5 py-1 text-xs text-zinc-400">
                    Power {selected.votingPower.toLocaleString()}
                  </span>
                )}
              </div>

              {selected ? (
                <div className="mt-3 space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <img
                      src={selected.imageUrl}
                      alt={selected.name}
                      className="h-12 w-12 rounded-xl border border-zinc-700 bg-zinc-950 object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <p className="text-base font-semibold text-white">{selected.name}</p>
                      <p className="text-xs text-zinc-400">{selected.location.host ?? 'DNS unavailable'}</p>
                    </div>
                  </div>

                  <p className="text-zinc-300">{selected.description || 'No validator description provided.'}</p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5">
                      <p className="text-zinc-400">Stake</p>
                      <p className="mt-1 font-semibold text-white">{formatMillions(selected.stakingPoolIotaBalance)} IOTA</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5">
                      <p className="text-zinc-400">Commission</p>
                      <p className="mt-1 font-semibold text-white">{formatPercent(selected.commissionRate)}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5">
                      <p className="text-zinc-400">Gas price</p>
                      <p className="mt-1 font-semibold text-white">{selected.gasPrice.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-2.5">
                      <p className="text-zinc-400">Geo source</p>
                      <p className="mt-1 font-semibold text-white">{selected.location.source}</p>
                    </div>
                  </div>

                  <a
                    href={selected.projectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-cyan-300/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-cyan-200 transition hover:border-cyan-200 hover:text-white"
                  >
                    Visit project
                  </a>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">No validator selected yet.</p>
              )}
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4 md:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-title text-xl text-white">Validator Ranking</h3>
                <span className="text-xs text-zinc-500">Live updates</span>
              </div>

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search validator by name or address"
                className="mb-3 w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-300/50 placeholder:text-zinc-500 focus:ring"
              />

              {payload.error && (
                <p className="mb-3 rounded-xl border border-rose-400/30 bg-rose-900/25 px-3 py-2 text-xs text-rose-200">
                  API warning: {payload.error}
                </p>
              )}

              <ul className="max-h-[44vh] space-y-2 overflow-auto pr-1">
                {filteredValidators.slice(0, 30).map((validator, index) => {
                  const isActive = selected?.id === validator.id;
                  return (
                    <li key={validator.id}>
                      <button
                        onClick={() => setSelected(validator)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                          isActive
                            ? 'border-cyan-300/70 bg-cyan-400/10'
                            : 'border-zinc-800 bg-zinc-950/75 hover:border-cyan-400/50 hover:bg-zinc-900'
                        }`}
                      >
                        <span className="pr-2">
                          <span className="mr-2 text-xs text-zinc-500">#{index + 1}</span>
                          <span className="text-sm font-semibold text-zinc-100">{validator.name}</span>
                        </span>
                        <span className="text-xs text-zinc-400">{validator.votingPower.toLocaleString()}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Interaction</p>
            <h4 className="mt-2 font-title text-lg text-white">Camera Focus</h4>
            <p className="mt-2 text-sm text-zinc-300">
              Selecting validators from the list or globe instantly flies the camera to the node region.
            </p>
          </article>
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Live Data</p>
            <h4 className="mt-2 font-title text-lg text-white">SSE Stream</h4>
            <p className="mt-2 text-sm text-zinc-300">
              UI listens to server stream and refreshes validator points and ranking without page reload.
            </p>
          </article>
          <article className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Security</p>
            <h4 className="mt-2 font-title text-lg text-white">Protected RPC</h4>
            <p className="mt-2 text-sm text-zinc-300">
              Frontend consumes only internal API routes, while RPC endpoint and auth stay on backend.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

export default App;
