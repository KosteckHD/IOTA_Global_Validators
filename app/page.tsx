'use client';

import { startTransition, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Footer from '@/app/components/Footer';
import Navbar from '@/app/components/Navbar';
import DashboardGrid from '@/app/components/DashboardGrid';

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
    lat: number | null;
    lng: number | null;
    source: string;
    label: string;
    host: string | null;
  };
};

type Payload = {
  updatedAt: string | null;
  total: number;
  refreshMs: number;
  latestCheckpoint: number | null;
  checkpointHistory: number[];
  validators: Validator[];
  error: string | null;
};

type Arc = {
  id: string;
  startId: string;
  endId: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  status: 'proposal' | 'finalized' | 'timeout';
  stroke?: number;
  altitude?: number;
  dashTime?: number;
  phase?: number;
};

type GlobeNode = {
  id: string;
  kind: 'node' | 'cluster';
  lat: number;
  lng: number;
  count: number;
  validators: Validator[];
};

type ProgressStatus = 'proposal' | 'finalized' | 'timeout';

type ProgressEntry = {
  state: ProgressStatus;
  checkpoint: number;
};

type HoverData = {
  node: GlobeNode;
  x: number;
  y: number;
};

const ARC_STATUS_COLORS: Record<ProgressStatus, string> = {
  proposal: '#38bdf8',
  finalized: '#a855f7',
  timeout: '#ef4444',
};

const navItems: { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'Validators', href: '/validators' },
  { label: 'Charts', href: '/charts' },
  { label: 'Stacking', href: '/stacking' },
];

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US');
}

