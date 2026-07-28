import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Cache } from 'cache-manager';
import type { Connection } from 'mongoose';

const READINESS_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async ready(): Promise<{ status: 'ready' }> {
    try {
      await this.withTimeout(
        Promise.all([this.checkMongo(), this.checkRedis()]),
        READINESS_TIMEOUT_MS,
      );
      return { status: 'ready' };
    } catch {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }
  }

  private async checkMongo(): Promise<void> {
    if (this.mongoConnection.readyState !== 1 || !this.mongoConnection.db) {
      throw new Error('MongoDB is not connected');
    }

    await this.mongoConnection.db.admin().ping();
  }

  private async checkRedis(): Promise<void> {
    const key = `health:ready:${process.pid}`;
    await this.cache.set(key, 'ok', 5_000);
    const value = await this.cache.get<string>(key);
    await this.cache.del(key);

    if (value !== 'ok') {
      throw new Error('Redis readiness probe failed');
    }
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timeout: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        operation,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('Readiness probe timed out')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
