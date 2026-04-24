"use client";

import { Fragment, useMemo, useState,useId } from 'react';
import type { ValidatorInfo, NetworkOverview } from '@/lib/validator';

type SortKey = keyof ValidatorInfo;
type SortDirection = 'asc' | 'desc';

type ChartBar = {
  label: string;
  value: number;
  color: string;
  displayValue?: string;
};

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function abbreviateId(id: string) {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : 'rotate-0'}`}
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PerformanceMetrics({ bars }: { bars: ChartBar[] }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-5 min-w-0">
      <h4 className="mb-5 text-[10px] uppercase tracking-[0.24em] text-zinc-500 font-semibold">Performance Mix</h4>
      <div className="flex flex-col gap-4">
        {bars.map(bar => (
          <div key={bar.label} className="w-full">
            <div className="flex justify-between mb-1.5 items-center">
              <span className="text-xs font-semibold text-zinc-300">{bar.label}</span>
              <span className="text-xs font-mono font-bold" style={{ color: bar.color }}>
                {bar.displayValue || `${bar.value.toFixed(1)}%`}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 relative" style={{ width: `${bar.value}%`, backgroundColor: bar.color }}>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/30" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeerTrendChart({
  points,
  highlightedIndex,
  dataLabel = 'Stake'
}: {
  points: { label: string; value: number }[];
  highlightedIndex: number;
  dataLabel?: string;
}) {
  const uniqueId = useId(); // Generuje unikalny ciąg znaków dla tej instancji
  const width = 600;
  const height = 240;
  const chartTop = 40;
  const chartBottom = 190;
  const chartHeight = chartBottom - chartTop;
  
  const maxValue = Math.max(...points.map(p => p.value), 1);
  const minValue = Math.max(0, Math.min(...points.map(p => p.value)) * 0.85);
  const valueRange = Math.max(maxValue - minValue, 1);
  const step = points.length > 1 ? (width - 80) / (points.length - 1) : 0;
  const startX = 40;

  const coordinates = points.map((point, index) => {
    const x = startX + index * step;
    const y = chartBottom - ((point.value - minValue) / valueRange) * chartHeight;
    return { ...point, x, y };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const areaPath = coordinates.length > 0 
    ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${chartBottom} L ${coordinates[0].x} ${chartBottom} Z`
    : '';

  // Używamy unikalnych ID dla url(#...)
  const lineGradId = `line-grad-${uniqueId.replace(/:/g, '')}`;
  const areaGradId = `area-grad-${uniqueId.replace(/:/g, '')}`;

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-5 min-w-0">
      <h4 className="mb-2 text-[10px] uppercase tracking-[0.24em] text-zinc-500 font-semibold">{dataLabel} Comparison (Peers)</h4>
      <div className="relative w-full mt-4" style={{ paddingBottom: '40%' }}>
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="absolute inset-0 w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Dodano gradientUnits="userSpaceOnUse" - naprawia problem znikających linii przy płaskich danych */}
            <linearGradient id={areaGradId} x1="0" y1="0" x2="0" y2={height} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={lineGradId} x1="0" y1="0" x2={width} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          
          <line x1={0} y1={chartTop} x2={width} y2={chartTop} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <line x1={0} y1={chartTop + chartHeight/2} x2={width} y2={chartTop + chartHeight/2} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
          <line x1={0} y1={chartBottom} x2={width} y2={chartBottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

          {coordinates.length > 0 && <path d={areaPath} fill={`url(#${areaGradId})`} />}
          {coordinates.length > 0 && (
            <path 
              d={linePath} 
              fill="none" 
              stroke={`url(#${lineGradId})`} 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              vectorEffect="non-scaling-stroke" // Gwarantuje, że linia nie będzie rozmyta na dużych ekranach
            />
          )}
          
          {coordinates.map((point, index) => {
            const isHighlighted = index === highlightedIndex;
            return (
              <g key={`${uniqueId}-point-${index}`}>
                {isHighlighted && (
                  <line x1={point.x} y1={chartTop} x2={point.x} y2={chartBottom} stroke="rgba(255,255,255,0.15)" strokeDasharray="2 4" />
                )}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHighlighted ? 6 : 4}
                  fill={isHighlighted ? '#ffffff' : '#0f172a'}
                  stroke={isHighlighted ? '#a855f7' : '#64748b'}
                  strokeWidth={isHighlighted ? 3 : 2}
                  className="transition-all duration-300"
                />
                <text x={point.x} y={point.y - 15} textAnchor="middle" fill={isHighlighted ? "#fff" : "#94a3b8"} fontSize={isHighlighted ? "14" : "11"} fontWeight="700">
                  {formatCompact(point.value)}
                </text>
                <text x={point.x} y={chartBottom + 25} textAnchor="middle" fill={isHighlighted ? "#e2e8f0" : "#64748b"} fontSize="11" fontWeight="600" letterSpacing="0.05em">
                  {point.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  );
}

function ValidatorDetailPanel({
  validator,
  rank,
  totalValidators,
  totalStake,
  totalVotingPower,
  totalNextEpochStake,
  maxStake,
  maxVotingPower,
  peerValidators,
  peerHighlightedIndex,
}: {
  validator: ValidatorInfo;
  rank: number;
  totalValidators: number;
  totalStake: number;
  totalVotingPower: number;
  totalNextEpochStake: number;
  maxStake: number;
  maxVotingPower: number;
  peerValidators: ValidatorInfo[];
  peerHighlightedIndex: number;
}) {
  const stakeShare = totalStake > 0 ? (validator.stakedIota / totalStake) * 100 : 0;
  const votingPower = validator.votingPower ?? 0;
  const votingShare = totalVotingPower > 0 ? (votingPower / totalVotingPower) * 100 : 0;
  const nextEpochStake = validator.nextEpochStake ?? 0;
  const nextEpochShare = totalNextEpochStake > 0 ? (nextEpochStake / totalNextEpochStake) * 100 : 0;
  const commissionRate = validator.commissionRate ?? 0;
  const gasPrice = validator.gasPrice ?? 0;

  const chartBars: ChartBar[] = [
    { label: 'Success Rate', value: clamp(validator.successRate), color: '#8b5cf6', displayValue: `${validator.successRate.toFixed(1)}%` },
    { label: 'Stake Weight', value: maxStake > 0 ? clamp((validator.stakedIota / maxStake) * 100) : 0, color: '#38bdf8', displayValue: `${stakeShare.toFixed(2)}% (${formatCompact(validator.stakedIota)})` },
    { label: 'Voting Power', value: maxVotingPower > 0 ? clamp((votingPower / maxVotingPower) * 100) : 0, color: '#10b981', displayValue: `${votingShare.toFixed(2)}%` },
    { label: 'Next Epoch Share', value: totalNextEpochStake > 0 ? clamp((nextEpochStake / totalNextEpochStake) * 100) : 0, color: '#f59e0b', displayValue: `${nextEpochShare.toFixed(2)}%` },
  ];

  const infoItems = [
    { label: 'Rank', value: `${rank} / ${totalValidators}` },
    { label: 'Status', value: validator.status },
    { label: 'Country', value: validator.country },
    { label: 'Success rate', value: formatPercent(validator.successRate) },
    { label: 'Stake share', value: formatPercent(stakeShare) },
    { label: 'Voting share', value: formatPercent(votingShare) },
    { label: 'Staked IOTA', value: validator.stakedIota.toLocaleString('en-US') },
    { label: 'Voting power', value: votingPower > 0 ? formatCompact(votingPower) : 'N/A' },
    { label: 'Commission', value: `${commissionRate.toFixed(2)}%` },
    { label: 'Gas price', value: gasPrice > 0 ? gasPrice.toLocaleString('en-US') : 'N/A' },
    { label: 'Next epoch stake', value: nextEpochStake > 0 ? formatCompact(nextEpochStake) : 'N/A' },
    { label: 'Next share', value: formatPercent(nextEpochShare) },
    { label: 'Network share', value: totalValidators > 0 ? formatPercent(100 / totalValidators) : 'N/A' },
    { label: 'Validator ID', value: abbreviateId(validator.id) },
  ];

  return (
    <div className="mt-4 max-w-full overflow-hidden rounded-2xl border border-purple-500/20 bg-black/55 p-4 text-left shadow-inner shadow-black/30 md:p-5">
      <div className="mb-4 flex flex-col gap-2 border-b border-white/5 pb-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-purple-300">Expanded validator</p>
          <h3 className="mt-1 text-base font-title font-bold text-white md:text-lg wrap-break-word">{validator.name || 'Unknown validator'}</h3>
          <p className="mt-1 text-xs text-zinc-400">Detailed snapshot with chart context and live stats.</p>
        </div>
        {validator.projectUrl ? (
          <a
            href={validator.projectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-purple-200 transition hover:border-purple-400/40 hover:bg-purple-500/20"
            onClick={(event) => event.stopPropagation()}
          >
            Project site
          </a>
        ) : null}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-black/20 p-3 flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Rank</p>
              <p className="text-lg font-mono font-bold text-white leading-none">#{rank}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-3 flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Status</p>
              <p className={`text-sm font-bold uppercase leading-none ${validator.status === 'High' ? 'text-emerald-400' : validator.status === 'Medium' ? 'text-yellow-400' : 'text-rose-400'}`}>{validator.status}</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-3 flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Commission</p>
              <p className="text-lg font-mono font-bold text-white leading-none">{commissionRate.toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/20 p-3 flex flex-col justify-center">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Gas Price</p>
              <p className="text-lg font-mono font-bold text-white leading-none">{gasPrice}</p>
            </div>
          </div>
          <PerformanceMetrics bars={chartBars} />
          <PeerTrendChart
            points={peerValidators.map((item) => ({
              label: item.name.length > 7 ? `${item.name.slice(0, 7)}…` : item.name,
              value: item.stakedIota,
            }))}
            highlightedIndex={peerHighlightedIndex}
            dataLabel="Stake"
          />
        </div>

        <div className="min-w-0 rounded-xl border border-white/10 bg-black/25 flex flex-col max-h-[662px]">
          <div className="mb-3 flex items-center justify-between gap-3 p-4 shrink-0 border-b border-white/5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">Statistics</p>
              <p className="text-sm font-semibold text-white mt-0.5">Snapshot values</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset shrink-0 ${
              validator.status === 'High'
                ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                : validator.status === 'Medium'
                ? 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/30'
                : 'bg-rose-500/10 text-rose-400 ring-rose-500/30'
            }`}>
              {validator.status}
            </span>
          </div>

          <div className="overflow-y-auto p-4 pt-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {infoItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100 wrap-break-word">{item.value}</p>
                </div>
              ))}
            </div>

            {validator.description ? (
              <div className="mt-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Description</p>
                <p className="mt-1 text-sm leading-6 text-zinc-300 wrap-break-word">{validator.description}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ValidatorsTable({ validators, overview }: { validators: ValidatorInfo[]; overview: NetworkOverview }) {
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [selectedValidatorId, setSelectedValidatorId] = useState<string | null>(null);

  const filteredValidators = validators.filter((val) => val.name.toLowerCase().includes(search.toLowerCase()));

  const totalStake = useMemo(
    () => validators.reduce((sum, validator) => sum + validator.stakedIota, 0),
    [validators]
  );

  const totalVotingPower = useMemo(
    () => validators.reduce((sum, validator) => sum + (validator.votingPower ?? 0), 0),
    [validators]
  );

  const totalNextEpochStake = useMemo(
    () => validators.reduce((sum, validator) => sum + (validator.nextEpochStake ?? 0), 0),
    [validators]
  );

  const maxStake = useMemo(
    () => Math.max(...validators.map(v => v.stakedIota), 1),
    [validators]
  );

  const maxVotingPower = useMemo(
    () => Math.max(...validators.map(v => v.votingPower ?? 0), 1),
    [validators]
  );

  const sortedValidators = [...filteredValidators].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;

    let aValue = a[key] ?? '';
    let bValue = b[key] ?? '';

    // Wlasne sortowanie dla statusow od "najlepszego"
    if (key === 'status') {
      const order = { High: 3, Medium: 2, Low: 1 };
      aValue = order[a.status as 'High' | 'Medium' | 'Low'] || 0;
      bValue = order[b.status as 'High' | 'Medium' | 'Low'] || 0;
    }

    if (aValue < bValue) {
      return direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) return <span className="ml-1 text-purple-400 opacity-50">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="ml-1 text-white">↑</span> : <span className="ml-1 text-white">↓</span>;
  };

  const sortedSelectedIndex = selectedValidatorId ? sortedValidators.findIndex((validator) => validator.id === selectedValidatorId) : -1;
  const peerStartIndex = sortedSelectedIndex >= 0 ? Math.max(0, sortedSelectedIndex - 2) : 0;
  const peerValidators = sortedSelectedIndex >= 0 ? sortedValidators.slice(peerStartIndex, Math.min(sortedValidators.length, peerStartIndex + 5)) : [];
  const peerHighlightedIndex = sortedSelectedIndex >= 0 ? sortedSelectedIndex - peerStartIndex : 0;

  const toggleValidator = (validatorId: string) => {
    setSelectedValidatorId((current) => (current === validatorId ? null : validatorId));
  };

  return (
    <div className="mt-2 md:mt-8 flex flex-col gap-4 md:gap-6 max-w-7xl mx-auto min-w-0">
      <div className="rounded-2xl border border-purple-500/20 bg-black/40 backdrop-blur-xl shadow-lg shadow-purple-900/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-5 border-b border-white/5 gap-3 md:gap-4">
          <h1 className="text-lg font-title font-bold text-white tracking-wide">Network Overview</h1>
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20 w-fit">Last 24h</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4 p-4 md:p-5">
          <div className="flex flex-col items-center justify-center p-3 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-sky-400 mb-2 group-hover:text-sky-300 transition-colors text-center" title="Epoch Fees since 24h">
              Total Fees
            </p>
            <p className="text-lg md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center wrap-break-word">
              {overview.totalFees > 0 ? overview.totalFees.toLocaleString('en-US') : '0'}
              <span className="text-xs md:text-sm font-sans text-zinc-500 ml-1 block xl:inline">IOTA</span>
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-3 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-purple-400 mb-2 group-hover:text-purple-300 transition-colors text-center" title="Total Network Checkpoints">
              Blocks
            </p>
            <p className="text-lg md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center wrap-break-word">
              {overview.totalBlocks > 0 ? (overview.totalBlocks / 1_000_000).toFixed(2) + 'M' : '0'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-3 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-rose-400 mb-2 group-hover:text-rose-300 transition-colors text-center" title="Fees burned over the last epoch">
              Burnt Fees
            </p>
            <p className="text-lg md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center wrap-break-word">
              {overview.burntFees > 0 ? overview.burntFees.toLocaleString('en-US') : '0'}
              <span className="text-xs md:text-sm font-sans text-zinc-500 ml-1 block xl:inline">IOTA</span>
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-3 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2 group-hover:text-emerald-300 transition-colors text-center">Validators</p>
            <p className="text-lg md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center">
              {overview.totalValidators > 0 ? overview.totalValidators : validators.length}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-purple-500/20 bg-black/40 backdrop-blur-xl shadow-lg flex flex-col overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:p-5 border-b border-white/5 bg-black/20">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-title font-bold text-white tracking-wide">Validators Performance</h2>
            <p className="text-xs text-zinc-400">View and analyze all active network participants</p>
          </div>

          <div className="relative w-full md:w-72 shrink-0">
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 py-2 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-purple-500/50 focus:bg-black focus:outline-none focus:ring-1 focus:ring-purple-500/50 hover:border-white/20"
            />
            <svg className="absolute left-3 top-1/2 -mt-2.25 h-4.5 w-4.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>

        <div className="lg:hidden p-4">
          {sortedValidators.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {sortedValidators.map((val, index) => {
                const isExpanded = selectedValidatorId === val.id;
                return (
                  <article
                    key={val.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleValidator(val.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleValidator(val.id);
                      }
                    }}
                    className={`rounded-xl border p-3 transition-colors ${
                      isExpanded ? 'border-purple-400/40 bg-zinc-900/75' : 'border-white/10 bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-zinc-100 leading-tight wrap-break-word">{val.name || 'Unknown'}</h3>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                          Tap to {isExpanded ? 'collapse' : 'expand'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset shrink-0 ${
                            val.status === 'High'
                              ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                              : val.status === 'Medium'
                                ? 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/30'
                                : 'bg-rose-500/10 text-rose-400 ring-rose-500/30'
                          }`}
                        >
                          {val.status}
                        </span>
                        <span className="rounded-full border border-white/10 bg-black/25 p-1.5 text-zinc-300">
                          <ChevronDownIcon open={isExpanded} />
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-white/5 bg-black/20 p-2">
                        <p className="text-zinc-500 uppercase tracking-wider">Country</p>
                        <div className="mt-1 flex items-center gap-2">
                          {val.countryCode ? (
                            <div className="shrink-0 rounded-[3px] overflow-hidden shadow-sm border border-white/10 flex">
                              <img
                                src={`https://flagcdn.com/w20/${val.countryCode}.png`}
                                srcSet={`https://flagcdn.com/w40/${val.countryCode}.png 2x`}
                                width="20"
                                alt={val.country}
                                className="block"
                              />
                            </div>
                          ) : (
                            <span className="text-zinc-500 text-sm leading-none shrink-0" title="Global / Unknown">
                              🌐
                            </span>
                          )}
                          <span className="text-zinc-300 truncate">{val.country}</span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-white/5 bg-black/20 p-2">
                        <p className="text-zinc-500 uppercase tracking-wider">Success</p>
                        <p className="mt-1 font-mono text-purple-300">{val.successRate}%</p>
                      </div>

                      <div className="rounded-lg border border-white/5 bg-black/20 p-2 col-span-2">
                        <p className="text-zinc-500 uppercase tracking-wider">Staked IOTA</p>
                        <p className="mt-1 font-mono text-sky-300 wrap-break-word">{val.stakedIota.toLocaleString('en-US')}</p>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-3 max-w-full overflow-hidden" onClick={(event) => event.stopPropagation()}>
                        <ValidatorDetailPanel
                          validator={val}
                          rank={index + 1}
                          totalValidators={sortedValidators.length}
                          totalStake={totalStake}
                          totalVotingPower={totalVotingPower}
                          totalNextEpochStake={totalNextEpochStake}
                          maxStake={maxStake}
                          maxVotingPower={maxVotingPower}
                          peerValidators={peerValidators}
                          peerHighlightedIndex={peerHighlightedIndex}
                        />
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-10 text-center text-zinc-500 border border-white/5 rounded-xl bg-black/20">
              <div className="flex flex-col items-center justify-center gap-2">
                <svg className="w-8 h-8 text-zinc-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p>No validators found matching "{search}"</p>
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:block overflow-x-auto w-full">
          <table className="w-full table-fixed text-left text-sm text-zinc-300">
            <thead className="border-b border-white/5 bg-black/40 text-xs uppercase tracking-widest text-zinc-400 font-semibold selection:bg-transparent">
              <tr>
                <th className="w-[26%] px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap" onClick={() => requestSort('name')}>
                  Name <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('name')}</span>
                </th>
                <th className="w-[20%] px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap" onClick={() => requestSort('country')}>
                  Country <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('country')}</span>
                </th>
                <th className="w-[18%] px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap text-right" onClick={() => requestSort('stakedIota')}>
                  Staked IOTA <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('stakedIota')}</span>
                </th>
                <th className="w-[18%] px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap text-right" onClick={() => requestSort('successRate')}>
                  Success Rate <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('successRate')}</span>
                </th>
                <th className="w-[18%] px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap text-center" onClick={() => requestSort('status')}>
                  <span className="inline-flex items-center gap-2">Status <ChevronDownIcon open={Boolean(selectedValidatorId)} /></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedValidators.length > 0 ? (
                sortedValidators.map((val, index) => {
                  const isExpanded = selectedValidatorId === val.id;
                  return (
                    <Fragment key={val.id}>
                      <tr
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleValidator(val.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleValidator(val.id);
                          }
                        }}
                        className={`group cursor-pointer transition-colors hover:bg-zinc-800/40 ${
                          isExpanded ? 'bg-zinc-800/25' : ''
                        }`}
                      >
                        <td className="px-6 py-4 font-semibold text-zinc-100 group-hover:text-white transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{val.name || 'Unknown'}</span>
                            <span className="rounded-full border border-white/10 bg-black/25 p-1 text-zinc-300">
                              <ChevronDownIcon open={isExpanded} />
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {val.countryCode ? (
                              <div className="shrink-0 rounded-[3px] overflow-hidden shadow-sm border border-white/10 flex">
                                <img
                                  src={`https://flagcdn.com/w20/${val.countryCode}.png`}
                                  srcSet={`https://flagcdn.com/w40/${val.countryCode}.png 2x`}
                                  width="20"
                                  alt={val.country}
                                  className="block"
                                />
                              </div>
                            ) : (
                              <span className="text-zinc-500 text-sm leading-none shrink-0" title="Global / Unknown">🌐</span>
                            )}
                            <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors truncate max-w-30">{val.country}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono text-sky-300/90 group-hover:text-sky-300 transition-colors">{val.stakedIota.toLocaleString('en-US')}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-1 font-mono text-xs font-medium text-purple-300 group-hover:bg-purple-500/20 transition-colors">
                            {val.successRate}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                              val.status === 'High'
                                ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
                                : val.status === 'Medium'
                                  ? 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/30'
                                  : 'bg-rose-500/10 text-rose-400 ring-rose-500/30'
                            }`}
                          >
                            {val.status}
                          </span>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={5} className="px-0 pb-4 pt-0">
                            <div className="px-4">
                            <ValidatorDetailPanel
                              validator={val}
                              rank={index + 1}
                              totalValidators={sortedValidators.length}
                              totalStake={totalStake}
                              totalVotingPower={totalVotingPower}
                              totalNextEpochStake={totalNextEpochStake}
                              maxStake={maxStake}
                              maxVotingPower={maxVotingPower}
                              peerValidators={peerValidators}
                              peerHighlightedIndex={peerHighlightedIndex}
                            />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-zinc-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p>No validators found matching "{search}"</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}