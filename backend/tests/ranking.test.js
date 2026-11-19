import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSuppliers } from '../src/services/ranking.service.js';

const bid = (id, supplierId, totalPrice) => ({ id, supplierId, supplierName: supplierId, totalPrice });

test('ranks suppliers by their lowest total, L1 first', () => {
  const ranking = rankSuppliers([bid(1, 'A', '1500.00'), bid(2, 'B', '1200.00'), bid(3, 'C', '1350.50')]);
  assert.deepEqual(
    ranking.map((r) => [r.rankLabel, r.supplierId]),
    [['L1', 'B'], ['L2', 'C'], ['L3', 'A']],
  );
});

test('uses only the best bid of each supplier', () => {
  const ranking = rankSuppliers([bid(1, 'A', '1500.00'), bid(2, 'B', '1400.00'), bid(3, 'A', '1300.00')]);
  assert.equal(ranking.length, 2);
  assert.equal(ranking[0].supplierId, 'A');
  assert.equal(ranking[0].totalPrice, '1300.00');
});

test('on a tie, the supplier who bid first ranks higher', () => {
  const ranking = rankSuppliers([bid(7, 'B', '1000.00'), bid(3, 'A', '1000.00')]);
  assert.equal(ranking[0].supplierId, 'A');
});

test('compares money exactly, without float rounding', () => {
  const ranking = rankSuppliers([bid(1, 'A', '0.30'), bid(2, 'B', '0.29')]);
  assert.equal(ranking[0].supplierId, 'B');
});
