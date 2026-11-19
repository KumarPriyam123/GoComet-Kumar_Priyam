import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatMoney } from '../utils/format.js';
import Field from './Field.jsx';

const EMPTY = {
  supplierId: '',
  carrierName: '',
  freightCharges: '',
  originCharges: '',
  destinationCharges: '',
  transitTimeDays: '',
  quoteValidityDate: '',
};

export default function BidForm({ rfqId, disabledReason, onPlaced }) {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
  }, []);

  const total =
    Number(form.freightCharges || 0) + Number(form.originCharges || 0) + Number(form.destinationCharges || 0);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;

    const payload = {
      supplierId: Number(form.supplierId),
      carrierName: form.carrierName,
      freightCharges: Number(form.freightCharges),
      originCharges: Number(form.originCharges),
      destinationCharges: Number(form.destinationCharges),
      transitTimeDays: Number(form.transitTimeDays),
      quoteValidityDate: form.quoteValidityDate,
    };

    const missing = Object.keys(EMPTY).filter((key) => form[key] === '');
    if (missing.length > 0) {
      setErrors(Object.fromEntries(missing.map((key) => [key, 'Required'])));
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const result = await api.submitBid(rfqId, payload);
      setMessage({
        type: 'ok',
        text: `Bid placed. You are ${result.rank}.${result.auction.extended ? ' The auction was extended.' : ''}`,
      });
      setForm((f) => ({ ...EMPTY, supplierId: f.supplierId, carrierName: f.carrierName }));
      onPlaced();
    } catch (err) {
      const fieldErrors = Object.fromEntries((err.details ?? []).map((d) => [d.field, d.message]));
      setErrors(fieldErrors);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (disabledReason) {
    return <p className="notice">{disabledReason}</p>;
  }

  return (
    <form className="form bid-form" onSubmit={submit} noValidate>
      <div className="grid">
        <Field label="Supplier" error={errors.supplierId}>
          <select value={form.supplierId} onChange={(e) => update('supplierId', e.target.value)}>
            <option value="">Select supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Carrier name" error={errors.carrierName}>
          <input value={form.carrierName} onChange={(e) => update('carrierName', e.target.value)} />
        </Field>
        <Field label="Freight charges (₹)" error={errors.freightCharges}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.freightCharges}
            onChange={(e) => update('freightCharges', e.target.value)}
          />
        </Field>
        <Field label="Origin charges (₹)" error={errors.originCharges}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.originCharges}
            onChange={(e) => update('originCharges', e.target.value)}
          />
        </Field>
        <Field label="Destination charges (₹)" error={errors.destinationCharges}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.destinationCharges}
            onChange={(e) => update('destinationCharges', e.target.value)}
          />
        </Field>
        <Field label="Transit time (days)" error={errors.transitTimeDays}>
          <input
            type="number"
            min="1"
            step="1"
            value={form.transitTimeDays}
            onChange={(e) => update('transitTimeDays', e.target.value)}
          />
        </Field>
        <Field label="Quote valid until" error={errors.quoteValidityDate}>
          <input
            type="date"
            value={form.quoteValidityDate}
            onChange={(e) => update('quoteValidityDate', e.target.value)}
          />
        </Field>
      </div>

      <div className="form-footer">
        <span>
          Total: <strong>{formatMoney(total)}</strong>
        </span>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Placing bid…' : 'Place bid'}
        </button>
      </div>

      {message && <p className={message.type === 'ok' ? 'success' : 'error'}>{message.text}</p>}
    </form>
  );
}
