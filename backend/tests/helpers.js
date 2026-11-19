import { pool, dbNow } from '../src/config/db.js';
import { migrate } from '../src/config/migrate.js';

export async function resetDb() {
  await migrate();
  await pool.query('TRUNCATE auction_activity_logs, bids, rfqs, suppliers RESTART IDENTITY CASCADE');
}

export async function addSuppliers(...names) {
  const ids = [];
  for (const name of names) {
    const { rows } = await pool.query('INSERT INTO suppliers (name) VALUES ($1) RETURNING id', [name]);
    ids.push(rows[0].id);
  }
  return ids;
}

// Inserts an RFQ directly so tests can use times in the past.
// Offsets are in seconds relative to the database clock.
export async function insertRfq({
  startIn = -60,
  closeIn = 60,
  forcedIn = closeIn + 300,
  window = 2,
  extension = 1,
  trigger = 'ANY_BID',
} = {}) {
  const now = await dbNow();
  const at = (seconds) => new Date(now.getTime() + seconds * 1000);
  const { rows } = await pool.query(
    `INSERT INTO rfqs (
       reference_id, name, pickup_date, bid_start_time, original_close_time, current_close_time,
       forced_close_time, trigger_window_minutes, extension_minutes, extension_trigger
     )
     VALUES ('RFQ-' || nextval('rfqs_id_seq'), 'Test RFQ', '2030-01-01', $1, $2, $2, $3, $4, $5, $6)
     RETURNING *`,
    [at(startIn), at(closeIn), at(forcedIn), window, extension, trigger],
  );
  return rows[0];
}

export function bidBody(supplierId, total, overrides = {}) {
  return {
    supplierId,
    carrierName: 'Test Carrier',
    freightCharges: total,
    originCharges: 0,
    destinationCharges: 0,
    transitTimeDays: 5,
    quoteValidityDate: '2030-01-01',
    ...overrides,
  };
}

export async function getRfq(id) {
  const { rows } = await pool.query('SELECT * FROM rfqs WHERE id = $1', [id]);
  return rows[0];
}

export async function getLogs(rfqId, eventType) {
  const { rows } = await pool.query(
    'SELECT * FROM auction_activity_logs WHERE rfq_id = $1 AND event_type = $2 ORDER BY id',
    [rfqId, eventType],
  );
  return rows;
}

export { pool };
