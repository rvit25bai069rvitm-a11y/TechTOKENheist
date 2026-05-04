import React, { useState, useRef } from 'react';

const DEFAULT_DOMAINS = ['Tech Pitch', 'Tech Quiz', 'Guess Output', 'Frontend Dev', 'Feature Addition'];
const COLORS = ['#ff5f8f', '#69ff75', '#ffc94d', '#79ffd6', '#a78bfa'];

const DomainWheel = ({ onSpin, disabled, resolveDomain, domains = DEFAULT_DOMAINS }) => {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef(null);

  const segmentAngle = 360 / domains.length;

  const pickRandomDomain = () => domains[Math.floor(Math.random() * domains.length)];

  const handleSpin = async () => {
    if (spinning || disabled) return;
    setSpinning(true);
    setResult(null);

    let payload;
    const tentativeDomain = pickRandomDomain();
    let domain = tentativeDomain;

    if (resolveDomain) {
      payload = await resolveDomain(tentativeDomain);
      domain = payload?.domain || tentativeDomain;
    }

    if (!domain || !domains.includes(domain)) {
      domain = pickRandomDomain();
    }

    const landingIndex = domains.indexOf(domain);
    const currentNormalized = ((rotation % 360) + 360) % 360;
    const targetAtPointer = 360 - (landingIndex * segmentAngle + segmentAngle / 2);
    const baseDelta = (targetAtPointer - currentNormalized + 360) % 360;
    const extraTurns = (Math.floor(Math.random() * 3) + 5) * 360;
    const totalRotation = rotation + extraTurns + baseDelta;

    setRotation(totalRotation);

    setTimeout(() => {
      setResult(domain);
      setSpinning(false);
      if (onSpin) onSpin(domain, payload);
    }, 3200);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto 1rem' }}>
        {/* Pointer */}
        <div style={{
          position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent',
          borderTop: '18px solid var(--accent-warning)', zIndex: 10, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
        }} />

        {/* Wheel */}
        <svg
          ref={wheelRef}
          width="220" height="220"
          viewBox="0 0 220 220"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning ? 'transform 3s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
          }}
        >
          {domains.map((domain, i) => {
            const startAngle = i * segmentAngle - 90;
            const endAngle = startAngle + segmentAngle;
            const startRad = (startAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const cx = 110, cy = 110, r = 100;
            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);
            const largeArc = segmentAngle > 180 ? 1 : 0;

            const midAngle = ((startAngle + endAngle) / 2) * Math.PI / 180;
            const labelR = r * 0.6;
            const lx = cx + labelR * Math.cos(midAngle);
            const ly = cy + labelR * Math.sin(midAngle);
            const labelRotation = (startAngle + endAngle) / 2 + 90;

            return (
              <g key={domain}>
                <path
                  d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={COLORS[i % COLORS.length]}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth="1.5"
                  opacity="0.85"
                />
                <text
                  x={lx} y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#000"
                  fontWeight="800"
                  fontSize="9"
                  fontFamily="'Rubik', sans-serif"
                  transform={`rotate(${labelRotation}, ${lx}, ${ly})`}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  {domain}
                </text>
              </g>
            );
          })}
          <circle cx="110" cy="110" r="18" fill="rgba(0,0,0,0.8)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          <text x="110" y="113" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800">⚡</text>
        </svg>
      </div>

      <button
        className="btn btn-warning"
        onClick={handleSpin}
        disabled={spinning || disabled}
        style={{ minWidth: '140px', justifyContent: 'center' }}
      >
        {spinning ? '🎰 SPINNING...' : '🎡 SPIN WHEEL'}
      </button>

      {result && (
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 1rem',
          background: 'rgba(255, 201, 77, 0.12)', border: '1px solid var(--accent-warning)',
          borderRadius: 'var(--radius-md)', display: 'inline-block'
        }}>
          <span className="font-heading" style={{ color: 'var(--accent-warning)', fontSize: '1.1rem' }}>
            {result}
          </span>
        </div>
      )}
    </div>
  );
};

export default DomainWheel;
