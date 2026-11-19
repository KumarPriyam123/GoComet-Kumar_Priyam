import { test, describe, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { dbNow } from '../src/config/db.js';
import { closeAuctions } from '../src/jobs/closeAuctions.js';
import { resetDb, addSuppliers, insertRfq, bidBody, getRfq, getLogs, pool } from './helpers.js';

let A, B, C;

before(resetDb);
beforeEach(async () => {
  await resetDb();
  [A, B, C] = await addSuppliers('Alpha', 'Bravo', 'Charlie');
});
after(() => pool.end());

const bid = (rfqId, body) => request(app).post(`/api/rfqs/${rfqId}/bids`).send(body);

describe('POST /api/rfqs', () => {
  async function rfqBody(overrides = {}) {
    const now = await dbNow();
    const at = (min) => new Date(now.getTime() + min * 60_000).toISOString();
    return {
      name: 'Mumbai to Delhi',
      referenceId: 'RFQ-2026-001',
      bidStartTime: at(0),
      bidCloseTime: at(30),
      forcedCloseTime: at(45),
      pickupDate: '2030-01-10',
      triggerWindowMinutes: 10,
      extensionMinutes: 5,
      extensionTrigger: 'ANY_BID',
      ...overrides,
    };
  }

  test('creates an RFQ and logs it', async () => {
    const res = await request(app).post('/api/rfqs').send(await rfqBody());
    assert.equal(res.status, 201);
    assert.equal(res.body.referenceId, 'RFQ-2026-001');
    assert.equal(res.body.currentCloseTime, res.body.originalCloseTime);
    assert.equal((await getLogs(res.body.id, 'RFQ_CREATED')).length, 1);
  });

  test('rejects forced close before bid close with a field error', async () => {
    const body = await rfqBody();
    const res = await request(app)
      .post('/api/rfqs')
      .send({ ...body, forcedCloseTime: body.bidStartTime });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.field === 'forcedCloseTime'));
  });

  test('rejects a duplicate reference ID with 409', async () => {
    await request(app).post('/api/rfqs').send(await rfqBody());
    const res = await request(app).post('/api/rfqs').send(await rfqBody());
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'DUPLICATE_REFERENCE_ID');
  });

  test('rejects a close time in the past', async () => {
    const res = await request(app)
      .post('/api/rfqs')
      .send(await rfqBody({ bidStartTime: '2020-01-01T00:00:00Z', bidCloseTime: '2020-01-01T01:00:00Z' }));
    assert.equal(res.status, 400);
  });
});

describe('POST /api/rfqs/:id/bids', () => {
  test('saves a bid and returns its rank', async () => {
    const rfq = await insertRfq({ closeIn: 3600 });
    const res = await bid(rfq.id, bidBody(A, 1200, { originCharges: 150, destinationCharges: 200 }));
    assert.equal(res.status, 201);
    assert.equal(res.body.totalPrice, '1550.00');
    assert.equal(res.body.rank, 'L1');
    assert.equal(res.body.auction.extended, false);
  });

  test('a bid inside the window extends the close by Y', async () => {
    const rfq = await insertRfq({ closeIn: 60, window: 2, extension: 1 });
    const res = await bid(rfq.id, bidBody(A, 1000));
    assert.equal(res.body.auction.extended, true);

    const updated = await getRfq(rfq.id);
    assert.equal(updated.current_close_time - rfq.current_close_time, 60_000);
    const [log] = await getLogs(rfq.id, 'TIME_EXTENDED');
    assert.match(log.reason, /Bid received from Alpha/);
  });

  test('a supplier must beat their own previous bid', async () => {
    const rfq = await insertRfq({ closeIn: 3600 });
    await bid(rfq.id, bidBody(A, 1000));
    const res = await bid(rfq.id, bidBody(A, 1000));
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'BID_NOT_LOWER');
  });

  test('a bid after the current close time is rejected', async () => {
    const rfq = await insertRfq({ startIn: -600, closeIn: -10, forcedIn: 300 });
    const res = await bid(rfq.id, bidBody(A, 1000));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'AUCTION_CLOSED');
  });

  test('a bid after the forced close time is rejected', async () => {
    const rfq = await insertRfq({ startIn: -600, closeIn: -120, forcedIn: -60 });
    const res = await bid(rfq.id, bidBody(A, 1000));
    assert.equal(res.status, 409);
  });

  test('a bid exactly at the close time is rejected', async () => {
    const rfq = await insertRfq({ closeIn: 3600 });
    const now = await dbNow();
    await pool.query(
      'UPDATE rfqs SET original_close_time = $1, current_close_time = $1 WHERE id = $2',
      [now, rfq.id],
    );
    const res = await bid(rfq.id, bidBody(A, 1000));
    assert.equal(res.status, 409);
  });

  test('a bid before the start time is rejected', async () => {
    const rfq = await insertRfq({ startIn: 600, closeIn: 1200, forcedIn: 1800 });
    const res = await bid(rfq.id, bidBody(A, 1000));
    assert.equal(res.body.error.code, 'AUCTION_NOT_STARTED');
  });

  test('repeated extensions are each logged and stop at the forced close', async () => {
    const rfq = await insertRfq({ closeIn: 30, forcedIn: 150, window: 2, extension: 1 });
    let price = 2000;
    for (let i = 0; i < 4; i++) {
      const res = await bid(rfq.id, bidBody(i % 2 ? A : B, (price -= 10)));
      assert.equal(res.status, 201);
    }
    const updated = await getRfq(rfq.id);
    assert.deepEqual(updated.current_close_time, updated.forced_close_time);
    // 30s + 1min + 1min reaches 150s, so only the first two bids could extend.
    assert.equal((await getLogs(rfq.id, 'TIME_EXTENDED')).length, 2);
  });

  test('L1_CHANGE only extends when the lowest bidder changes', async () => {
    const rfq = await insertRfq({ closeIn: 60, forcedIn: 900, window: 10, trigger: 'L1_CHANGE' });
    await bid(rfq.id, bidBody(A, 1000)); // first L1: extends
    const second = await bid(rfq.id, bidBody(B, 1100)); // B is L2
    const third = await bid(rfq.id, bidBody(B, 900)); // B takes L1
    assert.equal(second.body.auction.extended, false);
    assert.equal(third.body.auction.extended, true);
    assert.match(third.body.auction.extensionReason, /L1 changed from Alpha to Bravo/);
  });

  test('ANY_RANK_CHANGE does not extend when ranks stay the same', async () => {
    const rfq = await insertRfq({ closeIn: 60, forcedIn: 900, window: 10, trigger: 'ANY_RANK_CHANGE' });
    await bid(rfq.id, bidBody(A, 1000));
    await bid(rfq.id, bidBody(B, 1100));
    const sameRanks = await bid(rfq.id, bidBody(B, 1050));
    const overtake = await bid(rfq.id, bidBody(C, 900));
    assert.equal(sameRanks.body.auction.extended, false);
    assert.equal(overtake.body.auction.extended, true);
  });

  test('rejects an unknown supplier and invalid charges', async () => {
    const rfq = await insertRfq({ closeIn: 3600 });
    assert.equal((await bid(rfq.id, bidBody(999, 1000))).status, 400);
    assert.equal((await bid(rfq.id, bidBody(A, -5))).status, 400);
  });

  test('returns 404 for a missing RFQ', async () => {
    const res = await bid(12345, bidBody(A, 1000));
    assert.equal(res.status, 404);
  });
});

