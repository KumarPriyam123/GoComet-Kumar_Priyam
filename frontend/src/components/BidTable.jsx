import { formatDate, formatDateTime, formatMoney } from '../utils/format.js';

export default function BidTable({ ranking }) {
  if (ranking.length === 0) {
    return <p className="muted">No bids yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Supplier</th>
            <th>Carrier</th>
            <th className="num">Freight</th>
            <th className="num">Origin</th>
            <th className="num">Destination</th>
            <th className="num">Total</th>
            <th>Transit</th>
            <th>Valid until</th>
            <th>Placed at</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((bid) => (
            <tr key={bid.supplierId} className={bid.rank === 1 ? 'row-l1' : undefined}>
              <td>
                <strong>{bid.rankLabel}</strong>
              </td>
              <td>{bid.supplierName}</td>
              <td>{bid.carrierName}</td>
              <td className="num">{formatMoney(bid.freightCharges)}</td>
              <td className="num">{formatMoney(bid.originCharges)}</td>
              <td className="num">{formatMoney(bid.destinationCharges)}</td>
              <td className="num">
                <strong>{formatMoney(bid.totalPrice)}</strong>
              </td>
              <td>{bid.transitTimeDays} days</td>
              <td>{formatDate(bid.quoteValidityDate)}</td>
              <td>{formatDateTime(bid.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
