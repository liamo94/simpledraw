const LETTERS = [
  { letter: 'd', color: '#3b82f6', rotate: -6 },
  { letter: 'r', color: '#ef4444', rotate: 3 },
  { letter: 'a', color: '#22c55e', rotate: -4 },
  { letter: 'w', color: '#eab308', rotate: 5 },
  { letter: 'z', color: '#ec4899', rotate: -3 },
  { letter: 'i', color: '#f97316', rotate: 4 },
  { letter: 'l', color: '#8b5cf6', rotate: -5 },
  { letter: 'l', color: '#06b6d4', rotate: 3 },
  { letter: 'a', color: '#ef4444', rotate: -4 },
];

const WAVE_KEYFRAMES = `@keyframes dtWave {
  0%   { transform: translateY(0) scale(1); }
  35%  { transform: translateY(-7px) scale(1.2); }
  65%  { transform: translateY(1px) scale(0.95); }
  100% { transform: translateY(0) scale(1); }
}`;

export default function DrawzillaLogo({
  fontSize,
  isDark,
  animate = false,
}: {
  fontSize: number;
  isDark: boolean;
  animate?: boolean;
}) {
  return (
    <span style={{ fontFamily: 'Caveat Brush, cursive', fontSize }}>
      {animate && <style>{WAVE_KEYFRAMES}</style>}
      {LETTERS.map((l, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            marginLeft: i === 0 ? 0 : 2,
            transform: `rotate(${l.rotate}deg)`,
          }}
        >
          <span
            style={{
              color: l.color,
              display: 'inline-block',
              textShadow: isDark ? `0 0 8px ${l.color}44` : `1px 1px 0 ${l.color}22`,
              ...(animate ? { animation: `dtWave 0.55s ease both ${i * 60}ms` } : {}),
            }}
          >
            {l.letter}
          </span>
        </span>
      ))}
    </span>
  );
}