describe('reading auctions', () => {
  test('listing shows the lowest bid, close times and status', async () => {
    const rfq = await insertRfq({ closeIn: 3600 });
    await bid(rfq.id, bidBody(A, 1500));
    await bid(rfq.id, bidBody(B, 1200));

    const res = await request(app).get('/api/rfqs');
    assert.equal(res.status, 200);
    const [row] = res.body.rfqs;
    assert.equal(row.lowestBid, '1200.00');
    assert.equal(row.lowestBidder, 'Bravo');
    assert.equal(row.status, 'ACTIVE');
    assert.ok(row.forcedCloseTime && row.currentCloseTime);
  });

  test('details and bids are ranked L1 first', async () => {
    const rfq = await insertRfq({ closeIn: 3600 });
    await bid(rfq.id, bidBody(A, 1500));
    await bid(rfq.id, bidBody(B, 1200));

    const details = await request(app).get(`/api/rfqs/${rfq.id}`);
    assert.deepEqual(details.body.ranking.map((r) => r.supplierName), ['Bravo', 'Alpha']);
    assert.equal(details.body.rfq.triggerWindowMinutes, 2);

    const bids = await request(app).get(`/api/rfqs/${rfq.id}/bids`);
    assert.equal(bids.body.ranking[0].rankLabel, 'L1');
    assert.equal(bids.body.allBids.length, 2);
  });

  test('activity log is in time order', async () => {
    const rfq = await insertRfq({ closeIn: 60, window: 2 });
    await bid(rfq.id, bidBody(A, 1000));
    const res = await request(app).get(`/api/rfqs/${rfq.id}/activity`);
    assert.deepEqual(res.body.map((e) => e.eventType), ['BID_SUBMITTED', 'TIME_EXTENDED']);
  });

  test('unknown routes and ids return 404', async () => {
    assert.equal((await request(app).get('/api/rfqs/abc')).status, 404);
    assert.equal((await request(app).get('/api/nothing')).status, 404);
  });
});

describe('closing auctions', () => {
  test('marks a finished auction CLOSED and logs it once', async () => {
    const rfq = await insertRfq({ startIn: -600, closeIn: -5, forcedIn: 300 });
    assert.equal(await closeAuctions(), 1);
    assert.equal(await closeAuctions(), 0);
    assert.equal((await getRfq(rfq.id)).status, 'CLOSED');
    assert.equal((await getLogs(rfq.id, 'AUCTION_CLOSED')).length, 1);
  });

  test('marks an auction that hit its forced close FORCE_CLOSED', async () => {
    const rfq = await insertRfq({ startIn: -600, closeIn: -120, forcedIn: -60 });
    await pool.query('UPDATE rfqs SET current_close_time = forced_close_time WHERE id = $1', [rfq.id]);
    await closeAuctions();
    assert.equal((await getRfq(rfq.id)).status, 'FORCE_CLOSED');
  });
});
