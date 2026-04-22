'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ProgressState = 'proposal' | 'finalized' | 'timeout' | 'empty';

type ProgressEntry = {
  state: ProgressState;
  checkpoint?: number;
};

type RecentBlock = {
  validator: string;
  validatorId: string;
  imageUrl: string;
  status: 'proposal' | 'finalized' | 'timeout';
  block: number;
  round: number;
  transactions: number;
};

function areProgressArraysEqual(current: ProgressEntry[], next: ProgressEntry[]) {
  if (current.length !== next.length) {
    return false;
  }

  for (let i = 0; i < current.length; i += 1) {
    const a = current[i];
    const b = next[i];
    if (!a || !b) {
      return false;
    }
    if (a.state !== b.state || a.checkpoint !== b.checkpoint) {
      return false;
    }
  }

  return true;
}

function areRecentBlocksEqual(current: RecentBlock[], next: RecentBlock[]) {
  if (current.length !== next.length) {
    return false;
  }

  for (let i = 0; i < current.length; i += 1) {
    const a = current[i];
    const b = next[i];
    if (!a || !b) {
      return false;
    }

    if (
      a.validatorId !== b.validatorId ||
      a.status !== b.status ||
      a.block !== b.block ||
      a.round !== b.round ||
      a.transactions !== b.transactions ||
      a.imageUrl !== b.imageUrl ||
      a.validator !== b.validator
    ) {
      return false;
    }
  }

  return true;
}



function useSmoothNumber(target: number, durationMs: number = 1000) {
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    let startTime: number | null = null;
    let animationFrame: number;
    // Capture start value right when target changes
    const startValue = current;

    if (target === startValue) return;

    const animate = (time: number) => {
      if (startTime === null) startTime = time;
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // easeOutCubic
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setCurrent(startValue + (target - startValue) * easeOut);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCurrent(target);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [target, durationMs]);

  return current;
}

