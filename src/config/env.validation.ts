const REQUIRED_KEYS = [
  'DATABASE_ROOT',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGINS',
  'EMAIL_USER',
  'EMAIL_PASS',
] as const;

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED_KEYS.filter((key) => {
    const value = config[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const nodeEnv = String(config.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const port = Number(config.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  const redisPrefix = String(
    config.REDIS_PREFIX ?? (nodeEnv === 'production' ? '' : 'soundinfluencers:local'),
  ).trim();

  if (!redisPrefix) {
    throw new Error('REDIS_PREFIX is required in production');
  }

  if (!/^[A-Za-z0-9:_-]+$/.test(redisPrefix)) {
    throw new Error(
      'REDIS_PREFIX may contain only letters, numbers, colon, underscore, and dash',
    );
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: String(port),
    REDIS_PREFIX: redisPrefix,
  };
}
