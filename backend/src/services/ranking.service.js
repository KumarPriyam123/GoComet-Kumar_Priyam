import { toPaise } from '../utils/money.js';

// bids: rows with at least { id, supplierId, totalPrice }.
// Each supplier is ranked by their lowest bid. Since a new bid must beat the
// supplier's own previous one, that is also their latest bid.
// Ties go to whoever placed the bid first (lower id = accepted earlier).
export function rankSuppliers(bids) {
  const best = new Map();
  for (const bid of bids) {
    const current = best.get(bid.supplierId);
    if (!current || isBetter(bid, current)) best.set(bid.supplierId, bid);
  }

  return [...best.values()]
    .sort((a, b) => (isBetter(a, b) ? -1 : 1))
    .map((bid, i) => ({ ...bid, rank: i + 1, rankLabel: `L${i + 1}` }));
}

function isBetter(a, b) {
  const diff = toPaise(a.totalPrice) - toPaise(b.totalPrice);
  return diff !== 0 ? diff < 0 : a.id < b.id;
}

export function findSupplierBest(bids, supplierId) {
  return rankSuppliers(bids.filter((b) => b.supplierId === supplierId))[0] ?? null;
}
