try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment.
}

export const config = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  closeJobIntervalMs: Number(process.env.CLOSE_JOB_INTERVAL_MS) || 5000,
};

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
}
