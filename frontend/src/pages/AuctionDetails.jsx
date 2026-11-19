import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePolling } from '../hooks/usePolling.js';
import StatusBadge from '../components/StatusBadge.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import BidTable from '../components/BidTable.jsx';
import BidForm from '../components/BidForm.jsx';
import ActivityLog from '../components/ActivityLog.jsx';
import { TRIGGER_LABELS, formatDate, formatDateTime, formatTime } from '../utils/format.js';

const DISABLED_REASONS = {
  SCHEDULED: 'Bidding has not started yet.',
  CLOSED: 'This auction has closed. No more bids are accepted.',
  FORCE_CLOSED: 'This auction reached its forced close time. No more bids are accepted.',
};

export default function AuctionDetails() {
  const { id } = useParams();
  const load = useCallback(async () => {
    const [details, activity] = await Promise.all([api.getRfq(id), api.getActivity(id)]);
    return { ...details, activity, offset: new Date(details.serverTime).getTime() - Date.now() };
  }, [id]);

  const { data, error, loading, refresh } = usePolling(load, 3000);
  const extension = useExtensionNotice(data?.rfq.currentCloseTime);

  if (loading) return <p className="muted">Loading auction…</p>;
  if (!data) {
    return (
      <p className="error">
        {error.status === 404 ? 'This RFQ does not exist.' : error.message} <Link to="/">Back to auctions</Link>
      </p>
    );
  }

  const { rfq, ranking, activity, offset } = data;
  const extended = rfq.currentCloseTime !== rfq.originalCloseTime;

  return (
    <>
      <p className="small">
        <Link to="/">← All auctions</Link>
      </p>

      <div className="page-head">
        <div>
          <h1>{rfq.name}</h1>
          <span className="muted">{rfq.referenceId}</span>
        </div>
        <StatusBadge status={rfq.status} />
      </div>

      {error && <p className="error">{error.message}</p>}
      {extension && <p className="notice notice-extended">{extension}</p>}

      <div className="summary">
        <div className="card">
          {rfq.status === 'ACTIVE' && (
            <CountdownTimer
              target={rfq.currentCloseTime}
              serverOffset={offset}
              label="Closes in"
              onZero={refresh}
            />
          )}
          {rfq.status === 'SCHEDULED' && (
            <CountdownTimer
              target={rfq.bidStartTime}
              serverOffset={offset}
              label="Starts in"
              onZero={refresh}
            />
          )}
          <dl>
            <dt>Current close</dt>
            <dd>{formatDateTime(rfq.currentCloseTime)}</dd>
            <dt>Forced close</dt>
            <dd>{formatDateTime(rfq.forcedCloseTime)}</dd>
            {extended && (
              <>
                <dt>Original close</dt>
                <dd>{formatDateTime(rfq.originalCloseTime)}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="card">
          <h2>Auction rules</h2>
          <dl>
            <dt>Trigger window (X)</dt>
            <dd>{rfq.triggerWindowMinutes} min</dd>
            <dt>Extension (Y)</dt>
            <dd>{rfq.extensionMinutes} min</dd>
            <dt>Trigger</dt>
            <dd>{TRIGGER_LABELS[rfq.extensionTrigger].replace('X', rfq.triggerWindowMinutes)}</dd>
            <dt>Bid start</dt>
            <dd>{formatDateTime(rfq.bidStartTime)}</dd>
            <dt>Pickup date</dt>
            <dd>{formatDate(rfq.pickupDate)}</dd>
          </dl>
        </div>
      </div>

      <section>
        <h2>Ranking</h2>
        <BidTable ranking={ranking} />
      </section>

      <section>
        <h2>Submit a quote</h2>
        <BidForm rfqId={rfq.id} disabledReason={DISABLED_REASONS[rfq.status]} onPlaced={refresh} />
      </section>

      <section>
        <h2>Activity</h2>
        <ActivityLog events={activity} />
      </section>
    </>
  );
}

// Shows a message for a while whenever the close time moves later.
function useExtensionNotice(closeTime) {
  const lastClose = useRef(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!closeTime) return;
    const previous = lastClose.current;
    lastClose.current = closeTime;
    if (!previous || previous === closeTime) return;

    const seconds = Math.round((new Date(closeTime) - new Date(previous)) / 1000);
    const amount =
      seconds % 60 === 0 ? `${seconds / 60} minute${seconds === 60 ? '' : 's'}` : `${seconds} seconds`;
    setNotice(`Auction extended by ${amount}. New close ${formatTime(closeTime)}.`);
    const timer = setTimeout(() => setNotice(null), 15_000);
    return () => clearTimeout(timer);
  }, [closeTime]);

  return notice;
}
