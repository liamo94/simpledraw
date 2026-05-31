const DRAW_URL = import.meta.env.DEV ? 'http://localhost:5173' : 'https://drawzil.la'

const LOGO_LETTERS = [
  { letter: 'd', color: '#3b82f6', rotate: -6 },
  { letter: 'r', color: '#ef4444', rotate: 3 },
  { letter: 'a', color: '#22c55e', rotate: -4 },
  { letter: 'w', color: '#eab308', rotate: 5 },
  { letter: 'z', color: '#ec4899', rotate: -3 },
  { letter: 'i', color: '#f97316', rotate: 4 },
  { letter: 'l', color: '#8b5cf6', rotate: -5 },
  { letter: 'l', color: '#06b6d4', rotate: 3 },
  { letter: 'a', color: '#ef4444', rotate: -4 },
]

export function DrawzillaLogo({ iconSize = 44, fontSize = '2rem', letterGap = 1 }: { iconSize?: number; fontSize?: string; letterGap?: number }) {
  return (
    <a href={DRAW_URL} className="flex items-center gap-2.5 no-underline">
      <img src="/drawzillaicon.svg" alt="" style={{ width: iconSize, height: iconSize, objectFit: 'contain', flexShrink: 0 }} />
      <span style={{ fontFamily: 'Caveat Brush, cursive', fontSize, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}>
        {LOGO_LETTERS.map((l, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              marginLeft: i === 0 ? 0 : letterGap,
              transform: `rotate(${l.rotate}deg)`,
              color: l.color,
              textShadow: `0 0 8px ${l.color}44`,
            }}
          >
            {l.letter}
          </span>
        ))}
      </span>
    </a>
  )
}

export { LOGO_LETTERS, DRAW_URL }
