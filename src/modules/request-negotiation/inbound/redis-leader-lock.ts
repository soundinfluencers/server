import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { FilteredNestLogger } from '../../../common/logger/filtered-nest-logger';

// Minimal Redis-backed leader lease. A single key holds the current owner; the
// owner renews it before the TTL expires, and only the owner can renew/release
// (compare-and-set via Lua). If the owner dies, the key expires and another
// instance can take over.
@Injectable()
export class RedisLeaderLock implements OnModuleDestroy {
  private readonly logger = new FilteredNestLogger(RedisLeaderLock.name);
  private readonly client: ReturnType<typeof createClient>;
  private connecting?: Promise<void>;
  private connected = false;

  constructor(config: ConfigService) {
    this.client = createClient({ url: config.getOrThrow<string>('REDIS_URL') });
    this.client.on('error', (err) =>
      this.logger.warn(`Redis lock client error: ${err?.message ?? err}`),
    );
  }

  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (!this.connecting) {
      this.connecting = this.client.connect().then(() => {
        this.connected = true;
      });
    }
    await this.connecting;
  }

  // Acquire the lock only if it is currently free (SET NX PX).
  async acquire(key: string, owner: string, ttlMs: number): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.set(key, owner, { NX: true, PX: ttlMs });
    return result === 'OK';
  }

  // Extend the TTL only while we still own the key.
  async renew(key: string, owner: string, ttlMs: number): Promise<boolean> {
    await this.ensureConnected();
    const result = await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end",
      { keys: [key], arguments: [owner, String(ttlMs)] },
    );
    return result === 1;
  }

  // Release the key only if we still own it.
  async release(key: string, owner: string): Promise<void> {
    if (!this.connected) {
      return;
    }
    try {
      await this.client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        { keys: [key], arguments: [owner] },
      );
    } catch (err: any) {
      this.logger.warn(`Redis lock release failed: ${err?.message ?? err}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) {
      try {
        await this.client.quit();
      } catch {
        /* ignore */
      }
    }
  }
}
