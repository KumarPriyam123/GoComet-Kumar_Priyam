// Loaded with --import before any test file: point the app at the test database.
try {
  process.loadEnvFile();
} catch {
  // fine, variables may come from the environment
}

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
