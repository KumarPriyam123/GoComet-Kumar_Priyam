import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePolling } from '../hooks/usePolling.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDateTime, formatMoney } from '../utils/format.js';

export default function AuctionList() {
  const navigate = useNavigate();
  const { data, error, loading } = usePolling(api.listRfqs, 5000);

  return (
    <>
      <div className="page-head">
        <h1>British Auctions</h1>
        <Link className="button" to="/rfqs/new">
          New RFQ
        </Link>
      </div>

      {error && <p className="error">{error.message}</p>}
      {loading && <p className="muted">Loading auctions…</p>}

      {data && data.rfqs.length === 0 && (
        <p className="muted">
          No auctions yet. <Link to="/rfqs/new">Create the first RFQ.</Link>
        </p>
      )}

      {data && data.rfqs.length > 0 && (
        <div className="table-wrap">
          <table className="clickable">
            <thead>
              <tr>
                <th>RFQ</th>
                <th className="num">Lowest bid</th>
                <th>Current close</th>
                <th>Forced close</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rfqs.map((rfq) => (
                <tr key={rfq.id} onClick={() => navigate(`/rfqs/${rfq.id}`)}>
                  <td>
                    <Link to={`/rfqs/${rfq.id}`}>{rfq.name}</Link>
                    <div className="muted small">{rfq.referenceId}</div>
                  </td>
                  <td className="num">
                    {formatMoney(rfq.lowestBid)}
                    {rfq.lowestBidder && <div className="muted small">{rfq.lowestBidder}</div>}
                  </td>
                  <td>
                    {formatDateTime(rfq.currentCloseTime)}
                    {rfq.currentCloseTime !== rfq.originalCloseTime && (
                      <div className="muted small">extended</div>
                    )}
                  </td>
                  <td>{formatDateTime(rfq.forcedCloseTime)}</td>
                  <td>
                    <StatusBadge status={rfq.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