function isFiniteCoordinate(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasCoordinates(validator: Validator) {
  return isFiniteCoordinate(validator.location.lat) && isFiniteCoordinate(validator.location.lng);
}

function formatCoordinate(value: number | null, axis: 'lat' | 'lng') {
  if (!isFiniteCoordinate(value)) {
    return 'N/A';
  }

  const suffix = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${Math.abs(value).toFixed(4)}°${suffix}`;
}

function formatLocationDetails(location: Validator['location']) {
  const base = location.label || location.source || location.host || 'Unknown location';
  if (!isFiniteCoordinate(location.lat) || !isFiniteCoordinate(location.lng)) {
    return `${base} (coordinates unavailable)`;
  }

  return `${base} (${formatCoordinate(location.lat, 'lat')}, ${formatCoordinate(location.lng, 'lng')})`;
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRadians;
  const dLng = (lng2 - lng1) * toRadians;
  const rLat1 = lat1 * toRadians;
  const rLat2 = lat2 * toRadians;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const a = sinDLat * sinDLat + Math.cos(rLat1) * Math.cos(rLat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return 6371 * c;
}

function sphericalCentroid(items: Validator[]) {
  let x = 0;
  let y = 0;
  let z = 0;

  for (const item of items) {
    if (!isFiniteCoordinate(item.location.lat) || !isFiniteCoordinate(item.location.lng)) {
      continue;
    }
    const latRad = (item.location.lat * Math.PI) / 180;
    const lngRad = (item.location.lng * Math.PI) / 180;
    x += Math.cos(latRad) * Math.cos(lngRad);
    y += Math.cos(latRad) * Math.sin(lngRad);
    z += Math.sin(latRad);
  }

  const count = Math.max(1, items.length);
  x /= count;
  y /= count;
  z /= count;

  const lng = (Math.atan2(y, x) * 180) / Math.PI;
  const hyp = Math.sqrt(x * x + y * y);
  const lat = (Math.atan2(z, hyp) * 180) / Math.PI;

  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'N';
  }

  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

function buildProgressEntries(checkpointHistory: number[]) {
  if (checkpointHistory.length === 0) {
    return [];
  }

  const entries: ProgressEntry[] = [];

  let latestPositiveIndex = -1;
  for (let i = checkpointHistory.length - 1; i >= 0; i--) {
    const num = checkpointHistory[i];
    if (typeof num === 'number' && num > 0) {
      latestPositiveIndex = i;
      break;
    }
  }

  for (let i = 0; i < checkpointHistory.length; i += 1) {
    const currentNum = checkpointHistory[i];

    // Typ ujemny wprowadzany w RPC służy do zasygnalizownia faktycznego przerwania finalizacji bloków w sieci
    if (typeof currentNum === 'number' && currentNum < 0) {
      entries.push({
        state: 'timeout',
        checkpoint: currentNum, // Utrzymujemy ujemny identyfikator jako unikalny ID klocka dla kluczy w pętli UI
      });
      continue;
    }

    // IOTA Checkpoints to stale zamykane i potwierdzane bloki. Ostatni ujęty traktujemy w UI jako "wpadającą propozycję"
    entries.push({
      state: i === latestPositiveIndex ? 'proposal' : 'finalized',
      checkpoint: currentNum,
    });
  }

  return entries;
}

function hashToUnit(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return ((hash >>> 0) % 1000) / 1000;
}

function arePayloadsEquivalent(prev: Payload, next: Payload) {
  if (
    prev.updatedAt !== next.updatedAt ||
    prev.total !== next.total ||
    prev.latestCheckpoint !== next.latestCheckpoint ||
    prev.error !== next.error ||
    prev.validators.length !== next.validators.length ||
    prev.checkpointHistory.length !== next.checkpointHistory.length
  ) {
    return false;
  }

  const prevCheckpointTail = prev.checkpointHistory[prev.checkpointHistory.length - 1] ?? null;
  const nextCheckpointTail = next.checkpointHistory[next.checkpointHistory.length - 1] ?? null;
  if (prevCheckpointTail !== nextCheckpointTail) {
    return false;
  }

  for (let i = 0; i < prev.validators.length; i += 1) {
    const a = prev.validators[i];
    const b = next.validators[i];
    if (!a || !b) {
      return false;
    }

    if (
      a.id !== b.id ||
      a.votingPower !== b.votingPower ||
      a.commissionRate !== b.commissionRate ||
      a.gasPrice !== b.gasPrice ||
      a.location.lat !== b.location.lat ||
      a.location.lng !== b.location.lng
    ) {
      return false;
    }
  }

  return true;
}

function nodeSignature(nodes: GlobeNode[]) {
  return nodes
    .map((node) => {
      const firstId = node.validators[0]?.id ?? '';
      return `${node.id}:${node.kind}:${node.lat}:${node.lng}:${node.count}:${firstId}`;
    })
    .join('|');
}

function arcSignature(arcs: Arc[]) {
  return arcs
    .map((arc) => {
      return [
        arc.id,
        arc.startId,
        arc.endId,
        arc.startLat,
        arc.startLng,
        arc.endLat,
        arc.endLng,
        arc.color,
        arc.stroke ?? 0,
        arc.altitude ?? 0,
        arc.dashTime ?? 0,
      ].join(':');
    })
    .join('|');
}

function buildArcs(nodes: GlobeNode[], lastResultStatus: 'finalized' | 'timeout') {
  if (nodes.length < 2) {
    return [] as Arc[];
  }

  const ordered = [...nodes].sort((a, b) => a.lng - b.lng || a.lat - b.lat || a.id.localeCompare(b.id));
  const arcs: Arc[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < ordered.length; i += 1) {
    const from = ordered[i];

    // Generujemy pseudo-losową liczbę połączeń dla tego węzła (od 3 do 9, żeby był gęstszy mesh)
    const connectionCount = 3 + Math.floor(hashToUnit(from.id + 'count') * 7);

    for (let c = 0; c < connectionCount; c += 1) {
      // Wybieramy pseudo-losowy węzeł docelowy z puli innych (seed zależny od ID, statusu i C)
      const targetIndex = Math.floor(hashToUnit(from.id + c + lastResultStatus) * ordered.length);
      const to = ordered[targetIndex];

      if (!from || !to || from.id === to.id) {
        continue;
      }

      const edgeKey = `${from.id}->${to.id}`;
      const reverseEdgeKey = `${to.id}->${from.id}`;
      if (seen.has(edgeKey) || seen.has(reverseEdgeKey)) {
        continue;
      }
      seen.add(edgeKey);

      let startLng = from.lng;
      let endLng = to.lng;

      if (endLng - startLng > 180) {
        endLng -= 360;
      } else if (startLng - endLng > 180) {
        endLng += 360;
      }

      // Silne rozsunięcie czasowe startu (całkowicie asynchroniczne animacje)
      // Mnożnik 5.0 bo to jest pełny czas powtarzania animacji Dash (arcDashAnimateTime / dashTime)
      const phaseJitter = hashToUnit(`${edgeKey}:jitter`) * 5.0;
      const basePhase = phaseJitter;

      // 1. W stronę "do": Proposal (niebieskie)
      arcs.push({
        id: `${edgeKey}:proposal`,
        startId: from.id,
        endId: to.id,
        startLat: from.lat,
        startLng: startLng,
        endLat: to.lat,
        endLng: endLng,
        status: 'proposal',
        color: ARC_STATUS_COLORS.proposal,
        phase: basePhase,
      });

      // 2. W stronę "powrotną": Finalized (fioletowe/czerwone)
      arcs.push({
        id: `${edgeKey}:${lastResultStatus}`,
        startId: to.id,
        endId: from.id,
        startLat: to.lat,
        startLng: endLng,
        endLat: from.lat,
        endLng: startLng,
        status: lastResultStatus,
        color: ARC_STATUS_COLORS[lastResultStatus],
        // Czekamy aż CAŁY łuk proposal doleci do końca (dystans 1.0 + długość łuku 0.6 = 1.6)
        phase: basePhase + 1.6,
      });
    }
  }

  return arcs;
}

function buildGlobeNodes(validators: Validator[]) {
  const geolocated = validators
    .filter(hasCoordinates)
    .sort(
      (a, b) =>
        (a.location.lng as number) - (b.location.lng as number) ||
        (a.location.lat as number) - (b.location.lat as number) ||
        a.id.localeCompare(b.id),
    );
  if (geolocated.length === 0) {
    return [] as GlobeNode[];
  }

  const clusterWithRadius = (clusterRadiusKm: number) => {
    const clusters: Array<{ validators: Validator[]; lat: number; lng: number }> = [];

    for (const validator of geolocated) {
      const lat = validator.location.lat as number;
      const lng = validator.location.lng as number;

      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < clusters.length; i += 1) {
        const cluster = clusters[i];
        const distance = haversineDistanceKm(lat, lng, cluster.lat, cluster.lng);
        if (distance <= clusterRadiusKm && distance < bestDistance) {
          bestDistance = distance;
          bestIndex = i;
        }
      }

      if (bestIndex === -1) {
        clusters.push({ validators: [validator], lat, lng });
        continue;
      }

      const target = clusters[bestIndex];
      target.validators.push(validator);
      const centroid = sphericalCentroid(target.validators);
      target.lat = centroid.lat;
      target.lng = centroid.lng;
    }

    return clusters;
  };

  const radiusCandidatesKm = [280, 420, 620];
  let clusters = clusterWithRadius(radiusCandidatesKm[0]);
  for (let i = 1; i < radiusCandidatesKm.length; i += 1) {
    const hasCluster = clusters.some((cluster) => cluster.validators.length > 1);
    if (hasCluster) {
      break;
    }
    clusters = clusterWithRadius(radiusCandidatesKm[i]);
  }

  return clusters.map((cluster) => {
    const members = [...cluster.validators].sort((a, b) => b.votingPower - a.votingPower);
    const topValidator = members[0];
    const isCluster = members.length > 1;
    const anchorLat = topValidator?.location.lat as number;
    const anchorLng = topValidator?.location.lng as number;

    return {
      id: isCluster ? members.map((item) => item.id).sort().join('|') : topValidator.id,
      kind: (isCluster ? 'cluster' : 'node') as GlobeNode['kind'],
      lat: Number(anchorLat.toFixed(5)),
      lng: Number(anchorLng.toFixed(5)),
      count: members.length,
      validators: members,
    };
  });
}

function buildRecentBlocks(
  validators: Validator[],
  latestCheckpoint: number | null,
  checkpointHistory: number[],
  progressEntries: ProgressEntry[],
) {
  if (validators.length === 0) {
    return [] as Array<{
      validator: string;
      validatorId: string;
      imageUrl: string;
      status: ProgressStatus;
      block: number;
      round: number;
      transactions: number;
    }>;
  }

  const uniqueHistory = [...new Set(checkpointHistory)].filter((value) => Number.isFinite(value));
  const recentCheckpoints = uniqueHistory.slice(-30).reverse();

  if (Number.isFinite(latestCheckpoint) && !recentCheckpoints.includes(latestCheckpoint as number)) {
    recentCheckpoints.unshift(latestCheckpoint as number);
  }

  const checkpoints = recentCheckpoints;
  const fallbackCheckpoint = Number.isFinite(latestCheckpoint) ? (latestCheckpoint as number) : 0;
  const totalVotingPower = validators.reduce((sum, validator) => sum + validator.votingPower, 0);

  const statusByCheckpoint = new Map<number, ProgressStatus>();
  for (const entry of progressEntries) {
    if (entry.state === 'proposal') {
      continue;
    }
    statusByCheckpoint.set(entry.checkpoint, entry.state);
  }

  return checkpoints.map((checkpoint, index) => {
    const validator = validators[Math.abs(checkpoint) % validators.length] ?? validators[index % validators.length];
    const block = Math.max(1, checkpoint || fallbackCheckpoint || index + 1);
    const round = block * 2;
    const status = statusByCheckpoint.get(checkpoint) ?? 'proposal';
    const votingShare = totalVotingPower > 0 ? validator.votingPower / totalVotingPower : 0;
    const statusFactor = status === 'finalized' ? 1 : status === 'proposal' ? 0.7 : 0.35;
    const transactions = Math.max(1, Math.round(votingShare * 12000 * statusFactor));

    return {
      validator: validator.name,
      validatorId: validator.id,
      imageUrl: validator.imageUrl,
      status,
      block,
      round,
      transactions,
    };
  });
}

async function buildStyledGlobeTexture(src: string) {
  if (typeof window === 'undefined') {
    return src;
  }

  return new Promise<string>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve(src);
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const pixels = imageData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const saturation = max === 0 ? 0 : delta / max;
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        const isOceanTone = b > r * 1.08 && b > g * 1.03 && saturation > 0.12;

        if (isOceanTone) {
          const depth = Math.max(0, Math.min(1, luma / 255));
          pixels[i] = Math.round(8 + depth * 20);
          pixels[i + 1] = Math.round(26 + depth * 34);
          pixels[i + 2] = Math.round(52 + depth * 56);
          continue;
        }

        // Keep original shoreline geometry but remap land to a dark violet palette.
        pixels[i] = Math.max(18, Math.min(130, 22 + luma * 0.24));
        pixels[i + 1] = Math.max(10, Math.min(98, 12 + luma * 0.13));
        pixels[i + 2] = Math.max(28, Math.min(160, 36 + luma * 0.3));
      }

      context.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
}

function HomeContent() {
  const searchParams = useSearchParams();
  const network = searchParams.get('network') === 'testnet' ? 'testnet' : 'mainnet';

  const globeRef = useRef<HTMLDivElement | null>(null);
  const globeApiRef = useRef<any>(null);
  const [payload, setPayload] = useState<Payload>({
    updatedAt: null,
    total: 0,
    refreshMs: 8000,
    latestCheckpoint: null,
    checkpointHistory: [],
    validators: [],
    error: null,
  });
  const [isLive, setIsLive] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedNodeData, setSelectedNodeData] = useState<GlobeNode | null>(null);
  const [hoverData, setHoverData] = useState<HoverData | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [shouldInitGlobe, setShouldInitGlobe] = useState(false);
  const hoverRafRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<HoverData | null>(null);
  const appliedDataSignatureRef = useRef<{ nodes: string; arcs: string }>({ nodes: '', arcs: '' });
  const lastAnimatedBlockRef = useRef<number>(0);

  const setPayloadIfChanged = (next: Payload) => {
    startTransition(() => {
      setPayload((prev) => (arePayloadsEquivalent(prev, next) ? prev : next));
    });
  };

  const updateHoverData = (next: HoverData | null) => {
    pendingHoverRef.current = next;
    if (hoverRafRef.current !== null) {
      return;
    }

    hoverRafRef.current = window.requestAnimationFrame(() => {
      hoverRafRef.current = null;
      setHoverData(pendingHoverRef.current);
    });
  };

  const sorted = useMemo(() => {
    return [...payload.validators].sort((a, b) => b.votingPower - a.votingPower);
  }, [payload.validators]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return sorted;
    }

    return sorted.filter((validator) => {
      return (
        validator.name.toLowerCase().includes(normalized) ||
        validator.address.toLowerCase().includes(normalized)
      );
    });
  }, [query, sorted]);

  const selected = useMemo(() => {
    if (!selectedId) {
      return sorted[0] ?? null;
    }
    return sorted.find((validator) => validator.id === selectedId) ?? sorted[0] ?? null;
  }, [selectedId, sorted]);

  const selectedCardValidators = useMemo(() => {
    if (!selectedNodeData) {
      return [] as Validator[];
    }

    return [...selectedNodeData.validators].sort((a, b) => b.votingPower - a.votingPower);
  }, [selectedNodeData]);

  const stats = useMemo(() => {
    const totalStake = sorted.reduce((acc, item) => acc + item.stakingPoolIotaBalance, 0);
    const avgCommission = sorted.length
      ? sorted.reduce((acc, item) => acc + item.commissionRate, 0) / sorted.length
      : 0;
    const totalVotingPower = sorted.reduce((acc, item) => acc + item.votingPower, 0);

    return { totalStake, avgCommission, totalVotingPower };
  }, [sorted]);

  const liveDashboard = useMemo(() => {
    const historyWindow = payload.checkpointHistory.slice(-60);
    const progressEntries = buildProgressEntries(historyWindow);
    const proposalCount = progressEntries.filter((entry) => entry.state === 'proposal').length;
    const proposalFinalized = progressEntries.filter((entry) => entry.state === 'finalized').length;
    const proposalTimeout = progressEntries.filter((entry) => entry.state === 'timeout').length;
    const progressWindow = 60;
    const proposalSuccess = proposalFinalized + proposalTimeout > 0
      ? (proposalFinalized / (proposalFinalized + proposalTimeout)) * 100
      : 0;

    const medianFee = sorted.length > 0
      ? sorted[Math.floor(sorted.length / 2)].gasPrice / 100000
      : 0;
    const highestFee = sorted.length > 0
      ? Math.max(...sorted.map((validator) => validator.gasPrice)) / 1000
      : 0;

    const tps = Math.max(1, Math.round(stats.totalVotingPower / 1200));
    const peakTps = Math.max(tps, Math.round(stats.totalVotingPower / 30));
    const blockTime = Math.max(220, 550 - Math.round(stats.avgCommission * 10));
    const fullness = Math.min(99, Math.max(0.2, stats.avgCommission / 12));

    const recentBlocks = buildRecentBlocks(sorted, payload.latestCheckpoint, historyWindow, progressEntries);

    return {
      proposalCount,
      proposalFinalized,
      proposalTimeout,
      progressWindow,
      progressEntries,
      proposalSuccess,
      latestCheckpoint: payload.latestCheckpoint,
      tps,
      peakTps,
      medianFee,
      highestFee,
      blockTime,
      fullness,
      largestBlock: recentBlocks.reduce((max, block) => Math.max(max, block.transactions), 1),
      pendingStake: ((payload.latestCheckpoint ?? 0) * Math.max(1, stats.avgCommission) * 1000).toFixed(2),
      apy: Math.max(4.2, (12 - stats.avgCommission / 2)).toFixed(2),
      recentBlocks,
    };
  }, [sorted, stats.avgCommission, stats.totalVotingPower, payload.latestCheckpoint, payload.checkpointHistory]);

  const globeNodes = useMemo(() => buildGlobeNodes(sorted), [sorted]);

  const baseArcs = useMemo(() => {
    // Odczytujemy przedostatni rozwiązany stan (aby animacja zachowała stabilność w tickach)
    const reversed = [...liveDashboard.progressEntries].reverse();
    const resolvedEntry = reversed.find((entry: ProgressEntry) => entry.state === 'finalized' || entry.state === 'timeout');

    // Z uwagi na to, że status bloku się zmienia co chwilę, stabilizujemy seed generatora animacji
    // by przy każdym wpadnięciu paczki z API, tablica obiektów "Arc" na wykresie NIE była od góry do dołu klonowana
    const lastResultStatus = 'finalized'; // Animacje latają domyślnie jako finalized
    const base = buildArcs(globeNodes, lastResultStatus);
    if (base.length === 0) {
      return base;
    }

    return base.map((arc) => {
      const rgb = arc.status === 'proposal'
        ? '0, 240, 255' // Super bright neon cyan
        : arc.status === 'finalized'
          ? '224, 102, 255' // Ultra bright magenta/purple
          : '255, 80, 80'; // Bright neon red

      const dist = haversineDistanceKm(arc.startLat, arc.startLng, arc.endLat, arc.endLng);
      const distRatio = Math.min(1, dist / 20000);
      const ranMap = hashToUnit(arc.id + 'rand');
      const dynamicAltitude = 0.08 + Math.min(0.8, distRatio * 0.6) + (ranMap * 0.15); // lekka losowość w wysokości łuku

      return {
        ...arc,
        color: `rgba(${rgb}, ${0.75 + ranMap * 0.25})`, // Różnorodna, ale wciąż wysoka jasność linii
        stroke: (arc.status === 'proposal' ? 0.55 : 0.45) + (ranMap * 0.25 - 0.12), // Różne grubości linii
        altitude: dynamicAltitude,
        // Rozstrzał prędkości podróży od 100ms do 160ms na jednostkę, by animacje miały różne tempo lotu
        dashTime: 100 + (ranMap * 60),
      };
    });
  }, [globeNodes, liveDashboard.progressEntries]);

  const arcs = useMemo(() => {
    const focusNodeId = activeNodeId ?? selectedNodeData?.id ?? null;
    if (!focusNodeId) {
      return baseArcs;
    }

    return baseArcs.map((arc) => {
      const isConnected = arc.startId === focusNodeId || arc.endId === focusNodeId;
      if (isConnected) {
        return {
          ...arc,
          color: arc.color.replace('1.0)', '1.0)'),
          stroke: (arc.stroke ?? 0.5) + 0.35,
          altitude: (arc.altitude ?? 0.08) + 0.08, // podbijamy wyraziściej uniesienie hovered nad tłem
          dashTime: (arc.dashTime ?? 120),
        };
      }

      return {
        ...arc,
        color: arc.color.replace(/[\d.]+\)$/, '0.12)'), // łagodniejsze przezroczystości w tle
        stroke: (arc.stroke ?? 0.5) * 0.3,
      };
    });
  }, [baseArcs, activeNodeId, selectedNodeData?.id]);

  const globeNodesSignature = useMemo(() => nodeSignature(globeNodes), [globeNodes]);
  const globeArcsSignature = useMemo(() => arcSignature(arcs), [arcs]);

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        window.cancelAnimationFrame(hoverRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const source = new EventSource(`/api/validators/stream?network=${network}`);
    let retryHandle: number | undefined;

    source.onopen = () => setIsLive(true);
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as Payload;
      setPayloadIfChanged(data);
      setIsLive(true);
    };
    source.onerror = () => {
      setIsLive(false);
      source.close();
      retryHandle = window.setTimeout(async () => {
        const response = await fetch(`/api/validators?network=${network}`, { cache: 'no-store' });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as Payload;
        setPayloadIfChanged(data);
      }, 2500);
    };

    return () => {
      source.close();
      if (retryHandle) {
        clearTimeout(retryHandle);
      }
    };
  }, [network]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
    let idleId: number | undefined;
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    const activate = () => setShouldInitGlobe(true);

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(activate, { timeout: 1400 });
    } else {
      timeoutId = globalThis.setTimeout(activate, 120);
    }

    return () => {
      if (typeof idleId === 'number' && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
      if (typeof timeoutId === 'number') {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldInitGlobe) {
      return;
    }

    let destroyed = false;

    async function init() {
      if (!globeRef.current || globeApiRef.current) {
        return;
      }

      const module = await import('globe.gl');
      if (destroyed || !globeRef.current) {
        return;
      }

      const globeTexture = await buildStyledGlobeTexture('/globe/earth-blue-marble.jpg');
      if (destroyed || !globeRef.current) {
        return;
      }

      const GlobeFactory = module.default as any;
      const globe = GlobeFactory()(globeRef.current)
        .backgroundColor('rgba(0,0,0,0)')
        .globeImageUrl(globeTexture)
        .bumpImageUrl('/globe/earth-topology.png')
        .backgroundImageUrl('/globe/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('#8f8ca8')
        .atmosphereAltitude(0.1)
        .arcColor((a: Arc) => a.color)
        .arcCurveResolution(72)
        .arcCircularResolution(8)
        .arcAltitude((a: Arc) => a.altitude ?? 0.12)
        .arcStroke((a: Arc) => a.stroke ?? 0.34)
        .arcDashLength(() => 0.8)
        .arcDashGap(() => 4.2) // całkowity cykl wynosi 5.0
        .arcDashInitialGap((a: Arc) => a.phase ?? 0)
        .arcDashAnimateTime((a: Arc) => (a.dashTime ?? 120) * 5.0)
        .arcsTransitionDuration(0)
        .htmlLat((d: GlobeNode) => d.lat)
        .htmlLng((d: GlobeNode) => d.lng)
        .htmlAltitude(() => 0)
        .htmlElement((d: GlobeNode) => {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = 'marker-anchor';
          el.setAttribute('aria-label', d.kind === 'cluster' ? `Cluster with ${d.count} validators` : d.validators[0]?.name ?? 'Validator node');
          el.setAttribute('data-node-id', d.id); // Ustawiamy id dla łatwiejszego namierzania po DOM
          el.style.pointerEvents = 'auto';
          el.style.touchAction = 'manipulation';

          const visual = document.createElement('span');
          visual.className = d.kind === 'cluster' ? 'marker-cluster marker-visual' : 'marker-node marker-visual';
          visual.id = `visual-${d.id}`;
          if (d.kind === 'cluster') {
            visual.textContent = String(d.count);
          }
          el.appendChild(visual);

          el.onpointerdown = (event) => {
            event.stopPropagation();
          };

          el.onpointerenter = (e) => {
            setActiveNodeId(d.id);
            updateHoverData({ node: d, x: e.clientX, y: e.clientY });
          };
          el.onpointermove = (e) => {
            updateHoverData({ node: d, x: e.clientX, y: e.clientY });
          };
          el.onpointerleave = () => {
            setActiveNodeId((prev) => (prev === d.id ? null : prev));
            updateHoverData(null);
          };

          el.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedNodeData(d);
            setActiveNodeId(d.id);
            const target = d.validators[0];
            if (!target) {
              return;
            }
            setSelectedId(target.id);
            globe.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.65 }, 900);
          };

          return el;
        });

      const globeMaterial = globe.globeMaterial?.();
      if (globeMaterial) {
        globeMaterial.color.set('#8e8f9b');
        globeMaterial.emissive.set('#2b233e');
        globeMaterial.emissiveIntensity = 0.24;
        globeMaterial.shininess = 0.31;
      }

      const controls = globe.controls?.();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.2;
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.rotateSpeed = 0.3;
        controls.zoomSpeed = 0.85;
        controls.enablePan = false;
        controls.minDistance = 110;
        controls.maxDistance = 480;
      }

      const renderer = globe.renderer?.();
      if (renderer?.setPixelRatio) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
      }

      const resize = () => {
        if (!globeRef.current || !globeApiRef.current) {
          return;
        }
        const { width, height } = globeRef.current.getBoundingClientRect();
        globeApiRef.current.width(width);
        globeApiRef.current.height(height);
      };

      window.addEventListener('resize', resize);
      resize();

      globeApiRef.current = globe;

      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    const cleanupPromise = init();

    return () => {
      destroyed = true;
      Promise.resolve(cleanupPromise).then((cleanupFn) => {
        if (typeof cleanupFn === 'function') {
          cleanupFn();
        }
      });
      if (globeRef.current) {
        globeRef.current.innerHTML = '';
      }
      globeApiRef.current = null;
    };
  }, [shouldInitGlobe]);

  useEffect(() => {
    if (!globeApiRef.current) {
      return;
    }

    const applied = appliedDataSignatureRef.current;
    if (applied.nodes !== globeNodesSignature) {
      globeApiRef.current.htmlElementsData(globeNodes);
      applied.nodes = globeNodesSignature;
    }

    if (applied.arcs !== globeArcsSignature) {
      globeApiRef.current.arcsData(arcs);
      applied.arcs = globeArcsSignature;
    }
  }, [globeNodes, arcs, globeNodesSignature, globeArcsSignature]);

  useEffect(() => {
    if (!globeApiRef.current || !liveDashboard.recentBlocks.length) return;

    // recentBlocks[0] to zawsze najświeższy block wedle buildRecentBlocks
    const latest = liveDashboard.recentBlocks[0];
    if (!latest || latest.block <= lastAnimatedBlockRef.current) return;

    lastAnimatedBlockRef.current = latest.block;

    const validatorNode = globeNodes.find(n => n.validators.some(v => v.id === latest.validatorId));
    if (validatorNode) {
      const el = document.getElementById(`visual-${validatorNode.id}`);
      if (el) {
        el.classList.remove('animate-pulseBlock');
        void el.offsetWidth; // wymusza reflow by animacja restartowala z poprawnym timingiem
        el.classList.add('animate-pulseBlock');
      }
    }
  }, [liveDashboard.recentBlocks, globeNodes]);

  useEffect(() => {
    if (!selectedNodeData) {
      return;
    }

    const syncedNode = globeNodes.find((node) => node.id === selectedNodeData.id);
    if (syncedNode) {
      const selectedTopId = selectedNodeData.validators[0]?.id ?? '';
      const syncedTopId = syncedNode.validators[0]?.id ?? '';
      if (
        selectedNodeData.count !== syncedNode.count ||
        selectedNodeData.lat !== syncedNode.lat ||
        selectedNodeData.lng !== syncedNode.lng ||
        selectedTopId !== syncedTopId
      ) {
        setSelectedNodeData(syncedNode);
      }
      return;
    }

    setSelectedNodeData(null);
  }, [globeNodes, selectedNodeData]);

  useEffect(() => {
    if (selectedNodeData) {
      setActiveNodeId(selectedNodeData.id);
      return;
    }
    setActiveNodeId(null);
  }, [selectedNodeData]);

  useEffect(() => {
    return () => {
      if (hoverRafRef.current !== null) {
        window.cancelAnimationFrame(hoverRafRef.current);
      }
    };
  }, []);

  return (
    <main className="min-h-screen flex flex-col overflow-x-clip text-blue-50">
      <div className="w-full z-[100] relative shrink-0">
        <Navbar items={navItems} activeHref="/" isLive={isLive} />
      </div>

      <section className="glass-panel animate-fade-in-up relative flex w-full flex-col overflow-hidden rounded-none border-x-0 border-t-0 p-0 shadow-2xl h-[65vh] min-h-[500px] md:min-h-[600px] lg:min-h-[720px]">
        <div className="hero-canvas-shell relative flex-grow w-full">
          <div className="scanline z-20" />
          <div ref={globeRef} className="absolute inset-0 z-10 w-full h-full [&>div]:!h-full [&>div]:!w-full [&_canvas]:!h-full [&_canvas]:!w-full" />
          {!shouldInitGlobe && (
            <div className="absolute inset-0 z-30 bg-gradient-to-b from-zinc-950/30 via-zinc-950/10 to-zinc-950/40 backdrop-blur-[1px]" />
          )}
        </div>

        {selectedNodeData && (
          <div className="absolute top-4 right-4 z-[60] w-[min(92vw,420px)] glass-panel border border-purple-500/30 bg-black/50 p-3 backdrop-blur-xl">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-purple-300">
                  {selectedNodeData.kind === 'cluster' ? 'Cluster Details' : 'Node Details'}
                </p>
                <h3 className="font-title text-sm text-white md:text-base">
                  {selectedNodeData.kind === 'cluster'
                    ? `${selectedNodeData.count} nodes in selected cluster`
                    : selectedNodeData.validators[0]?.name ?? 'Selected node'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNodeData(null)}
                className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-300 transition hover:border-purple-300 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {selectedCardValidators.map((validator) => {
                const imageUrl = validator.imageUrl?.trim();
                return (
                  <article
                    key={validator.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-zinc-950/70 p-2"
                  >
                    <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-white/15 bg-gradient-to-br from-purple-600/60 to-blue-600/60 text-xs font-bold text-white">
                      <span>{getInitials(validator.name)}</span>
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={validator.name}
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{validator.name}</p>
                      <p className="truncate text-xs text-zinc-400">
                        {formatLocationDetails(validator.location)}
                      </p>
                    </div>
                    <p className="shrink-0 text-[11px] font-medium text-purple-200">
                      {formatCompact(validator.votingPower)} VP
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop Info Panel Left */}
        {selected && (
          <div className="absolute bottom-6 left-6 z-50 hidden lg:block glass-panel animate-fade-in-up p-4 border border-purple-500/30 bg-black/40 backdrop-blur-xl">
            <div className="flex flex-col gap-1.5 text-white">
              <div className="text-[10px] text-purple-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                Selected Node
              </div>
              <div className="font-semibold text-lg">{selected.name}</div>
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {formatLocationDetails(selected.location)}
              </div>
            </div>
          </div>
        )}

        {/* Desktop Info Panel Right */}
        <div className="absolute bottom-6 right-6 z-50 hidden lg:block glass-panel animate-fade-in-up p-4 border border-purple-500/30 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-8 text-white min-w-[240px]">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase text-zinc-500 tracking-widest font-semibold">Active Validators</span>
              <span className="text-xl font-medium text-white">{payload.total}</span>
            </div>
            <div className="flex flex-col gap-1 text-right">
              <span className="text-[10px] uppercase text-zinc-500 tracking-widest font-semibold">Total Voting Power</span>
              <span className="text-xl font-medium text-purple-100">{formatCompact(stats.totalVotingPower)}</span>
            </div>
          </div>
        </div>
      </section>

      <div
        className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 md:px-8 md:py-8 mt-2 md:mt-4"
        style={{ contentVisibility: 'auto', containIntrinsicSize: '900px' }}
      >
        <DashboardGrid payload={payload} stats={stats} liveDashboard={liveDashboard} />

        <Footer />
      </div>

      {/* Hover Tooltip Overlay */}
      {hoverData && (
        <div
          className="fixed z-[9999] pointer-events-none flex flex-col gap-1 glass-panel animate-fade-in-up p-3 w-max max-w-[280px] bg-black/60 shadow-2xl border border-purple-500/30"
          style={{
            left: Math.min(hoverData.x + 15, typeof window !== 'undefined' ? window.innerWidth - 250 : hoverData.x),
            top: hoverData.y + 15,
          }}
        >
          {hoverData.node.kind === 'cluster' ? (
            <>
              <div className="text-[10px] text-purple-400 uppercase tracking-widest mb-1.5 font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                {hoverData.node.count} Validators
              </div>
              <div className="flex flex-col gap-2 max-h-[160px] overflow-hidden">
                {hoverData.node.validators.slice(0, 5).map((v) => (
                  <div key={v.id} className="flex justify-between items-center text-xs gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-md border border-white/15 bg-gradient-to-br from-purple-600/60 to-blue-600/60 text-[9px] font-bold text-white">
                        <span>{getInitials(v.name)}</span>
                        {v.imageUrl ? (
                          <img
                            src={v.imageUrl}
                            alt={v.name}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                      </div>
                      <span className="text-white truncate max-w-[130px] font-medium">{v.name}</span>
                    </div>
                    <span className="text-zinc-400 whitespace-nowrap font-mono">{formatCompact(v.votingPower)} VP</span>
                  </div>
                ))}
                {hoverData.node.validators.length > 5 && (
                  <div className="text-[10px] text-purple-300 mt-1 italic opacity-80">
                    + {hoverData.node.validators.length - 5} more...
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="text-[10px] text-purple-400 uppercase tracking-widest mb-1.5 font-bold flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                Live Node
              </div>
              <div className="flex items-center gap-2">
                <div className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md border border-white/15 bg-gradient-to-br from-purple-600/60 to-blue-600/60 text-[10px] font-bold text-white">
                  <span>{getInitials(hoverData.node.validators[0]?.name ?? '')}</span>
                  {hoverData.node.validators[0]?.imageUrl ? (
                    <img
                      src={hoverData.node.validators[0].imageUrl}
                      alt={hoverData.node.validators[0]?.name ?? 'Validator'}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : null}
                </div>
                <div className="font-semibold text-base text-white truncate max-w-[190px]">{hoverData.node.validators[0]?.name}</div>
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {hoverData.node.validators[0] ? formatLocationDetails(hoverData.node.validators[0].location) : 'Unknown location'}
              </div>
              <div className="text-xs text-zinc-300 mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                <span>Power:</span>
                <span className="font-medium text-white font-mono">{formatCompact(hoverData.node.validators[0]?.votingPower ?? 0)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center text-white bg-black">
        <span className="text-purple-400 font-mono tracking-widest uppercase animate-pulse">Initializing Network...</span>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}


