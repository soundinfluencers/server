import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { Cache } from 'cache-manager';

@Injectable()
export class CacheLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async onApplicationShutdown(): Promise<void> {
    await this.cache.disconnect();
  }
}
