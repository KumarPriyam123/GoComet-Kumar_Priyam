import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRfqSchema } from '../src/validators/rfq.validator.js';
import { submitBidSchema } from '../src/validators/bid.validator.js';

const validRfq = {
  name: 'Mumbai to Delhi',
  referenceId: 'RFQ-1',
  bidStartTime: '2030-01-01T10:00:00.000Z',
  bidCloseTime: '2030-01-01T11:00:00.000Z',
  forcedCloseTime: '2030-01-01T11:30:00.000Z',
  pickupDate: '2030-01-05',
  triggerWindowMinutes: 10,
  extensionMinutes: 5,
  extensionTrigger: 'L1_CHANGE',
};

const fieldErrors = (result) => result.error.issues.map((i) => i.path.join('.'));

test('accepts a valid RFQ', () => {
  assert.equal(createRfqSchema.safeParse(validRfq).success, true);
});

test('forced close must be after bid close', () => {
  const same = createRfqSchema.safeParse({ ...validRfq, forcedCloseTime: validRfq.bidCloseTime });
  assert.deepEqual(fieldErrors(same), ['forcedCloseTime']);
});

test('bid close must be after bid start', () => {
  const result = createRfqSchema.safeParse({ ...validRfq, bidCloseTime: validRfq.bidStartTime });
  assert.ok(fieldErrors(result).includes('bidCloseTime'));
});

test('X and Y must be positive whole numbers', () => {
  const result = createRfqSchema.safeParse({ ...validRfq, triggerWindowMinutes: 0, extensionMinutes: 1.5 });
  assert.deepEqual(fieldErrors(result).sort(), ['extensionMinutes', 'triggerWindowMinutes']);
});

test('trigger window cannot be longer than the auction', () => {
  const result = createRfqSchema.safeParse({ ...validRfq, triggerWindowMinutes: 61 });
  assert.deepEqual(fieldErrors(result), ['triggerWindowMinutes']);
});

test('rejects an unknown trigger type', () => {
  const result = createRfqSchema.safeParse({ ...validRfq, extensionTrigger: 'SOMETHING' });
  assert.deepEqual(fieldErrors(result), ['extensionTrigger']);
});

const validBid = {
  supplierId: 1,
  carrierName: 'FastShip',
  freightCharges: 1200,
  originCharges: 150,
  destinationCharges: 200.5,
  transitTimeDays: 6,
  quoteValidityDate: '2030-12-31',
};

test('accepts a valid bid', () => {
  assert.equal(submitBidSchema.safeParse(validBid).success, true);
});

test('charges must be >= 0 with at most 2 decimals', () => {
  const result = submitBidSchema.safeParse({ ...validBid, originCharges: -1, destinationCharges: 10.005 });
  assert.deepEqual(fieldErrors(result).sort(), ['destinationCharges', 'originCharges']);
});

test('total must be greater than 0', () => {
  const result = submitBidSchema.safeParse({ ...validBid, freightCharges: 0, originCharges: 0, destinationCharges: 0 });
  assert.deepEqual(fieldErrors(result), ['freightCharges']);
});
