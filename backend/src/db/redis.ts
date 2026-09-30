import { Redis } from 'ioredis';
import { config } from '../config/index.js';

let redisClient: Redis | null = null;
let isConnected = false;

// Robust Fallback in-memory store if Redis server is offline/reconnecting
const memoryFallbackStore = new Map<string, { value: string; expiresAt?: number }>();
const memoryHashFallbackStore = new Map<string, Map<string, string>>();

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy(times) {
        if (times > 3) return null; // stop aggressive retries if redis is not running
        return Math.min(times * 300, 2000);
      },
      lazyConnect: true
    });

    redisClient.on('connect', () => {
      isConnected = true;
      console.log('[Redis] Connected to Redis distributed cache & state store.');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    redisClient.on('error', (_err) => {
      isConnected = false;
      // Quiet background error logging to prevent console spam
    });
  }
  return redisClient;
}

/**
 * Check if Redis is actively connected
 */
export function isRedisConnected(): boolean {
  return isConnected;
}

/**
 * Generic Set JSON with optional TTL
 */
export async function setJson<T = any>(key: string, data: T, ttlSeconds?: number): Promise<void> {
  const val = JSON.stringify(data);
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, val, 'EX', ttlSeconds);
      } else {
        await client.set(key, val);
      }
    }
  } catch (_err) {
    // fallback
  }

  const expiresAt = ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined;
  memoryFallbackStore.set(key, { value: val, expiresAt });
}

/**
 * Generic Get JSON
 */
export async function getJson<T = any>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      const res = await client.get(key);
      if (res) return JSON.parse(res) as T;
    }
  } catch (_err) {
    // fallback
  }

  const mem = memoryFallbackStore.get(key);
  if (mem) {
    if (!mem.expiresAt || mem.expiresAt > Date.now()) {
      return JSON.parse(mem.value) as T;
    } else {
      memoryFallbackStore.delete(key);
    }
  }
  return null;
}

/**
 * Acquire a distributed lock with automatic TTL expiration
 */
export async function acquireLock(key: string, ttlSeconds: number = 10): Promise<boolean> {
  const lockKey = `lock:${key}`;
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      const result = await client.set(lockKey, 'LOCKED', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    }
  } catch (_err) {
    // Fallback to in-memory lock
  }

  const now = Date.now();
  const existing = memoryFallbackStore.get(lockKey);
  if (existing && (!existing.expiresAt || existing.expiresAt > now)) {
    return false;
  }
  memoryFallbackStore.set(lockKey, { value: 'LOCKED', expiresAt: now + ttlSeconds * 1000 });
  return true;
}

/**
 * Release a distributed lock
 */
export async function releaseLock(key: string): Promise<void> {
  const lockKey = `lock:${key}`;
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      await client.del(lockKey);
    }
  } catch (_err) {
    // ignore
  }
  memoryFallbackStore.delete(lockKey);
}

/**
 * -------------------------------------------------------------
 * 1. Live Telemetry Cache (Latest 1-sec Sensor Tick per Machine)
 * -------------------------------------------------------------
 */
export async function setLatestTelemetry(machineCode: string, telemetry: Record<string, any>, ttlSeconds: number = 600): Promise<void> {
  const key = `machine:${machineCode}:telemetry:latest`;
  await setJson(key, telemetry, ttlSeconds);
}

export async function getLatestTelemetry(machineCode: string): Promise<Record<string, any> | null> {
  const key = `machine:${machineCode}:telemetry:latest`;
  return await getJson<Record<string, any>>(key);
}

/**
 * -------------------------------------------------------------
 * 2. Machine Operational Live State
 * -------------------------------------------------------------
 */
export async function setMachineLiveState(machineCode: string, state: Record<string, any>, ttlSeconds: number = 86400): Promise<void> {
  const key = `machine:${machineCode}:state`;
  await setJson(key, state, ttlSeconds);
}

export async function getMachineLiveState(machineCode: string): Promise<Record<string, any> | null> {
  const key = `machine:${machineCode}:state`;
  return await getJson<Record<string, any>>(key);
}

/**
 * -------------------------------------------------------------
 * 3. Plant Power & Substation Safety Grid State
 * -------------------------------------------------------------
 */
export async function setPlantPowerGridState(powerState: Record<string, any>): Promise<void> {
  const key = `plant:power:grid_state`;
  await setJson(key, powerState);
}

export async function getPlantPowerGridState(): Promise<Record<string, any> | null> {
  const key = `plant:power:grid_state`;
  return await getJson<Record<string, any>>(key);
}

/**
 * -------------------------------------------------------------
 * 4. Shift Production Atomic Counters
 * -------------------------------------------------------------
 */
export async function incrementShiftCounter(date: string, shift: string, field: string, incrementBy: number = 1): Promise<number> {
  const key = `shift:${date}:${shift}:counters`;
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      const newVal = await client.hincrby(key, field, incrementBy);
      await client.expire(key, 172800); // 48h TTL
      return newVal;
    }
  } catch (_err) {
    // fallback to memory
  }

  let map = memoryHashFallbackStore.get(key);
  if (!map) {
    map = new Map<string, string>();
    memoryHashFallbackStore.set(key, map);
  }
  const current = parseInt(map.get(field) || '0', 10);
  const updated = current + incrementBy;
  map.set(field, updated.toString());
  return updated;
}

export async function getShiftCounters(date: string, shift: string): Promise<Record<string, number>> {
  const key = `shift:${date}:${shift}:counters`;
  const result: Record<string, number> = {};
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      const raw = await client.hgetall(key);
      if (raw && Object.keys(raw).length > 0) {
        for (const [k, v] of Object.entries(raw)) {
          result[k] = parseInt(v, 10) || 0;
        }
        return result;
      }
    }
  } catch (_err) {
    // fallback
  }

  const map = memoryHashFallbackStore.get(key);
  if (map) {
    for (const [k, v] of map.entries()) {
      result[k] = parseInt(v, 10) || 0;
    }
  }
  return result;
}

/**
 * -------------------------------------------------------------
 * 5. API Response Cache with TTL
 * -------------------------------------------------------------
 */
export async function cacheApiResponse<T = any>(cacheKey: string, data: T, ttlSeconds: number = 60): Promise<void> {
  const key = `cache:api:${cacheKey}`;
  await setJson(key, data, ttlSeconds);
}

export async function getCachedApiResponse<T = any>(cacheKey: string): Promise<T | null> {
  const key = `cache:api:${cacheKey}`;
  return await getJson<T>(key);
}

export async function invalidateCacheKey(cacheKey: string): Promise<void> {
  const key = `cache:api:${cacheKey}`;
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      await client.del(key);
    }
  } catch (_err) {
    // ignore
  }
  memoryFallbackStore.delete(key);
}
