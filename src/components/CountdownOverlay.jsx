import { useEffect } from 'react';
import { playCountdownVoice } from '../utils/audio';

const CountdownOverlay = ({ count }) => {
  useEffect(() => {
    if (count !== null && count !== undefined) {
      playCountdownVoice(count);
    }
  }, [count]);

  if (count === null || count === undefined) return null;

  return (
    <div className="countdown-overlay animate-shake">
      <div className="countdown-number" key={count}>
        {count}
      </div>
      <div className="countdown-label">
        SURVIVAL INITIATING
      </div>
    </div>
  );
};

export default CountdownOverlay;
