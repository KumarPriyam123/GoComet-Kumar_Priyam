// Prices are compared in paise (integers) so we never do float maths on money.

export function toPaise(value) {
  const [rupees, fraction = ''] = String(value).split('.');
  const sign = rupees.startsWith('-') ? -1 : 1;
  return sign * (Math.abs(Number(rupees)) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2)));
}

export function fromPaise(paise) {
  return (paise / 100).toFixed(2);
}

export function hasAtMostTwoDecimals(value) {
  return Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}
