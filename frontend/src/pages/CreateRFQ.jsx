import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import Field from '../components/Field.jsx';
import { TRIGGER_LABELS, localTimezoneName, toLocalInput } from '../utils/format.js';

const EMPTY = {
  name: '',
  referenceId: '',
  bidStartTime: '',
  bidCloseTime: '',
  forcedCloseTime: '',
  pickupDate: '',
  triggerWindowMinutes: '',
  extensionMinutes: '',
  extensionTrigger: 'L1_CHANGE',
};

function validate(form) {
  const errors = {};
  for (const [key, value] of Object.entries(form)) {
    if (value === '') errors[key] = 'Required';
  }

  const start = new Date(form.bidStartTime);
  const close = new Date(form.bidCloseTime);
  const forced = new Date(form.forcedCloseTime);
  if (form.bidStartTime && form.bidCloseTime && close <= start) {
    errors.bidCloseTime = 'Must be after the bid start time';
  }
  if (form.bidCloseTime && form.forcedCloseTime && forced <= close) {
    errors.forcedCloseTime = 'Must be after the bid close time';
  }

  for (const key of ['triggerWindowMinutes', 'extensionMinutes']) {
    const n = Number(form[key]);
    if (form[key] !== '' && (!Number.isInteger(n) || n <= 0)) {
      errors[key] = 'Must be a whole number greater than 0';
    }
  }
  return errors;
}

export default function CreateRFQ() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // Short timings from the assignment's manual test, so an extension can be seen in a few minutes.
  function fillTestTimings() {
    const now = new Date();
    const at = (minutes) => toLocalInput(new Date(now.getTime() + minutes * 60_000));
    setForm((f) => ({
      ...f,
      bidStartTime: at(0),
      bidCloseTime: at(3),
      forcedCloseTime: at(6),
      pickupDate: at(7 * 24 * 60).slice(0, 10),
      triggerWindowMinutes: '2',
      extensionMinutes: '1',
    }));
    setErrors({});
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const rfq = await api.createRfq({
        ...form,
        bidStartTime: new Date(form.bidStartTime).toISOString(),
        bidCloseTime: new Date(form.bidCloseTime).toISOString(),
        forcedCloseTime: new Date(form.forcedCloseTime).toISOString(),
        triggerWindowMinutes: Number(form.triggerWindowMinutes),
        extensionMinutes: Number(form.extensionMinutes),
      });
      navigate(`/rfqs/${rfq.id}`);
    } catch (err) {
      setErrors(Object.fromEntries((err.details ?? []).map((d) => [d.field, d.message])));
      setFormError(err.message);
      setSaving(false);
    }
  }

  const input = (field, type = 'text', props = {}) => (
    <input type={type} value={form[field]} onChange={(e) => update(field, e.target.value)} {...props} />
  );

  return (
    <>
      <div className="page-head">
        <h1>New RFQ</h1>
        <button type="button" className="link-button" onClick={fillTestTimings}>
          Use test timings (closes in 3 min)
        </button>
      </div>

      <form className="form" onSubmit={submit} noValidate>
        <section>
          <h2>Details</h2>
          <div className="grid">
            <Field label="RFQ name" error={errors.name}>
              {input('name', 'text', { placeholder: 'Mumbai to Delhi, 2 containers' })}
            </Field>
            <Field label="Reference ID" error={errors.referenceId}>
              {input('referenceId', 'text', { placeholder: 'RFQ-2026-001' })}
            </Field>
            <Field label="Pickup / service date" error={errors.pickupDate}>
              {input('pickupDate', 'date')}
            </Field>
          </div>
        </section>

        <section>
          <h2>Bidding window</h2>
          <p className="muted small">Times are in your local time zone ({localTimezoneName()}).</p>
          <div className="grid">
            <Field label="Bid start" error={errors.bidStartTime}>
              {input('bidStartTime', 'datetime-local')}
            </Field>
            <Field label="Bid close" error={errors.bidCloseTime}>
              {input('bidCloseTime', 'datetime-local')}
            </Field>
            <Field
              label="Forced bid close"
              error={errors.forcedCloseTime}
              hint="Hard deadline, never extended past this"
            >
              {input('forcedCloseTime', 'datetime-local')}
            </Field>
          </div>
        </section>

        <section>
          <h2>British auction rules</h2>
          <div className="grid">
            <Field
              label="Trigger window (X minutes)"
              error={errors.triggerWindowMinutes}
              hint="How close to the close time we watch for activity"
            >
              {input('triggerWindowMinutes', 'number', { min: 1, step: 1 })}
            </Field>
            <Field
              label="Extension (Y minutes)"
              error={errors.extensionMinutes}
              hint="Time added when the trigger fires"
            >
              {input('extensionMinutes', 'number', { min: 1, step: 1 })}
            </Field>
            <Field label="Extension trigger" error={errors.extensionTrigger}>
              <select
                value={form.extensionTrigger}
                onChange={(e) => update('extensionTrigger', e.target.value)}
              >
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {formError && <p className="error">{formError}</p>}

        <div className="form-footer">
          <button type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create RFQ'}
          </button>
        </div>
      </form>
    </>
  );
}