export default function DashboardGrid({ payload, stats, liveDashboard }: any) {
  const isTabVisibleRef = useRef(true);
  const targetProgressRef = useRef<ProgressEntry[]>([]);
  const targetBlocksRef = useRef<RecentBlock[]>([]);

  const progressWindow = Math.max(1, Number(liveDashboard?.progressWindow ?? 60));

  const targetProgress = useMemo<ProgressEntry[]>(() => {
    const source = Array.isArray(liveDashboard?.progressEntries) ? liveDashboard.progressEntries : [];
    const reversed = [...source].reverse(); // Najnowszy blok jest teraz na index 0 (lewa strona)

    const normalized = reversed.slice(0, progressWindow).map((entry: any) => ({
      state: (entry?.state ?? 'empty') as ProgressState,
      checkpoint: typeof entry?.checkpoint === 'number' ? entry.checkpoint : undefined,
    }));

    const diff = progressWindow - normalized.length;
    if (diff > 0) {
      return normalized.concat(
        Array.from({ length: diff }, () => ({
          state: 'empty' as ProgressState,
          checkpoint: -1
        })),
      );
    }

    return normalized;
  }, [liveDashboard?.progressEntries, progressWindow]);

  const targetBlocks = useMemo<RecentBlock[]>(() => {
    if (!Array.isArray(liveDashboard?.recentBlocks)) {
      return [];
    }

    return liveDashboard.recentBlocks as RecentBlock[];
  }, [liveDashboard?.recentBlocks]);

  const queueTickMs = useMemo(() => {
    const refreshMs = Number(payload?.refreshMs ?? 5000);
    if (!Number.isFinite(refreshMs)) {
      return 5000;
    }
    // Queue pacing should not be faster than backend update cadence.
    return Math.max(5000, Math.round(refreshMs));
  }, [payload?.refreshMs]);

  const [stagedProgress, setStagedProgress] = useState<ProgressEntry[]>(targetProgress);
  const [stagedBlocks, setStagedBlocks] = useState<RecentBlock[]>(targetBlocks);
  const [pulseRhythm, setPulseRhythm] = useState(false);
  const stagedProgressRef = useRef<ProgressEntry[]>(targetProgress);
  const stagedBlocksRef = useRef<RecentBlock[]>(targetBlocks);
  const syncTimerRef = useRef<number | null>(null);

  const [largestBlockTxs, setLargestBlockTxs] = useState(Number(liveDashboard.largestBlock) || 0);
  const blockHistoryRef = useRef<{txs: number, timestamp: number}[]>([]);

  function updateLargestBlock(transactions: number) {
    const now = Date.now();
    const history = blockHistoryRef.current;
    
    history.push({ txs: transactions, timestamp: now });
    
    // Przechowujemy tylko dane z ostatnich 60 minut (60 * 60 * 1000 ms)
    const cutoff = now - 60 * 60 * 1000;
    while (history.length > 0 && history[0].timestamp < cutoff) {
      history.shift();
    }
    
    const currentLargest = Math.max(...history.map(item => item.txs));
    if (currentLargest > largestBlockTxs) {
      setLargestBlockTxs(currentLargest);
    } else {
      setLargestBlockTxs(currentLargest); // w wypadku gdy stary "największy" blok wygasł
    }
  }

  useEffect(() => {
    const onVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
    };

    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    targetProgressRef.current = targetProgress;
  }, [targetProgress]);

  useEffect(() => {
    targetBlocksRef.current = targetBlocks;
  }, [targetBlocks]);

  useEffect(() => {
    stagedProgressRef.current = stagedProgress;
  }, [stagedProgress]);

  useEffect(() => {
    stagedBlocksRef.current = stagedBlocks;
  }, [stagedBlocks]);

  const blockQueueRef = useRef<RecentBlock[]>([]);
  const lastAnimatedTargetRef = useRef<number>(0);

  useEffect(() => {
    if (!isTabVisibleRef.current) return;
    
    const targetValidBlocks = targetBlocks.filter(b => b?.block);
    if (targetValidBlocks.length === 0) return;

    const highestKnown = lastAnimatedTargetRef.current;
    
    // First paint or reset
    if (highestKnown === 0 || targetValidBlocks[0].block < highestKnown - 100) {
      const top2 = targetBlocks.slice(0, 2);
      setStagedBlocks(top2);
      lastAnimatedTargetRef.current = top2[0]?.block || 0;
      blockQueueRef.current = [];
    } else {
      // Find new blocks
      const newBlocks: RecentBlock[] = [];
      for (let i = targetBlocks.length - 1; i >= 0; i--) {
        const b = targetBlocks[i];
        if (b && b.block > highestKnown) {
          newBlocks.push(b);
          lastAnimatedTargetRef.current = b.block;
        }
      }
      if (newBlocks.length > 0) {
        blockQueueRef.current = [...blockQueueRef.current, ...newBlocks];
      }
    }
    
    const steps = Math.max(1, blockQueueRef.current.length);
    const idealTickMs = Math.floor(queueTickMs / (steps + 1));
    const tickMs = Math.max(150, Math.min(400, idealTickMs));
    
    if (syncTimerRef.current !== null) {
      window.clearInterval(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    const performTick = () => {
      if (!isTabVisibleRef.current) return;
      
      // Consume one block from our queue
      if (blockQueueRef.current.length > 0) {
        const nextBlock = blockQueueRef.current.shift()!;
        setPulseRhythm(p => !p);
        setStagedBlocks(current => {
          // If the block is already there, skip to avoid weird states
          if (current.some(b => b?.block === nextBlock.block)) return current;
          return [nextBlock, current[0]];
        });
      } else {
         // Also sync properties of existing displayed blocks (e.g. status change)
         setStagedBlocks(current => {
           let changed = false;
           const next = current.map(item => {
             if (!item) return item;
             const tMatch = targetBlocksRef.current.find(t => t?.block === item.block);
             if (tMatch && !areRecentBlocksEqual([item], [tMatch])) {
                changed = true;
                return tMatch;
             }
             return item;
           });
           return changed ? next : current;
         });
      }
      
      setStagedProgress(current => {
        const target = targetProgressRef.current;
        if (areProgressArraysEqual(current, target)) return current;
        
        let missingItemIdx = -1;
        // Szukamy najstarszego brakującego bloku, by dodawać je jeden po drugim
        for (let i = target.length - 1; i >= 0; i--) {
          const t = target[i];
          if (!t || t.state === 'empty') continue;
          if (t.checkpoint !== undefined) {
             if (!current.some(c => c?.checkpoint === t.checkpoint)) {
               missingItemIdx = i;
               break;
             }
          }
        }

        if (missingItemIdx !== -1) {
          const newItem = target[missingItemIdx];
          // Pierwsze wejście nowego bloku ZAWSZE jako Proposal (niebieski), żeby był płynny przeskok
          const next = [{ ...newItem, state: 'proposal' as ProgressState }, ...current.slice(0, current.length - 1)];
          // Zmiany stanu/koloru robimy na pozostałych klockach w tym samym ticku
          return next.map((item, index) => {
            if (index === 0 || !item || item.state === 'empty') return item;
            const tMatch = target.find(t => t?.checkpoint === item.checkpoint);
            return tMatch ? { ...item, state: tMatch.state } : item;
          });
        }
        
        // Jeżeli żadnego nie brakuje do przesunięcia, zaktualizuj kolory (stany) do docelowych
        let stateChanged = false;
        const next = current.map(item => {
           if (!item || item.state === 'empty') return item;
           const tMatch = target.find(t => t?.checkpoint === item.checkpoint);
           if (tMatch && tMatch.state !== item.state) {
              stateChanged = true;
              return { ...item, state: tMatch.state };
           }
           return item;
        });
        
        return stateChanged ? next : target;
      });

      if (targetBlocksRef.current && targetBlocksRef.current.length > 0) {
        // Przeszukujemy odebrane wpisy po największej liczbie transakcji by zachować 60m peak
        const latestMax = Math.max(...targetBlocksRef.current.map(b => b?.transactions || 0));
        updateLargestBlock(latestMax);
      }
    };

    // Do NOT run performTick immediately! Give the browser a tick cycle to digest initial payload.
    syncTimerRef.current = window.setInterval(performTick, tickMs);
    
    return () => {
      if (syncTimerRef.current !== null) {
        window.clearInterval(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [targetProgress, targetBlocks, queueTickMs]);

  function statusColor(state: string) {
    if (state === 'empty') {
      return 'bg-zinc-700/55';
    }
    if (state === 'finalized') {
      return 'bg-purple-500/80';
    }
    if (state === 'timeout') {
      return 'bg-rose-500/80';
    }
    if (state === 'proposal') {
      return 'bg-sky-400/80';
    }
    return 'bg-zinc-700/55';
  }

  function StatCard({ title, label, value, unit, extraClass = "", decimals, isCompact }: any) {
    const numericTarget = typeof value === 'number' ? value : Number(value) || 0;
    // Animate over to the new value over 1.5 seconds smoothly 
    const animatedValue = useSmoothNumber(numericTarget, 100);

    let displayValue = animatedValue.toString();
    if (typeof decimals === 'number') {
      displayValue = animatedValue.toFixed(decimals);
    } else if (isCompact) {
      displayValue = animatedValue.toLocaleString('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1
      });
    } else {
      displayValue = Math.round(animatedValue).toString();
    }

    return (
      <div className={"rounded-xl glass-panel flex flex-col " + extraClass}>
        <div className="bg-black/30 border-b border-purple-500/20 h-10 px-3 flex items-center justify-between shrink-0">
          <span className="text-sm font-medium text-zinc-400">{title}</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-purple-500/20 text-purple-300 ring-1 ring-inset ring-purple-500/30">
            {label}
          </span>
        </div>
        <div className="px-3 py-3 flex items-baseline gap-1 justify-end text-white relative">
          <span className="font-semibold text-2xl tracking-tight transition-all duration-300 ease-out">{displayValue}</span>
          <span className="text-zinc-500 text-xs uppercase tracking-widest">{unit}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center mt-6 z-10 relative">
      <div className="w-full max-w-[1240px] px-4 md:px-0">
        
        {/* --- Główna sekcja z Historią i Blokami --- */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 mb-6">
          
          {/* Proposal History (2/3 szerokości) */}
          <div>
          <div className="rounded-2xl glass-panel flex flex-col overflow-hidden min-h-[300px]">
            <div className="bg-black/30 border-b border-purple-500/20 h-[52px] px-5 flex items-center justify-between shrink-0">
              <span className="text-base font-semibold text-zinc-300">Proposal History</span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                <span className="w-2 h-2 rounded-full bg-purple-400 mr-2 animate-pulse"></span>Live Feed
              </span>
            </div>
            <div className="p-6 flex flex-col justify-center flex-grow">
              <div className="w-full bg-black/40 border border-zinc-800/80 rounded-xl p-5 shadow-inner">
                 <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-5 text-sm gap-3">
                   <span className="text-zinc-400 font-semibold uppercase tracking-widest text-xs">Network Progress</span>
                   <div className="flex flex-wrap gap-4">
                     <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-sky-400/80"></span><span className="text-sky-300 text-xs font-medium">Proposal</span></span>
                     <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></span><span className="text-purple-300 text-xs font-medium">Finalized</span></span>
                     <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80"></span><span className="text-rose-300 text-xs font-medium">Timeout</span></span>
                   </div>
                 </div>
                 <div className={`flex w-full gap-0.5 md:gap-1.5 h-8 md:h-12 transition-all duration-500 ease-in-out ${pulseRhythm ? 'scale-[1.01] opacity-100 drop-shadow-[0_0_12px_rgba(56,189,248,0.2)]' : 'scale-100 opacity-95 drop-shadow-none'}`}>
                   {Array.from({ length: progressWindow }).map((_, i) => {
                     const queueIndex = i;
                     const state = stagedProgress?.[queueIndex]?.state ?? 'empty';
                     const glowClass = state === 'finalized'
                       ? 'shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                       : state === 'timeout'
                         ? 'shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                         : state === 'proposal'
                           ? 'shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                           : 'shadow-none';
                     return (
                       <div
                         key={i}
                         className={
                           'progress-tick-cell flex-1 rounded-sm md:rounded transition-[background-color,transform,box-shadow] duration-700 ease-out min-w-[2px] '
                           + statusColor(state)
                           + ' '
                           + glowClass
                         }
                       />
                     );
                   })}
                 </div>
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center mt-5 text-sm pt-4 border-t border-zinc-800/50 gap-2">
                    <span className="text-zinc-400 font-medium">Success Rate: <span className="text-purple-400 ml-1 text-base font-bold">{liveDashboard.proposalSuccess.toFixed(1)}%</span></span>
                    <span className="text-zinc-400 font-medium">
                      Latest Checkpoint: <span className="text-sky-300 ml-1 font-mono tracking-wider">{typeof liveDashboard.latestCheckpoint === 'number' ? liveDashboard.latestCheckpoint.toLocaleString() : '--'}</span>
                    </span>
                 </div>
              </div>
            </div>
          </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
            <StatCard title="Live TPS" label="Live (5s)" value={liveDashboard.tps} decimals={0} unit="TPS" extraClass="border-sky-500/20" />
           <StatCard title="Peak TPS" label="7d (1m)" value={liveDashboard.peakTps} decimals={0} unit="TPS" />
          </div>
          </div>
          {/* Recent Blocks (1/3 szerokości) */}
          <div className="rounded-2xl glass-panel flex flex-col overflow-hidden min-h-[300px]">
            <div className="bg-black/30 border-b border-purple-500/20 h-[52px] px-5 flex items-center justify-between shrink-0">
              <span className="text-base font-semibold text-zinc-300">Recent Blocks</span>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest bg-purple-500/20 text-purple-300 ring-1 ring-inset ring-purple-500/30">Live Sync</span>
            </div>
            <div className="p-4 flex flex-col gap-3 flex-grow justify-center">
               {stagedBlocks.slice(0, 3).map((block: RecentBlock, idx: number) => (
                 <div key={`${block.block}-${idx}`} className="bg-black/40 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col gap-2 shadow-inner transition-all duration-300 hover:border-purple-500/40 hover:bg-black/60 group">
                   <div className="flex justify-between text-xs text-zinc-500">
                     <span className="uppercase font-bold tracking-widest text-[10px]">Checkpoint</span>
                     <span className="uppercase font-bold tracking-widest text-[10px]">Round</span>
                   </div>
                   <div className="flex justify-between text-base font-mono text-zinc-200">
                     <span className="text-sky-300 font-semibold drop-shadow-sm">{block.block}</span>
                     <span className="text-zinc-300">{block.round}</span>
                   </div>
                   <div className="mt-2 flex justify-between items-end border-t border-zinc-800/50 pt-2.5 gap-3">
                     <div className="flex items-center gap-2.5 min-w-0">
                       <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-zinc-900/80 text-xs font-bold text-white group-hover:border-purple-500/50 transition-colors">
                         <span>{(block.validator ?? 'N').slice(0, 1).toUpperCase()}</span>
                         {block.imageUrl ? (
                           <img
                             src={block.imageUrl}
                             alt={block.validator}
                             className="absolute inset-0 h-full w-full object-cover"
                             loading="lazy"
                             onError={(event) => { event.currentTarget.style.display = 'none'; }}
                           />
                         ) : null}
                       </div>
                       <div className="flex flex-col min-w-0">
                         <span className="text-zinc-500/80 uppercase tracking-widest font-bold text-[9px] mb-0.5">Validator</span>
                         <span className="text-sm font-semibold text-purple-200 truncate">{block.validator}</span>
                       </div>
                     </div>
                     <div className="flex flex-col items-end gap-0.5">
                       <span className="text-zinc-500/80 uppercase tracking-widest font-bold text-[9px]">Transactions</span>
                       <span className="text-sm font-bold text-white tracking-tight">{block.transactions}</span>
                     </div>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* --- Pozostałe statystyki (TPS, fee, itd) w siatce 5 kolumnowej --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-12">
          
           <StatCard title="Average Fee" label="1m avg" value={liveDashboard.medianFee} decimals={3} unit="IOTA" />
           <StatCard title="Highest Fee" label="60m peak" value={liveDashboard.highestFee} decimals={1} unit="IOTA" />
           <StatCard title="Block Time" label="1m avg" value={liveDashboard.blockTime} decimals={0} unit="MS" />
           <StatCard title="Block Fullness" label="60m avg" value={liveDashboard.fullness} decimals={1} unit="%" />
           <StatCard title="Largest Block" label="60m peak" value={largestBlockTxs} decimals={0} unit="TXS" />
           <StatCard title="Total Staked" label="Current" value={stats.totalStake} isCompact={true} unit="IOTA" />
           <StatCard title="Pending Stake" label="Next Epoch" value={(Number(liveDashboard.pendingStake)/1000000)} decimals={2} unit="M IOTA" />
           <StatCard title="System APY" label="Current" value={liveDashboard.apy} decimals={1} unit="%" />
        </div>
      </div>
    </div>
  );
}