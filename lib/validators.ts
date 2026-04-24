import { z } from 'zod';
import dns from 'node:dns/promises';
import { isIP } from 'node:net';
import dotenv from 'dotenv';
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  CORS_ORIGIN: z.string().url().optional(),
  IOTA_RPC_URL: z.string().url().default('https://api.mainnet.iota.cafe'),
  IOTA_TESTNET_RPC_URL: z.string().url().default('https://api.testnet.iota.cafe'),
  IOTA_RPC_METHOD: z.string().default('iotax_getLatestIotaSystemState'),
  IOTA_CHECKPOINT_METHOD: z.string().default('iota_getLatestCheckpointSequenceNumber'),
  IOTA_RPC_AUTH_HEADER: z.string().optional(),
  IOTA_RPC_AUTH_TOKEN: z.string().optional(),
  CHECKPOINT_HISTORY_SIZE: z.coerce.number().int().min(10).max(240).default(60),
  VALIDATORS_REFRESH_MS: z.coerce.number().int().min(5000).default(8000),
  CHECKPOINT_REFRESH_MS: z.coerce.number().int().min(200).default(1000),
});

const env = envSchema.parse(process.env);

type RawValidator = {
  iotaAddress: string;
  name: string;
  description: string;
  imageUrl: string;
  projectUrl: string;
  netAddress: string;
  p2pAddress: string;
  votingPower: string;
  gasPrice: string;
  commissionRate: string;
  stakingPoolIotaBalance: string;
  nextEpochStake: string;
};

export type Validator = {
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

export type ValidatorsPayload = {
  updatedAt: string | null;
  total: number;
  refreshMs: number;
  latestCheckpoint: number | null;
  checkpointHistory: number[];
  validators: Validator[];
  error: string | null;
};

const state: Record<string, ValidatorsPayload> = {
  mainnet: {
    updatedAt: null,
    total: 0,
    refreshMs: env.VALIDATORS_REFRESH_MS,
    latestCheckpoint: null,
    checkpointHistory: [],
    validators: [],
    error: null,
  },
  testnet: {
    updatedAt: null,
    total: 0,
    refreshMs: env.VALIDATORS_REFRESH_MS,
    latestCheckpoint: null,
    checkpointHistory: [],
    validators: [],
    error: null,
  }
};

type GeoPoint = {
  lat: number | null;
  lng: number | null;
  source: string;
  label: string;
};

type GeoCacheEntry = {
  point: GeoPoint;
  expiresAt: number;
};

const GEO_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const GEO_FALLBACK_TTL_MS = 15 * 60 * 1000;

const geoCache = new Map<string, GeoCacheEntry>();
const refreshPromises: Record<string, Promise<ValidatorsPayload> | null> = { mainnet: null, testnet: null };
const lastRefreshMsMap: Record<string, number> = { mainnet: 0, testnet: 0 };
const lastCheckpointRefreshMsMap: Record<string, number> = { mainnet: 0, testnet: 0 };

function hashToUnit(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000000) / 1000000;
}

function approximateCoordinates(seed: string) {
  const lat = -58 + hashToUnit(`${seed}-lat`) * 132;
  const lng = -180 + hashToUnit(`${seed}-lng`) * 360;
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    source: 'approximate',
    label: 'Approximate location (fallback)',
  };
}

function unresolvedLocation(reason: string, host: string | null) {
  const hostLabel = host ? ` for ${host}` : '';
  return {
    lat: null,
    lng: null,
    source: 'unresolved',
    label: `Location unavailable (${reason}${hostLabel})`,
  };
}

function getCachedGeo(hostname: string) {
  const cached = geoCache.get(hostname);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    geoCache.delete(hostname);
    return null;
  }

  return cached.point;
}

function setCachedGeo(hostname: string, point: GeoPoint, ttlMs: number) {
  geoCache.set(hostname, {
    point,
    expiresAt: Date.now() + ttlMs,
  });
}

function parseMultiaddrHost(address = '') {
  const value = String(address);
  const match = value.match(/\/(dns|dns4|dns6|ip4|ip6)\/([^/]+)/i);
  if (!match) {
    return null;
  }

  const protocol = match[1].toLowerCase();
  const host = match[2]?.trim();
  if (!host) {
    return null;
  }

  return {
    host,
    protocol,
  };
}

function parseUrlHost(url = '') {
  const value = String(url).trim();
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.hostname?.trim() || null;
  } catch {
    return null;
  }
}

