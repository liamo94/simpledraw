import type { ThemeInfo } from '../lib/themes';

type Props = {
  theme: ThemeInfo;
  onQuickPlay: () => void;
  onGameMode: () => void;
  onDailyText: () => void;
  onDailyShapes: () => void;
  dailyTextDone: boolean;
  dailyShapesDone: boolean;
  dailyDate: string;
};

export default function HomeScreen({ theme, onQuickPlay, onGameMode, onDailyText, onDailyShapes, dailyTextDone, dailyShapesDone, dailyDate }: Props) {
  const d = theme.isDark;
  const txt     = d ? 'text-white/90'  : 'text-black/80';
  const txtMid  = d ? 'text-white/35'  : 'text-black/35';
  const cardBg  = d ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
                    : 'bg-black/4 hover:bg-black/7 border-black/8 hover:border-black/15';
  const cardTxt = d ? 'text-white'     : 'text-black/80';
  const cardSub = d ? 'text-white/40'  : 'text-black/40';

  const dailyBtnBase = d
    ? 'border-white/12 hover:bg-white/10 text-white/70'
    : 'border-black/10 hover:bg-black/6 text-black/55';
  const dailyBtnDone = d
    ? 'border-[#10b981]/40 bg-[#10b981]/12 text-[#10b981]'
    : 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]';

  return (
    <div
      className="flex flex-col w-screen h-dvh items-center justify-center gap-6 sm:gap-10 select-none"
      style={{ background: theme.bg, color: theme.isDark ? '#fff' : '#1a1a1a', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
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

      <div className="flex flex-col gap-3 sm:gap-4 w-full px-6 sm:px-0 sm:w-[432px]">
        {/* Quick play + game mode row */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={onQuickPlay}
            className={`flex flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-3 sm:w-52 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border transition-all text-left ${cardBg}`}
          >
            <div className="text-2xl shrink-0">✏️</div>
            <div>
              <div className={`${cardTxt} text-base font-medium`}>Quick Play</div>
              <div className={`${cardSub} text-sm mt-0.5`}>Draw freely, no pressure</div>
            </div>
          </button>

          <button
            onClick={onGameMode}
            className={`flex flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-3 sm:w-52 px-5 py-4 sm:px-6 sm:py-5 rounded-2xl border transition-all text-left ${cardBg}`}
          >
            <div className="text-2xl shrink-0">🎯</div>
            <div>
              <div className={`${cardTxt} text-base font-medium`}>Game Mode</div>
              <div className={`${cardSub} text-sm mt-0.5`}>Set rounds, track your score</div>
            </div>
          </button>
        </div>

        {/* Daily challenge card */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6 px-6 py-4 rounded-2xl border transition-all ${d ? 'bg-white/[0.035] border-white/10' : 'bg-black/[0.03] border-black/8'}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📅</span>
            <div>
              <div className={`${cardTxt} text-sm font-medium leading-tight`}>Daily Challenge</div>
              <div className={`${cardSub} text-xs mt-0.5`}>{dailyDate} · 5 rounds</div>
              <div className={`${cardSub} text-xs`}>compete with same seed</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onDailyText}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border transition-colors ${dailyTextDone ? dailyBtnDone : dailyBtnBase}`}
            >
              {dailyTextDone && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 4.5,9 10,3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              Text
            </button>
            <button
              onClick={onDailyShapes}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm border transition-colors ${dailyShapesDone ? dailyBtnDone : dailyBtnBase}`}
            >
              {dailyShapesDone && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6.5 4.5,9 10,3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              Shapes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
