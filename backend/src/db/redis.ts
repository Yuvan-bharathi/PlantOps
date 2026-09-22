import { Redis } from 'ioredis';
import { config } from '../config/index.js';

let redisClient: Redis | null = null;
let isConnected = false;

// Fallback in-memory store if Redis is unavailable
const memoryFallbackStore = new Map<string, { value: string; expiresAt?: number }>();

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
      console.log('[Redis] Connected to Redis distributed state store.');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      // Keep error quiet after initial warning
    });
  }
  return redisClient;
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
  } catch (err) {
    // Fallback to in-memory lock
  }

  // Memory fallback lock
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
  } catch (err) {
    // ignore
  }
  memoryFallbackStore.delete(lockKey);
}

/**
 * Set machine live transient state
 */
export async function setMachineLiveState(machineCode: string, state: Record<string, any>, ttlSeconds: number = 3600): Promise<void> {
  const key = `machine:${machineCode}:state`;
  const val = JSON.stringify(state);
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      await client.set(key, val, 'EX', ttlSeconds);
    }
  } catch (err) {
    // ignore
  }
  memoryFallbackStore.set(key, { value: val, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Get machine live transient state
 */
export async function getMachineLiveState(machineCode: string): Promise<Record<string, any> | null> {
  const key = `machine:${machineCode}:state`;
  try {
    const client = getRedisClient();
    if (client.status === 'ready' || client.status === 'connect') {
      const res = await client.get(key);
      if (res) return JSON.parse(res);
    }
  } catch (err) {
    // ignore
  }

  const mem = memoryFallbackStore.get(key);
  if (mem && (!mem.expiresAt || mem.expiresAt > Date.now())) {
    return JSON.parse(mem.value);
  }
  return null;
}
