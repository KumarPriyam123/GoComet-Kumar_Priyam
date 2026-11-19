import { query, withTransaction, dbNow } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { getAuctionStatus } from './status.service.js';
import { rankSuppliers } from './ranking.service.js';
import { toPaise } from '../utils/money.js';

export function mapRfq(row, now) {
  const rfq = {
    id: row.id,
    referenceId: row.reference_id,
    name: row.name,
    pickupDate: row.pickup_date,
    bidStartTime: row.bid_start_time,
    originalCloseTime: row.original_close_time,
    currentCloseTime: row.current_close_time,
    forcedCloseTime: row.forced_close_time,
    triggerWindowMinutes: row.trigger_window_minutes,
    extensionMinutes: row.extension_minutes,
    extensionTrigger: row.extension_trigger,
    createdAt: row.created_at,
  };
  rfq.status = getAuctionStatus(rfq, now);
  return rfq;
}

export function mapBid(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    carrierName: row.carrier_name,
    freightCharges: row.freight_charges,
    originCharges: row.origin_charges,
    destinationCharges: row.destination_charges,
    totalPrice: row.total_price,
    transitTimeDays: row.transit_time_days,
    quoteValidityDate: row.quote_validity_date,
    createdAt: row.created_at,
  };
}

export async function createRfq(input) {
  return withTransaction(async (client) => {
    const now = await dbNow(client);
    if (input.bidCloseTime <= now) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid RFQ', [
        { field: 'bidCloseTime', message: 'Bid close time must be in the future' },
      ]);
    }

    const { rows } = await client.query(
      `INSERT INTO rfqs (
         reference_id, name, pickup_date, bid_start_time, original_close_time,
         current_close_time, forced_close_time, trigger_window_minutes,
         extension_minutes, extension_trigger
       )
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.referenceId,
        input.name,
        input.pickupDate,
        input.bidStartTime,
        input.bidCloseTime,
        input.forcedCloseTime,
        input.triggerWindowMinutes,
        input.extensionMinutes,
        input.extensionTrigger,
      ],
    );
    const rfq = rows[0];

    await client.query(
      `INSERT INTO auction_activity_logs (rfq_id, event_type, reason, created_at)
       VALUES ($1, 'RFQ_CREATED', $2, $3)`,
      [rfq.id, `RFQ ${rfq.reference_id} created`, now],
    );

    return mapRfq(rfq, now);
  });
}

export async function listRfqs() {
  const now = await dbNow();
  const { rows } = await query(`
    SELECT r.*, l1.total_price AS lowest_bid, l1.supplier_name AS lowest_bidder,
           (SELECT count(*) FROM bids b WHERE b.rfq_id = r.id) AS bid_count
    FROM rfqs r
    LEFT JOIN LATERAL (
      SELECT b.total_price, s.name AS supplier_name
      FROM bids b
      JOIN suppliers s ON s.id = b.supplier_id
      WHERE b.rfq_id = r.id
      ORDER BY b.total_price, b.id
      LIMIT 1
    ) l1 ON true
    ORDER BY r.created_at DESC
  `);

  const rfqs = rows.map((row) => ({
    ...mapRfq(row, now),
    lowestBid: row.lowest_bid,
    lowestBidder: row.lowest_bidder,
    bidCount: row.bid_count,
  }));
  return { serverTime: now, rfqs };
}

async function findRfqRow(id) {
  const { rows } = await query('SELECT * FROM rfqs WHERE id = $1', [id]);
  if (!rows[0]) throw AppError.notFound('RFQ not found');
  return rows[0];
}

export async function getBidsForRfq(rfqId, client = { query }) {
  const { rows } = await client.query(
    `SELECT b.*, s.name AS supplier_name
     FROM bids b
     JOIN suppliers s ON s.id = b.supplier_id
     WHERE b.rfq_id = $1
     ORDER BY b.id`,
    [rfqId],
  );
  return rows.map(mapBid);
}

export async function getRfqDetails(id) {
  const now = await dbNow();
  const row = await findRfqRow(id);
  const bids = await getBidsForRfq(id);
  return {
    serverTime: now,
    rfq: mapRfq(row, now),
    ranking: rankSuppliers(bids),
    bidCount: bids.length,
  };
}

export async function getRankedBids(id) {
  await findRfqRow(id);
  const bids = await getBidsForRfq(id);
  return {
    ranking: rankSuppliers(bids),
    allBids: [...bids].sort((a, b) => toPaise(a.totalPrice) - toPaise(b.totalPrice) || a.id - b.id),
  };
}

export async function getActivity(id) {
  await findRfqRow(id);
  const { rows } = await query(
    `SELECT id, event_type, bid_id, old_close_time, new_close_time, reason, created_at
     FROM auction_activity_logs
     WHERE rfq_id = $1
     ORDER BY created_at, id`,
    [id],
  );
  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    bidId: row.bid_id,
    oldCloseTime: row.old_close_time,
    newCloseTime: row.new_close_time,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
