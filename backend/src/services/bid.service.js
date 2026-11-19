import { withTransaction, dbNow } from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { toPaise, fromPaise } from '../utils/money.js';
import { dateInAppTimezone } from '../utils/time.js';
import { mapRfq, mapBid, getBidsForRfq } from './rfq.service.js';
import { rankSuppliers, findSupplierBest } from './ranking.service.js';
import { decideExtension } from './extension.service.js';

// Everything happens in one transaction with the RFQ row locked, so two bids
// on the same auction are processed one after the other and can never both
// extend from the same old close time.
export async function submitBid(rfqId, input) {
  return withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM rfqs WHERE id = $1 FOR UPDATE', [rfqId]);
    if (!rows[0]) throw AppError.notFound('RFQ not found');

    // Read the time only after we hold the lock. now() would give the time the
    // transaction started, which can be before a long wait for the lock.
    const now = await dbNow(client);
    const rfq = mapRfq(rows[0], now);

    if (now < rfq.bidStartTime) {
      throw new AppError(409, 'AUCTION_NOT_STARTED', 'Bidding has not started yet.');
    }
    if (now >= rfq.currentCloseTime) {
      throw new AppError(409, 'AUCTION_CLOSED', 'This auction is no longer accepting bids.');
    }

    const supplier = await findSupplier(client, input.supplierId);

    if (input.quoteValidityDate < dateInAppTimezone(now)) {
      throw validationError('quoteValidityDate', 'Quote validity date cannot be in the past');
    }

    const total = toPaise(input.freightCharges) + toPaise(input.originCharges) + toPaise(input.destinationCharges);
    const bids = await getBidsForRfq(rfqId, client);
    const previous = findSupplierBest(bids, supplier.id);
    if (previous && total >= toPaise(previous.totalPrice)) {
      throw new AppError(
        400,
        'BID_NOT_LOWER',
        `Your new total must be lower than your previous bid of ${previous.totalPrice}.`,
      );
    }

    const before = rankSuppliers(bids);
    const bid = await insertBid(client, rfqId, supplier, input, now);
    const after = rankSuppliers([...bids, bid]);
    const myRank = after.find((r) => r.supplierId === supplier.id).rankLabel;

    const decision = decideExtension({ rfq, now, before, after, supplierName: supplier.name });

    let bidNote = `${supplier.name} bid ₹${fromPaise(total)} (${myRank})`;
    if (!decision.extend && decision.reason) bidNote += `. ${decision.reason}`;
    await client.query(
      `INSERT INTO auction_activity_logs (rfq_id, event_type, bid_id, reason, created_at)
       VALUES ($1, 'BID_SUBMITTED', $2, $3, $4)`,
      [rfqId, bid.id, bidNote, now],
    );

    if (decision.extend) {
      await client.query('UPDATE rfqs SET current_close_time = $1 WHERE id = $2', [
        decision.newCloseTime,
        rfqId,
      ]);
      await client.query(
        `INSERT INTO auction_activity_logs
           (rfq_id, event_type, bid_id, old_close_time, new_close_time, reason, created_at)
         VALUES ($1, 'TIME_EXTENDED', $2, $3, $4, $5, $6)`,
        [rfqId, bid.id, rfq.currentCloseTime, decision.newCloseTime, decision.reason, now],
      );
      rfq.currentCloseTime = decision.newCloseTime;
    }

    return {
      bidId: bid.id,
      totalPrice: bid.totalPrice,
      rank: myRank,
      auction: {
        status: rfq.status,
        currentCloseTime: rfq.currentCloseTime,
        extended: decision.extend,
        extensionReason: decision.reason,
      },
    };
  });
}

async function findSupplier(client, supplierId) {
  const { rows } = await client.query('SELECT id, name FROM suppliers WHERE id = $1', [supplierId]);
  if (!rows[0]) throw validationError('supplierId', 'Unknown supplier');
  return rows[0];
}

async function insertBid(client, rfqId, supplier, input, now) {
  const { rows } = await client.query(
    `INSERT INTO bids (
       rfq_id, supplier_id, carrier_name, freight_charges, origin_charges,
       destination_charges, transit_time_days, quote_validity_date, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      rfqId,
      supplier.id,
      input.carrierName,
      input.freightCharges,
      input.originCharges,
      input.destinationCharges,
      input.transitTimeDays,
      input.quoteValidityDate,
      now,
    ],
  );
  return mapBid({ ...rows[0], supplier_name: supplier.name });
}

function validationError(field, message) {
  return new AppError(400, 'VALIDATION_ERROR', message, [{ field, message }]);
}
