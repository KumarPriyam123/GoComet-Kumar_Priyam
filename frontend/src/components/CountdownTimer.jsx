import { useEffect, useState } from 'react';
import { formatDuration } from '../utils/format.js';

// serverOffset is (server time - browser time), so the countdown follows the
// server clock even when the user's own clock is wrong.
function msUntil(target, serverOffset) {
  return new Date(target).getTime() - (Date.now() + serverOffset);
}

export default function CountdownTimer({ target, serverOffset, label, onZero }) {
  const [remaining, setRemaining] = useState(() => msUntil(target, serverOffset));

  useEffect(() => {
    const tick = () => setRemaining(msUntil(target, serverOffset));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [target, serverOffset]);

  const finished = remaining <= 0;
  useEffect(() => {
    if (finished && onZero) onZero();
  }, [finished, onZero]);

  return (
    <div className="countdown">
      <span className="countdown-label">{label}</span>
      <span className="countdown-value">{formatDuration(remaining)}</span>
    </div>
  );
}
