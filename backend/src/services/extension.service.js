import { addMinutes } from '../utils/time.js';

// The window is [close - X, close). A bid at exactly the close time is already
// rejected as late, so it never reaches this check.
export function isInsideTriggerWindow(now, closeTime, windowMinutes) {
  const windowStart = addMinutes(closeTime, -windowMinutes);
  return now >= windowStart && now < closeTime;
}

// before / after are rankings from rankSuppliers(), L1 first.
export function hasTriggerFired(trigger, before, after) {
  switch (trigger) {
    case 'ANY_BID':
      return true;
    case 'ANY_RANK_CHANGE':
      return supplierOrder(before) !== supplierOrder(after);
    case 'L1_CHANGE':
      return before[0]?.supplierId !== after[0]?.supplierId;
    default:
      return false;
  }
}

export function calculateNewCloseTime(currentClose, extensionMinutes, forcedClose) {
  const extended = addMinutes(currentClose, extensionMinutes);
  return extended > forcedClose ? forcedClose : extended;
}

// Returns { extend, newCloseTime, reason } for a bid that has just been saved.
export function decideExtension({ rfq, now, before, after, supplierName }) {
  const closeTime = rfq.currentCloseTime;
  const window = rfq.triggerWindowMinutes;

  if (!isInsideTriggerWindow(now, closeTime, window)) {
    return { extend: false, reason: null };
  }
  if (!hasTriggerFired(rfq.extensionTrigger, before, after)) {
    return { extend: false, reason: null };
  }

  const cause = describeTrigger(rfq.extensionTrigger, before, after, supplierName, window);

  if (closeTime.getTime() >= rfq.forcedCloseTime.getTime()) {
    return {
      extend: false,
      reason: `${cause}, but the auction is already at its forced close time`,
    };
  }

  const newCloseTime = calculateNewCloseTime(closeTime, rfq.extensionMinutes, rfq.forcedCloseTime);
  const capped = newCloseTime.getTime() === rfq.forcedCloseTime.getTime();
  return {
    extend: true,
    newCloseTime,
    reason: capped ? `${cause} (extension capped at forced close time)` : cause,
  };
}

function describeTrigger(trigger, before, after, supplierName, window) {
  const within = `within the last ${window} minute${window === 1 ? '' : 's'}`;

  if (trigger === 'ANY_BID') {
    return `Bid received from ${supplierName} ${within}`;
  }

  if (trigger === 'L1_CHANGE') {
    const previous = before[0]?.supplierName;
    return previous
      ? `L1 changed from ${previous} to ${after[0].supplierName} ${within}`
      : `${after[0].supplierName} became L1 ${within}`;
  }

  const oldRanks = new Map(before.map((r) => [r.supplierId, r.rankLabel]));
  const changes = after
    .filter((r) => oldRanks.get(r.supplierId) !== r.rankLabel)
    .map((r) =>
      oldRanks.has(r.supplierId)
        ? `${r.supplierName} ${oldRanks.get(r.supplierId)} → ${r.rankLabel}`
        : `${r.supplierName} entered at ${r.rankLabel}`,
    );
  return `Ranking changed ${within} (${changes.join(', ')})`;
}

function supplierOrder(ranking) {
  return ranking.map((r) => r.supplierId).join(',');
}
