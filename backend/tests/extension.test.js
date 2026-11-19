import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isInsideTriggerWindow,
  hasTriggerFired,
  calculateNewCloseTime,
  decideExtension,
} from '../src/services/extension.service.js';

const close = new Date('2026-12-01T18:00:00Z');
const forced = new Date('2026-12-01T18:30:00Z');
const at = (time) => new Date(`2026-12-01T${time}Z`);

const ranking = (...names) =>
  names.map((name, i) => ({ supplierId: name, supplierName: name, rank: i + 1, rankLabel: `L${i + 1}` }));

function rfq(trigger, overrides = {}) {
  return {
    currentCloseTime: close,
    forcedCloseTime: forced,
    triggerWindowMinutes: 10,
    extensionMinutes: 5,
    extensionTrigger: trigger,
    ...overrides,
  };
}

describe('trigger window', () => {
  test('starts exactly X minutes before close', () => {
    assert.equal(isInsideTriggerWindow(at('17:50:00'), close, 10), true);
    assert.equal(isInsideTriggerWindow(at('17:49:59.999'), close, 10), false);
  });

  test('ends just before the close time', () => {
    assert.equal(isInsideTriggerWindow(at('17:59:59.999'), close, 10), true);
    assert.equal(isInsideTriggerWindow(close, close, 10), false);
  });
});

describe('extension decision', () => {
  test('bid before the trigger window does not extend', () => {
    const d = decideExtension({
      rfq: rfq('ANY_BID'),
      now: at('17:40:00'),
      before: ranking('A'),
      after: ranking('B', 'A'),
      supplierName: 'B',
    });
    assert.equal(d.extend, false);
  });

  test('any bid inside the window extends by Y', () => {
    const d = decideExtension({
      rfq: rfq('ANY_BID'),
      now: at('17:55:00'),
      before: ranking('A', 'B'),
      after: ranking('A', 'B'),
      supplierName: 'B',
    });
    assert.equal(d.extend, true);
    assert.deepEqual(d.newCloseTime, at('18:05:00'));
    assert.match(d.reason, /Bid received from B within the last 10 minutes/);
  });

  test('rank change inside the window extends', () => {
    const d = decideExtension({
      rfq: rfq('ANY_RANK_CHANGE'),
      now: at('17:58:00'),
      before: ranking('A', 'B'),
      after: ranking('B', 'A'),
      supplierName: 'B',
    });
    assert.equal(d.extend, true);
    assert.match(d.reason, /B L2 → L1, A L1 → L2/);
  });

  test('ranks unchanged inside the window does not extend', () => {
    const d = decideExtension({
      rfq: rfq('ANY_RANK_CHANGE'),
      now: at('17:58:00'),
      before: ranking('A', 'B'),
      after: ranking('A', 'B'),
      supplierName: 'A',
    });
    assert.equal(d.extend, false);
  });

  test('L1 change inside the window extends', () => {
    const d = decideExtension({
      rfq: rfq('L1_CHANGE'),
      now: at('17:59:00'),
      before: ranking('A', 'B', 'C'),
      after: ranking('C', 'A', 'B'),
      supplierName: 'C',
    });
    assert.equal(d.extend, true);
    assert.match(d.reason, /L1 changed from A to C/);
  });

  test('only L2 changing does not extend an L1_CHANGE auction', () => {
    const d = decideExtension({
      rfq: rfq('L1_CHANGE'),
      now: at('17:59:00'),
      before: ranking('A', 'B', 'C'),
      after: ranking('A', 'C', 'B'),
      supplierName: 'C',
    });
    assert.equal(d.extend, false);
  });

  test('close + Y later than forced close is capped at forced close', () => {
    const d = decideExtension({
      rfq: rfq('ANY_BID', { currentCloseTime: at('18:28:00') }),
      now: at('18:27:00'),
      before: [],
      after: ranking('A'),
      supplierName: 'A',
    });
    assert.deepEqual(d.newCloseTime, forced);
    assert.match(d.reason, /capped at forced close/);
  });

  test('no extension once the close has reached the forced close', () => {
    const d = decideExtension({
      rfq: rfq('ANY_BID', { currentCloseTime: forced }),
      now: at('18:29:00'),
      before: [],
      after: ranking('A'),
      supplierName: 'A',
    });
    assert.equal(d.extend, false);
    assert.match(d.reason, /already at its forced close/);
  });
});

describe('first bids and new suppliers', () => {
  test('a first-ever bid counts as an L1 change', () => {
    assert.equal(hasTriggerFired('L1_CHANGE', [], ranking('A')), true);
  });

  test('a new supplier joining the ranking counts as a rank change', () => {
    assert.equal(hasTriggerFired('ANY_RANK_CHANGE', ranking('A'), ranking('A', 'B')), true);
  });

  test('a supplier lowering their price without overtaking anyone is not a rank change', () => {
    assert.equal(hasTriggerFired('ANY_RANK_CHANGE', ranking('A', 'B'), ranking('A', 'B')), false);
  });
});

test('calculateNewCloseTime never returns a time after forced close', () => {
  assert.deepEqual(calculateNewCloseTime(at('18:00:00'), 5, forced), at('18:05:00'));
  assert.deepEqual(calculateNewCloseTime(at('18:29:00'), 5, forced), forced);
});