function formatLocationSource(body: any) {
  const city = typeof body?.city === 'string' ? body.city.trim() : '';
  const region = typeof body?.region === 'string' ? body.region.trim() : '';
  const country = typeof body?.country === 'string' ? body.country.trim() : '';

  if (city && country) {
    return `${city}, ${country}`;
  }
  if (region && country) {
    return `${region}, ${country}`;
  }
  if (country) {
    return country;
  }

  return 'ipwho.is';
}

function formatLocationLabel(city: string, region: string, country: string, fallback: string) {
  if (city && region && country) {
    return `${city}, ${region}, ${country}`;
  }
  if (city && country) {
    return `${city}, ${country}`;
  }
  if (region && country) {
    return `${region}, ${country}`;
  }
  if (country) {
    return country;
  }
  return fallback;
}

function normalizeGeoFromIpWho(body: any): GeoPoint | null {
  if (!body?.success || typeof body?.latitude !== 'number' || typeof body?.longitude !== 'number') {
    return null;
  }

  const city = typeof body?.city === 'string' ? body.city.trim() : '';
  const region = typeof body?.region === 'string' ? body.region.trim() : '';
  const country = typeof body?.country === 'string' ? body.country.trim() : '';
  return {
    lat: Number(body.latitude.toFixed(5)),
    lng: Number(body.longitude.toFixed(5)),
    source: 'ipwho.is',
    label: formatLocationLabel(city, region, country, formatLocationSource(body)),
  };
}

function normalizeGeoFromFreeIpApi(body: any): GeoPoint | null {
  if (typeof body?.latitude !== 'number' || typeof body?.longitude !== 'number') {
    return null;
  }

  const city = typeof body?.cityName === 'string' ? body.cityName.trim() : '';
  const region = typeof body?.regionName === 'string' ? body.regionName.trim() : '';
  const country = typeof body?.countryName === 'string' ? body.countryName.trim() : '';
  return {
    lat: Number(body.latitude.toFixed(5)),
    lng: Number(body.longitude.toFixed(5)),
    source: 'freeipapi.com',
    label: formatLocationLabel(city, region, country, 'freeipapi.com'),
  };
}

function normalizeGeoFromIpInfo(body: any): GeoPoint | null {
  const loc = typeof body?.loc === 'string' ? body.loc.trim() : '';
  if (!loc.includes(',')) {
    return null;
  }

  const [latRaw, lngRaw] = loc.split(',');
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const city = typeof body?.city === 'string' ? body.city.trim() : '';
  const region = typeof body?.region === 'string' ? body.region.trim() : '';
  const country = typeof body?.country === 'string' ? body.country.trim() : '';
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    source: 'ipinfo.io',
    label: formatLocationLabel(city, region, country, 'ipinfo.io'),
  };
}

