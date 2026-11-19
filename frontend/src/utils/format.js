const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

export function formatMoney(value) {
  return value == null ? '—' : money.format(Number(value));
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
}

export function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const TRIGGER_LABELS = {
  ANY_BID: 'Bid received in last X minutes',
  ANY_RANK_CHANGE: 'Any supplier rank change in last X minutes',
  L1_CHANGE: 'Lowest bidder (L1) change in last X minutes',
};

export const EVENT_LABELS = {
  RFQ_CREATED: 'RFQ created',
  BID_SUBMITTED: 'Bid',
  TIME_EXTENDED: 'Extended',
  AUCTION_CLOSED: 'Closed',
  AUCTION_FORCE_CLOSED: 'Force closed',
};

// Value for <input type="datetime-local"> in the browser's time zone.
export function toLocalInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function localTimezoneName() {
  return new Date()
    .toLocaleTimeString('en-IN', { timeZoneName: 'short' })
    .split(' ')
    .pop();
}
