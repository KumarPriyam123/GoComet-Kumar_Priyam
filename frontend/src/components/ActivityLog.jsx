import { EVENT_LABELS, formatTime } from '../utils/format.js';

export default function ActivityLog({ events }) {
  if (events.length === 0) {
    return <p className="muted">Nothing has happened yet.</p>;
  }

  const newestFirst = [...events].reverse();

  return (
    <ul className="activity">
      {newestFirst.map((event) => (
        <li key={event.id} className={`activity-${event.eventType.toLowerCase()}`}>
          <span className="activity-time">{formatTime(event.createdAt)}</span>
          <span className="activity-type">{EVENT_LABELS[event.eventType]}</span>
          <span className="activity-reason">
            {event.reason}
            {event.newCloseTime && (
              <span className="muted">
                {' '}
                · close {formatTime(event.oldCloseTime)} → {formatTime(event.newCloseTime)}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