async function fetchGeoPoint(target: string): Promise<GeoPoint | null> {
  try {
    const response = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(target)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });

    if (response.ok) {
      const body = await response.json();
      const normalized = normalizeGeoFromFreeIpApi(body);
      if (normalized) {
        return normalized;
      }
    }
  } catch {
    // Ignore provider error and continue with another source.
  }

  try {
    const response = await fetch(`https://ipinfo.io/${encodeURIComponent(target)}/json`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    return normalizeGeoFromIpInfo(body);
  } catch {
    // Legacy fallback for environments where newer providers are filtered.
  }

  try {
    const response = await fetch(`https://ipwho.is/${encodeURIComponent(target)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    return normalizeGeoFromIpWho(body);
  } catch {
    return null;
  }
}

async function resolveHostForGeo(hostname: string): Promise<string> {
  if (isIP(hostname)) {
    return hostname;
  }

  try {
    const ipv4 = await dns.lookup(hostname, { family: 4, all: false, verbatim: false });
    if (ipv4?.address) {
      return ipv4.address;
    }
  } catch {
    // Ignore and try generic lookup.
  }

  try {
    const result = await dns.lookup(hostname, { all: false, verbatim: false });
    if (result?.address) {
      return result.address;
    }
  } catch {
    // If DNS lookup fails, providers may still handle a DNS host directly.
  }

  return hostname;
}

async function geolocateHost(hostname: string | null, seed: string) {
  if (!hostname) {
    return approximateCoordinates(seed);
  }

  const cached = getCachedGeo(hostname);
  if (cached) {
    return cached;
  }

  const unresolved = unresolvedLocation('provider failure', hostname);
  const approximate = approximateCoordinates(`${hostname}:${seed}`);
  try {
    const geoTarget = await resolveHostForGeo(hostname);
    const point = await fetchGeoPoint(geoTarget);
    if (!point) {
      setCachedGeo(hostname, approximate, GEO_FALLBACK_TTL_MS);
      return {
        ...approximate,
        label: `${approximate.label} (${unresolved.label})`,
      };
    }

    setCachedGeo(hostname, point, GEO_SUCCESS_TTL_MS);
    return point;
  } catch {
    setCachedGeo(hostname, approximate, GEO_FALLBACK_TTL_MS);
    return {
      ...approximate,
      label: `${approximate.label} (${unresolved.label})`,
    };
  }
}

async function geolocateFromHosts(hosts: Array<string | null>, seed: string) {
  const uniqueHosts = [...new Set(hosts.map((host) => (host || '').trim()).filter(Boolean))];
  for (const host of uniqueHosts) {
    const point = await geolocateHost(host, seed);
    if (point.source !== 'approximate') {
      return {
        point,
        host,
      };
    }
  }

  const fallbackHost = uniqueHosts[0] ?? null;
  const point = await geolocateHost(fallbackHost, seed);
  return {
    point,
    host: fallbackHost,
  };
}

function normalize(raw: RawValidator): Omit<Validator, 'location'> {
  return {
    id: raw.iotaAddress,
    name: raw.name,
    description: raw.description,
    imageUrl: raw.imageUrl,
    projectUrl: raw.projectUrl,
    address: raw.iotaAddress,
    netAddress: raw.netAddress,
    p2pAddress: raw.p2pAddress,
    votingPower: Number(raw.votingPower || 0),
    gasPrice: Number(raw.gasPrice || 0),
    commissionRate: Number(raw.commissionRate || 0) / 100,
    stakingPoolIotaBalance: Number(raw.stakingPoolIotaBalance || 0),
    nextEpochStake: Number(raw.nextEpochStake || 0),
  };
}

async function fetchFromRpc(network: string = 'mainnet'): Promise<Validator[]> {
  const body = await callRpc(env.IOTA_RPC_METHOD, network);

  const validators =
    (body?.result?.activeValidators as RawValidator[] | undefined) ??
    (body?.result?.active_validators as RawValidator[] | undefined);
  if (!Array.isArray(validators)) {
    throw new Error('Invalid RPC response: missing activeValidators');
  }

  const normalized = validators.map(normalize);
  return Promise.all(
    normalized.map(async (validator) => {
      const parsed = parseMultiaddrHost(validator.netAddress) ?? parseMultiaddrHost(validator.p2pAddress);
      const projectHost = parseUrlHost(validator.projectUrl);
      const geo = await geolocateFromHosts([parsed?.host ?? null, projectHost], validator.id);
      return {
        ...validator,
        location: {
          ...geo.point,
          host: geo.host,
        },
      };
    }),
  );
}

async function callRpc(method: string, network: string = 'mainnet') {
  if (process.env.NODE_ENV === 'production' && (!env.IOTA_RPC_AUTH_HEADER || !env.IOTA_RPC_AUTH_TOKEN)) {
    throw new Error('Secure RPC credentials are required in production. Set IOTA_RPC_AUTH_HEADER and IOTA_RPC_AUTH_TOKEN.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (env.IOTA_RPC_AUTH_HEADER && env.IOTA_RPC_AUTH_TOKEN) {
    headers[env.IOTA_RPC_AUTH_HEADER] = env.IOTA_RPC_AUTH_TOKEN;
  }

  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params: [],
  };

  const rpcUrl = network === 'testnet' ? env.IOTA_TESTNET_RPC_URL : env.IOTA_RPC_URL;

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`RPC ${body.error.code}: ${body.error.message}`);
  }

  return body;
}

async function fetchLatestCheckpoint(network: string = 'mainnet') {
  const body = await callRpc(env.IOTA_CHECKPOINT_METHOD, network);
  const result = body?.result;

  if (typeof result === 'number' && Number.isFinite(result)) {
    return Math.floor(result);
  }

  if (typeof result === 'string' && /^\d+$/.test(result)) {
    return Number.parseInt(result, 10);
  }

  const seq = result?.sequenceNumber ?? result?.sequence_number ?? result?.checkpoint;
  if (typeof seq === 'number' && Number.isFinite(seq)) {
    return Math.floor(seq);
  }

  if (typeof seq === 'string' && /^\d+$/.test(seq)) {
    return Number.parseInt(seq, 10);
  }

  throw new Error('Invalid checkpoint RPC response shape');
}

let stalledStartTime: Record<string, number> = { mainnet: Date.now(), testnet: Date.now() };

function pushCheckpoint(checkpoint: number | null, network: string = 'mainnet') {
  if (!Number.isFinite(checkpoint)) {
    return;
  }

  const netState = state[network];
  const value = Math.floor(checkpoint as number);
  const prevVal = netState.checkpointHistory[netState.checkpointHistory.length - 1];
  const isPrevValid = typeof prevVal === 'number' && prevVal > 0;
  const prev = isPrevValid ? prevVal : null;

  if (typeof prev !== 'number') {
    netState.checkpointHistory = [value];
    stalledStartTime[network] = Date.now();
    return;
  }

  if (value > prev) {
    const delta = value - prev;
    if (delta <= env.CHECKPOINT_HISTORY_SIZE) {
      // Wszystkie zagubione iteracje podczas opóźnienia to nadal 100% sfinalizowane w konsensusie bloki
      for (let i = 1; i <= delta; i += 1) {
        netState.checkpointHistory.push(prev + i);
      }
    } else {
      netState.checkpointHistory.push(value);
    }
    stalledStartTime[network] = Date.now();
  } else if (value === prev) {
    const stallTime = Date.now() - stalledStartTime[network];
    // Średni czas ról bloków IOTA to ok 400-500ms. Jeśli przerwa przekroczy mocno ten threshold (~2500ms), oznaczamy zacięcie węzła
    if (stallTime > 2500) {
      // Używamy sztucznego ujemnego ID jako symbolicznego "przedawnionego ticka"
      const fakeTimeoutId = -Math.floor(Date.now() / 100);
      // Skracamy interwał następnego zacięcia o połowę, by pchać bloczki równomierniej
      stalledStartTime[network] = Date.now() - 1500;
      netState.checkpointHistory.push(fakeTimeoutId);
    }
  } else {
    // Cofnięcie odczytu, node resync. Normalizujemy podając wprost odczytaną iteracje
    netState.checkpointHistory.push(value);
    stalledStartTime[network] = Date.now();
  }

  if (netState.checkpointHistory.length > env.CHECKPOINT_HISTORY_SIZE) {
    netState.checkpointHistory = netState.checkpointHistory.slice(-env.CHECKPOINT_HISTORY_SIZE);
  }
}

export async function getLiveValidators(force = false, network: string = 'mainnet'): Promise<ValidatorsPayload> {
  const now = Date.now();
  const netState = state[network];

  const validatorsFresh = now - lastRefreshMsMap[network] < env.VALIDATORS_REFRESH_MS;
  const checkpointFresh = now - lastCheckpointRefreshMsMap[network] < env.CHECKPOINT_REFRESH_MS;
  const shouldRefreshValidators = force || netState.validators.length === 0 || !validatorsFresh;
  const shouldRefreshCheckpoint = force || !checkpointFresh;

  if (!shouldRefreshValidators && !shouldRefreshCheckpoint) {
    return netState;
  }

  if (!refreshPromises[network]) {
    refreshPromises[network] = (async () => {
      try {
        const [validators, latestCheckpoint] = await Promise.all([
          shouldRefreshValidators ? fetchFromRpc(network) : Promise.resolve<Validator[] | null>(null),
          shouldRefreshCheckpoint ? fetchLatestCheckpoint(network).catch(() => null) : Promise.resolve<number | null | undefined>(undefined),
        ]);

        if (validators) {
          netState.validators = validators;
          netState.total = validators.length;
          lastRefreshMsMap[network] = Date.now();
        }

        if (typeof latestCheckpoint !== 'undefined') {
          netState.latestCheckpoint = latestCheckpoint;
          pushCheckpoint(latestCheckpoint, network);
          lastCheckpointRefreshMsMap[network] = Date.now();
        }

        netState.refreshMs = env.CHECKPOINT_REFRESH_MS;
        netState.updatedAt = new Date().toISOString();
        netState.error = null;
      } catch (error) {
        netState.error = error instanceof Error ? error.message : 'Unknown refresh error';
      }

      return netState;
    })().finally(() => {
      refreshPromises[network] = null;
    });
  }

  return refreshPromises[network] as Promise<ValidatorsPayload>;
}

export function getRefreshMs() {
  return env.VALIDATORS_REFRESH_MS;
}

export function getCheckpointRefreshMs() {
  return env.CHECKPOINT_REFRESH_MS;
}
