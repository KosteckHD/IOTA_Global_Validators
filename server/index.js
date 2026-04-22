import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';

const app = express();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  IOTA_RPC_URL: z.string().url().default('https://api.mainnet.iota.cafe'),
  IOTA_RPC_METHOD: z.string().default('iotax_getLatestIotaSystemState'),
  VALIDATORS_REFRESH_MS: z.coerce.number().int().min(5000).default(5000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  IOTA_RPC_AUTH_HEADER: z.string().optional(),
  IOTA_RPC_AUTH_TOKEN: z.string().optional(),
});

const env = envSchema.parse(process.env);

app.set('trust proxy', 1);
app.use(helmet());
app.use(express.json({ limit: '64kb' }));
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET'],
    credentials: false,
  }),
);

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
);

const state = {
  updatedAt: null,
  validators: [],
  error: null,
};

const sseClients = new Set();
const geoCache = new Map();

const GEO_FALLBACK_BAND = {
  latMin: -55,
  latMax: 72,
};

function hashToUnit(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000000) / 1000000;
}

function deterministicCoordinates(seed) {
  const latSpan = GEO_FALLBACK_BAND.latMax - GEO_FALLBACK_BAND.latMin;
  const lat = GEO_FALLBACK_BAND.latMin + hashToUnit(`${seed}-lat`) * latSpan;
  const lng = -180 + hashToUnit(`${seed}-lng`) * 360;
  return {
    lat: Number(lat.toFixed(4)),
    lng: Number(lng.toFixed(4)),
    source: 'deterministic-fallback',
  };
}

function extractDnsHost(address = '') {
  const match = String(address).match(/\/dns\/([^/]+)/i);
  return match?.[1] ?? null;
}

async function geolocateHost(hostname, seed) {
  if (!hostname) {
    return deterministicCoordinates(seed);
  }

  if (geoCache.has(hostname)) {
    return geoCache.get(hostname);
  }

  const fallback = deterministicCoordinates(seed);
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(hostname)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      geoCache.set(hostname, fallback);
      return fallback;
    }

    const body = await res.json();
    if (!body.success || typeof body.latitude !== 'number' || typeof body.longitude !== 'number') {
      geoCache.set(hostname, fallback);
      return fallback;
    }

    const point = {
      lat: Number(body.latitude.toFixed(4)),
      lng: Number(body.longitude.toFixed(4)),
      source: 'ipwho.is',
    };

    geoCache.set(hostname, point);
    return point;
  } catch {
    geoCache.set(hostname, fallback);
    return fallback;
  }
}

function normalizeValidator(v) {
  return {
    id: v.iotaAddress,
    name: v.name,
    description: v.description,
    imageUrl: v.imageUrl,
    projectUrl: v.projectUrl,
    address: v.iotaAddress,
    netAddress: v.netAddress,
    p2pAddress: v.p2pAddress,
    votingPower: Number(v.votingPower || 0),
    gasPrice: Number(v.gasPrice || 0),
    commissionRate: Number(v.commissionRate || 0) / 100,
    stakingPoolIotaBalance: Number(v.stakingPoolIotaBalance || 0),
    nextEpochStake: Number(v.nextEpochStake || 0),
  };
}

async function fetchValidatorsFromRpc() {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (env.IOTA_RPC_AUTH_HEADER && env.IOTA_RPC_AUTH_TOKEN) {
    headers[env.IOTA_RPC_AUTH_HEADER] = env.IOTA_RPC_AUTH_TOKEN;
  }

  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: env.IOTA_RPC_METHOD,
    params: [],
  };

  const response = await fetch(env.IOTA_RPC_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(`RPC ${body.error.code}: ${body.error.message}`);
  }

  const validators = body?.result?.activeValidators;
  if (!Array.isArray(validators)) {
    throw new Error('Invalid RPC response: result.activeValidators missing');
  }

  const normalized = validators.map(normalizeValidator);
  const withCoordinates = await Promise.all(
    normalized.map(async (validator) => {
      const dnsHost = extractDnsHost(validator.netAddress) ?? extractDnsHost(validator.p2pAddress);
      const geo = await geolocateHost(dnsHost, validator.name);
      return {
        ...validator,
        location: {
          ...geo,
          host: dnsHost,
        },
      };
    }),
  );

  return withCoordinates;
}

function toPublicPayload() {
  return {
    updatedAt: state.updatedAt,
    total: state.validators.length,
    validators: state.validators,
    error: state.error,
  };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(toPublicPayload())}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

async function refreshValidators() {
  try {
    const validators = await fetchValidatorsFromRpc();
    state.validators = validators;
    state.updatedAt = new Date().toISOString();
    state.error = null;
  } catch (error) {
    state.error = error instanceof Error ? error.message : 'Unknown refresh error';
  }

  broadcast();
}

app.get('/api/validators', (_req, res) => {
  res.json(toPublicPayload());
});

app.get('/api/validators/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  res.write(`retry: ${Math.max(3000, env.VALIDATORS_REFRESH_MS)}\n\n`);
  res.write(`data: ${JSON.stringify(toPublicPayload())}\n\n`);

  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
    res.end();
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    updatedAt: state.updatedAt,
    validatorCount: state.validators.length,
    streamClients: sseClients.size,
  });
});

app.listen(env.PORT, async () => {
  await refreshValidators();
  setInterval(refreshValidators, env.VALIDATORS_REFRESH_MS);
  console.log(`IOTA validators API listening on http://localhost:${env.PORT}`);
});
