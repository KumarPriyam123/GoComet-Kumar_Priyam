import pg from 'pg';
import { config } from './env.js';

// Return DATE columns as 'YYYY-MM-DD' strings instead of local-midnight Date objects.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Server time from the database, truncated to milliseconds so it matches what JS Date can hold.
export async function dbNow(client = pool) {
  const { rows } = await client.query(
    "SELECT date_trunc('milliseconds', clock_timestamp()) AS now",
  );
  return rows[0].now;
}
