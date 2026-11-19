import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuctionStatus } from '../src/services/status.service.js';

const t = (time) => new Date(`2026-12-01T${time}Z`);
const rfq = (currentClose) => ({
  bidStartTime: t('17:00:00'),
  currentCloseTime: t(currentClose),
  forcedCloseTime: t('18:30:00'),
});

test('scheduled before the start, active until the close', () => {
  assert.equal(getAuctionStatus(rfq('18:00:00'), t('16:59:59')), 'SCHEDULED');
  assert.equal(getAuctionStatus(rfq('18:00:00'), t('17:00:00')), 'ACTIVE');
  assert.equal(getAuctionStatus(rfq('18:00:00'), t('17:59:59.999')), 'ACTIVE');
});

test('closed at the normal close time', () => {
  assert.equal(getAuctionStatus(rfq('18:00:00'), t('18:00:00')), 'CLOSED');
});

test('stays closed after the forced close time passes', () => {
  assert.equal(getAuctionStatus(rfq('18:00:00'), t('19:00:00')), 'CLOSED');
});

test('force closed when extensions reached the forced close time', () => {
  assert.equal(getAuctionStatus(rfq('18:30:00'), t('18:30:00')), 'FORCE_CLOSED');
});
