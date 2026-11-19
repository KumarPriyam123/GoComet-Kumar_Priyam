// Status is always worked out from the clock, so it is correct even if the
// background job has not run yet.
//
// An auction that ends at its normal close is CLOSED. It is FORCE_CLOSED only
// if extensions pushed the close all the way to the forced close time. Once an
// auction has ended this never changes.
export function getAuctionStatus(rfq, now) {
  if (now < rfq.bidStartTime) return 'SCHEDULED';
  if (now < rfq.currentCloseTime) return 'ACTIVE';
  return rfq.currentCloseTime.getTime() === rfq.forcedCloseTime.getTime()
    ? 'FORCE_CLOSED'
    : 'CLOSED';
}
