import { withTransaction, dbNow } from '../config/db.js';
import { mapRfq } from '../services/rfq.service.js';

// Keeps the stored status in step with the clock and writes the
// "auction closed" entries to the activity log. The API never relies on
// this having run: it always works the status out from the current time.
export async function closeAuctions() {
  return withTransaction(async (client) => {
    const now = await dbNow(client);
    const { rows } = await client.query(
      `SELECT * FROM rfqs
       WHERE status IN ('SCHEDULED', 'ACTIVE')
         AND (bid_start_time <= $1 OR current_close_time <= $1)
       FOR UPDATE SKIP LOCKED`,
      [now],
    );

    let closed = 0;
    for (const row of rows) {
      const rfq = mapRfq(row, now);
      if (rfq.status === row.status) continue;

      await client.query('UPDATE rfqs SET status = $1 WHERE id = $2', [rfq.status, rfq.id]);

      if (rfq.status === 'CLOSED' || rfq.status === 'FORCE_CLOSED') {
        const forced = rfq.status === 'FORCE_CLOSED';
        await client.query(
          `INSERT INTO auction_activity_logs (rfq_id, event_type, reason, created_at)
           VALUES ($1, $2, $3, $4)`,
          [
            rfq.id,
            forced ? 'AUCTION_FORCE_CLOSED' : 'AUCTION_CLOSED',
            forced ? 'Auction reached its forced close time' : 'Auction closed at its closing time',
            rfq.currentCloseTime,
          ],
        );
        closed++;
      }
    }
    return closed;
  });
}

export function startCloseAuctionsJob(intervalMs) {
  const run = () => closeAuctions().catch((err) => console.error('close job failed:', err.message));
  run();
  return setInterval(run, intervalMs);
}
