"use client";

import { useState } from 'react';
import type { ValidatorInfo, NetworkOverview } from '@/lib/validator';

type SortKey = keyof ValidatorInfo;
type SortDirection = 'asc' | 'desc';

export default function ValidatorsTable({ validators, overview }: { validators: ValidatorInfo[]; overview: NetworkOverview }) {
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);

  const filteredValidators = validators.filter((val) =>
    val.name.toLowerCase().includes(search.toLowerCase())
  );

  const sortedValidators = [...filteredValidators].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue = a[key] ?? '';
    let bValue = b[key] ?? '';

    // Własne sortowanie dla statusów od "najlepszego"
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

  return (
    <div className="mt-8 flex flex-col gap-6 max-w-7xl mx-auto">
        <div className="rounded-2xl border border-purple-500/20 bg-black/40 backdrop-blur-xl shadow-lg shadow-purple-900/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border-b border-white/5 gap-4">
            <h1 className="text-lg font-title font-bold text-white tracking-wide">Network Overview</h1>
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20 w-fit">Last 24h</span>
        </div>

      {/* --- Network Overview Grid --- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
        <div className="flex flex-col items-center justify-center p-4 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-sky-400 mb-2 group-hover:text-sky-300 transition-colors text-center" title="Epoch Fees since 24h">Total Fees</p>
          <p className="text-xl md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center break-words">
             {overview.totalFees > 0 ? overview.totalFees.toLocaleString('en-US') : '0'} 
             <span className="text-xs md:text-sm font-sans text-zinc-500 ml-1 block xl:inline">IOTA</span>
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-4 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-purple-400 mb-2 group-hover:text-purple-300 transition-colors text-center" title="Total Network Checkpoints">Blocks</p>
          <p className="text-xl md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center break-words">
            {overview.totalBlocks > 0 ? (overview.totalBlocks / 1_000_000).toFixed(2) + 'M' : '0'}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-4 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-rose-400 mb-2 group-hover:text-rose-300 transition-colors text-center" title="Fees burned over the last epoch">Burnt Fees</p>
          <p className="text-xl md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center break-words">
             {overview.burntFees > 0 ? overview.burntFees.toLocaleString('en-US') : '0'}
             <span className="text-xs md:text-sm font-sans text-zinc-500 ml-1 block xl:inline">IOTA</span>
          </p>
        </div>
        <div className="flex flex-col items-center justify-center p-4 md:p-6 rounded-xl border border-white/5 bg-zinc-900/50 hover:bg-zinc-800/80 transition-colors group">
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2 group-hover:text-emerald-300 transition-colors text-center">Validators</p>
          <p className="text-xl md:text-3xl font-mono font-bold text-zinc-100 group-hover:text-white transition-colors text-center">
            {overview.totalValidators > 0 ? overview.totalValidators : validators.length} 
          </p>
        </div>
      </div>
        </div>

      {/* --- Filter & Tabela (Złączone w jeden wrapper) --- */}
      <div className="rounded-2xl border border-purple-500/20 bg-black/40 backdrop-blur-xl shadow-lg flex flex-col overflow-hidden">
        
        {/* --- Wyszukiwarka i Kontrolki --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-b border-white/5 bg-black/20">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-title font-bold text-white tracking-wide">Validators Performance</h2>
            <p className="text-xs text-zinc-400">View and analyze all active network participants</p>
          </div>
          <div className="relative w-full md:w-64 shrink-0">
            <input
              id="search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="w-full rounded-xl border border-white/10 bg-zinc-900/80 py-2 pl-9 pr-4 text-sm text-zinc-200 placeholder-zinc-500 transition-colors focus:border-purple-500/50 focus:bg-black focus:outline-none focus:ring-1 focus:ring-purple-500/50 hover:border-white/20"
            />
            {/* Ikonka Lupy (SVG inline) */}
            <svg className="absolute left-3 top-1/2 mt-[-9px] h-4.5 w-4.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
        </div>

        {/* --- Tabela --- */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="border-b border-white/5 bg-black/40 text-xs uppercase tracking-widest text-zinc-400 font-semibold selection:bg-transparent">
              <tr>
                <th className="px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap" onClick={() => requestSort('name')}>
                  Name <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('name')}</span>
                </th>
                <th className="px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap" onClick={() => requestSort('country')}>
                  Country <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('country')}</span>
                </th>
                <th className="px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap text-right" onClick={() => requestSort('stakedIota')}>
                  Staked IOTA <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('stakedIota')}</span>
                </th>
                <th className="px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap text-right" onClick={() => requestSort('successRate')}>
                  Success Rate <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('successRate')}</span>
                </th>
                <th className="px-6 py-4 hover:text-white cursor-pointer transition-colors group whitespace-nowrap text-center" onClick={() => requestSort('status')}>
                  Status <span className="inline-block transition-transform group-hover:scale-110">{getSortIcon('status')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedValidators.length > 0 ? (
                sortedValidators.map((val) => (
                  <tr key={val.id} className="transition-colors hover:bg-zinc-800/40 group">
                    <td className="px-6 py-4 font-semibold text-zinc-100 group-hover:text-white transition-colors">{val.name || 'Unknown'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
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
                        <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors truncate max-w-[120px]">{val.country}</span>
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
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                       <svg className="w-8 h-8 text-zinc-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
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