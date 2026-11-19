import { pool, dbNow } from '../src/config/db.js';
import { addMinutes } from '../src/utils/time.js';

// Resets the database to a small, known set of data:
//  - 4 suppliers
//  - RFQ-DEMO-001: the guide's manual test (closes in 3 min, X = 2, Y = 1, forced close in 6 min)
//  - RFQ-2026-002: an active auction with a few bids
//  - RFQ-2026-003: an auction that has already closed

const suppliers = ['FastShip Logistics', 'BlueOcean Freight', 'Northline Cargo', 'Swift Movers'];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'TRUNCATE auction_activity_logs, bids, rfqs, suppliers RESTART IDENTITY CASCADE',
    );

    const supplierIds = [];
    for (const name of suppliers) {
      const { rows } = await client.query(
        'INSERT INTO suppliers (name) VALUES ($1) RETURNING id',
        [name],
      );
      supplierIds.push(rows[0].id);
    }

    const now = await dbNow(client);

    await createRfq(client, {
      referenceId: 'RFQ-DEMO-001',
      name: 'Demo: Mumbai to Delhi, 2 containers',
      start: addMinutes(now, -1),
      close: addMinutes(now, 3),
      forced: addMinutes(now, 6),
      window: 2,
      extension: 1,
      trigger: 'L1_CHANGE',
    });

    const active = await createRfq(client, {
      referenceId: 'RFQ-2026-002',
      name: 'Chennai to Singapore, 40ft reefer',
      start: addMinutes(now, -60),
      close: addMinutes(now, 45),
      forced: addMinutes(now, 75),
      window: 10,
      extension: 5,
      trigger: 'ANY_RANK_CHANGE',
    });
    await addBid(client, active, supplierIds[0], 'FastShip Logistics', [52000, 4500, 6000], addMinutes(now, -50));
    await addBid(client, active, supplierIds[1], 'BlueOcean Freight', [50500, 5000, 5500], addMinutes(now, -40));
    await addBid(client, active, supplierIds[2], 'Northline Cargo', [54000, 4000, 4800], addMinutes(now, -20));

    const closed = await createRfq(client, {
      referenceId: 'RFQ-2026-003',
      name: 'Pune to Bengaluru, full truck load',
      start: addMinutes(now, -180),
      close: addMinutes(now, -60),
      forced: addMinutes(now, -30),
      window: 10,
      extension: 5,
      trigger: 'ANY_BID',
      status: 'CLOSED',
    });
    await addBid(client, closed, supplierIds[3], 'Swift Movers', [38000, 1500, 1500], addMinutes(now, -150));
    await addBid(client, closed, supplierIds[0], 'FastShip Logistics', [36500, 1800, 1200], addMinutes(now, -120));
    await client.query(
      `INSERT INTO auction_activity_logs (rfq_id, event_type, reason, created_at)
       VALUES ($1, 'AUCTION_CLOSED', 'Auction closed at its closing time', $2)`,
      [closed, addMinutes(now, -60)],
    );

    await client.query('COMMIT');
    console.log(`seeded ${suppliers.length} suppliers and 3 RFQs`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function createRfq(client, r) {
  const { rows } = await client.query(
    `INSERT INTO rfqs (
       reference_id, name, pickup_date, bid_start_time, original_close_time, current_close_time,
       forced_close_time, trigger_window_minutes, extension_minutes, extension_trigger, status,
       created_at
     )
     VALUES ($1, $2, ($5::timestamptz + interval '7 days')::date, $3, $4, $4, $5, $6, $7, $8, $9, $3)
     RETURNING id`,
    [r.referenceId, r.name, r.start, r.close, r.forced, r.window, r.extension, r.trigger, r.status ?? 'ACTIVE'],
  );
  const id = rows[0].id;
  await client.query(
    `INSERT INTO auction_activity_logs (rfq_id, event_type, reason, created_at)
     VALUES ($1, 'RFQ_CREATED', $2, $3)`,
    [id, `RFQ ${r.referenceId} created`, r.start],
  );
  return id;
}

async function addBid(client, rfqId, supplierId, supplierName, [freight, origin, destination], at) {
  const { rows } = await client.query(
    `INSERT INTO bids (
       rfq_id, supplier_id, carrier_name, freight_charges, origin_charges, destination_charges,
       transit_time_days, quote_validity_date, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, ($8::timestamptz + interval '30 days')::date, $8)
     RETURNING id, total_price`,
    [rfqId, supplierId, supplierName, freight, origin, destination, 5, at],
  );
  await client.query(
    `INSERT INTO auction_activity_logs (rfq_id, event_type, bid_id, reason, created_at)
     VALUES ($1, 'BID_SUBMITTED', $2, $3, $4)`,
    [rfqId, rows[0].id, `${supplierName} bid ₹${rows[0].total_price}`, at],
  );
}

seed()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
