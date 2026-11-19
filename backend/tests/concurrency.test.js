import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { resetDb, addSuppliers, insertRfq, bidBody, getRfq, pool } from './helpers.js';

before(resetDb);
after(() => pool.end());

test('parallel bids near the close keep the auction consistent', async () => {
  const suppliers = await addSuppliers(...Array.from({ length: 10 }, (_, i) => `Supplier ${i + 1}`));
  const rfq = await insertRfq({ closeIn: 2, forcedIn: 90, window: 1, extension: 1, trigger: 'ANY_BID' });

  const results = await Promise.all(
    suppliers.flatMap((id, i) =>
      [0, 1, 2].map((round) =>
        request(app)
          .post(`/api/rfqs/${rfq.id}/bids`)
          .send(bidBody(id, 10_000 - round * 100 - i)),
      ),
    ),
  );

  const accepted = results.filter((r) => r.status === 201).length;
  assert.ok(accepted > 0);
  assert.ok(results.every((r) => [201, 400, 409].includes(r.status)));

  const final = await getRfq(rfq.id);
  assert.ok(final.current_close_time <= final.forced_close_time);

  // Every extension starts where the previous one ended: no two bids extended from the same close.
  const { rows: logs } = await pool.query(
    `SELECT old_close_time, new_close_time FROM auction_activity_logs
     WHERE rfq_id = $1 AND event_type = 'TIME_EXTENDED' ORDER BY id`,
    [rfq.id],
  );
  let close = rfq.current_close_time;
  for (const log of logs) {
    assert.deepEqual(log.old_close_time, close);
    close = log.new_close_time;
  }
  assert.deepEqual(close, final.current_close_time);

  // No accepted bid was placed at or after the close time it was checked against.
  const { rows: late } = await pool.query(
    `SELECT b.id FROM bids b
     JOIN auction_activity_logs l ON l.bid_id = b.id AND l.event_type = 'BID_SUBMITTED'
     WHERE b.rfq_id = $1 AND b.created_at >= $2`,
    [rfq.id, final.current_close_time],
  );
  assert.equal(late.length, 0);
});
