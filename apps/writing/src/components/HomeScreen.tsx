import type { ThemeInfo } from '../lib/themes';

type Props = {
  theme: ThemeInfo;
  onQuickPlay: () => void;
  onGameMode: () => void;
};

export default function HomeScreen({ theme, onQuickPlay, onGameMode }: Props) {
  const d = theme.isDark;
  const txt     = d ? 'text-white/90'  : 'text-black/80';
  const txtMid  = d ? 'text-white/35'  : 'text-black/35';
  const cardBg  = d ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
                    : 'bg-black/4 hover:bg-black/7 border-black/8 hover:border-black/15';
  const cardTxt = d ? 'text-white'     : 'text-black/80';
  const cardSub = d ? 'text-white/40'  : 'text-black/40';

  return (
    <div
      className="flex flex-col w-screen h-screen items-center justify-center gap-8 sm:gap-12 select-none"
      style={{ background: theme.bg, color: theme.isDark ? '#fff' : '#1a1a1a' }}
    >
      <div className="flex flex-col items-center gap-3">
        <h1 className={`${txt} text-3xl font-semibold tracking-tight`}>writing</h1>
        <div className={`flex items-center gap-1.5 ${txtMid} text-sm`}>
          <span>by</span>
          <a href="https://drawtool.io" target="_blank" rel="noopener noreferrer" style={{ fontFamily: "'Pacifico', cursive", fontSize: '1.35rem', lineHeight: 1, textDecoration: 'none' }}>
            {[
              { letter: 'd', color: '#3b82f6', rotate: -6 },
              { letter: 'r', color: '#ef4444', rotate: 3 },
              { letter: 'a', color: '#22c55e', rotate: -4 },
              { letter: 'w', color: '#eab308', rotate: 5 },
              { letter: 't', color: '#ec4899', rotate: -3 },
              { letter: 'o', color: '#f97316', rotate: 4 },
              { letter: 'o', color: '#8b5cf6', rotate: -5 },
              { letter: 'l', color: '#06b6d4', rotate: 3 },
            ].map((l, i) => (
              <span key={i} style={{ display: 'inline-block', marginLeft: i === 0 ? 0 : 2, transform: `rotate(${l.rotate}deg)` }}>
                <span style={{ color: l.color, display: 'inline-block', textShadow: `0 0 8px ${l.color}44` }}>
                  {l.letter}
                </span>
              </span>
            ))}
          </a>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full px-6 sm:px-0 sm:w-auto">
        <button
          onClick={onQuickPlay}
          className={`flex flex-col items-start gap-3 sm:w-52 px-6 py-5 rounded-2xl border transition-all text-left ${cardBg}`}
        >
          <div className="text-2xl">✏️</div>
          <div>
            <div className={`${cardTxt} text-base font-medium`}>Quick Play</div>
            <div className={`${cardSub} text-sm mt-0.5`}>Draw freely, no pressure</div>
          </div>
        </button>

        <button
          onClick={onGameMode}
          className={`flex flex-col items-start gap-3 sm:w-52 px-6 py-5 rounded-2xl border transition-all text-left ${cardBg}`}
        >
          <div className="text-2xl">🎯</div>
          <div>
            <div className={`${cardTxt} text-base font-medium`}>Game Mode</div>
            <div className={`${cardSub} text-sm mt-0.5`}>Set rounds, track your score</div>
          </div>
        </button>
      </div>
    </div>
  );
}
