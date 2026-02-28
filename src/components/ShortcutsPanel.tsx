const isMac = navigator.platform.toUpperCase().includes("MAC");
const mod = isMac ? "\u2318" : "Ctrl";
const alt = isMac ? "\u2325" : "Alt";

export default function ShortcutsPanel({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`text-xs ${isDark ? "text-white/60" : "text-black/60"}`}
    >
      <div
        className={`text-[10px] font-medium uppercase tracking-wider mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
      >
        Navigation
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5,8 L2,8 M14,8 L11,8 M8,5 L8,2 M8,14 L8,11" />
              <path d="M3,8 L5,6.5 M3,8 L5,9.5 M13,8 L11,6.5 M13,8 L11,9.5 M8,3 L6.5,5 M8,3 L9.5,5 M8,13 L6.5,11 M8,13 L9.5,11" />
            </svg>
            Pan
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Space + drag / Arrows
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="7" cy="7" r="5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            Zoom
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Pinch / {mod} + scroll
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="7" cy="7" r="5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
              <line x1="5" y1="7" x2="9" y2="7" />
              <line x1="7" y1="5" x2="7" y2="9" />
            </svg>
            Zoom in
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            +
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="7" cy="7" r="5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
              <line x1="5" y1="7" x2="9" y2="7" />
            </svg>
            Zoom out
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            -
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M2,8 L14,8 M8,2 L8,14" />
              <rect
                x="4"
                y="4"
                width="8"
                height="8"
                rx="0.5"
                strokeDasharray="1.5 1.5"
              />
            </svg>
            Reset zoom
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {mod} + 0
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="2" y="2" width="12" height="12" rx="1" />
              <path
                d="M5,6 L8,4 L11,6 L11,10 L8,12 L5,10 Z"
                strokeLinejoin="round"
              />
            </svg>
            Fit to content
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {mod} + 1
          </kbd>
        </div>
      </div>

      <div
        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
      >
        Drawing
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3,12 Q5,4 8,8 Q11,12 13,4" />
            </svg>
            Draw
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Click / {mod} + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="2 2.5"
            >
              <path d="M3,12 Q5,4 8,8 Q11,12 13,4" />
            </svg>
            Draw dashed
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Shift + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="3" y1="13" x2="13" y2="3" />
            </svg>
            Straight line
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {mod} + Shift + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
            >
              <defs>
                <linearGradient
                  id="eg"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="50%" stopColor="#89CFF0" />
                  <stop offset="50%" stopColor="#FA8072" />
                </linearGradient>
              </defs>
              <rect
                x="2"
                y="4"
                width="12"
                height="8"
                rx="1.5"
                transform="rotate(-15 8 8)"
                fill="url(#eg)"
                stroke="currentColor"
                strokeWidth="1"
                strokeOpacity="0.5"
              />
            </svg>
            Erase
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {alt} + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              stroke="none"
              opacity="0.5"
            >
              <rect x="2" y="5" width="12" height="6" rx="1" />
            </svg>
            Highlight
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            W/H + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              stroke="none"
            >
              <path d="M2,8 L14,5 L14,11 Z" opacity="0.7" />
            </svg>
            Dynamic stroke
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            P
          </kbd>
        </div>
      </div>

      <div
        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
      >
        Shapes
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span>Draw shape</span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {isMac ? "Ctrl" : `${alt} + Shift`} + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span>Cycle shape</span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            S
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect
                x="2"
                y="3"
                width="12"
                height="10"
                rx="0.5"
              />
            </svg>
            Rectangle
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            R + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="6" />
            </svg>
            Circle
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            C + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <line x1="2" y1="8" x2="12" y2="8" />
              <polyline
                points="9,5 12,8 9,11"
                strokeLinecap="round"
              />
            </svg>
            Arrow
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            A + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            >
              <rect
                x="2"
                y="3"
                width="12"
                height="10"
                rx="0.5"
              />
            </svg>
            Dashed shape
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {isMac ? "Shift + Ctrl" : `Shift + ${alt}`} + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16">
              <rect
                x="2"
                y="3"
                width="12"
                height="10"
                rx="0.5"
                fill="currentColor"
                fillOpacity="0.4"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
            Filled shape
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {isMac ? "F + Ctrl" : `F + ${alt}`} + drag
          </kbd>
        </div>
      </div>

      <div
        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
      >
        Tools
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle
                cx="8"
                cy="8"
                r="3"
                fill="#ff3030"
                fillOpacity="0.9"
              />
              <circle
                cx="8"
                cy="8"
                r="5.5"
                stroke="#ff3030"
                strokeWidth="1"
                strokeOpacity="0.4"
              />
            </svg>
            Laser pointer
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Q/L + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4,6 C4,3 8,2 11,4" />
              <polyline points="2,6.5 4,6 5.5,8" />
            </svg>
            Undo
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            U / {mod} + Z
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12,6 C12,3 8,2 5,4" />
              <polyline points="14,6.5 12,6 10.5,8" />
            </svg>
            Redo
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Shift + U / {mod} + Shift + Z
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              stroke="none"
            >
              <circle cx="4" cy="8" r="2.5" opacity="0.4" />
              <circle cx="11" cy="8" r="2.5" />
            </svg>
            Next / Prev color
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            ] / [
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              stroke="none"
            >
              <circle cx="5" cy="8" r="2.5" />
              <path
                d="M9.5 6.5 L12.5 8 L9.5 9.5"
                opacity="0.4"
              />
              <path
                d="M12.5 6.5 L9.5 8 L12.5 9.5"
                opacity="0.4"
              />
            </svg>
            Swap last 2 colors
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            ,
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                rx="1.5"
              />
              <line x1="6" y1="5" x2="6" y2="11" />
              <line x1="10" y1="5" x2="10" y2="11" />
              <line x1="2" y1="8" x2="14" y2="8" />
            </svg>
            Switch canvas
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            1 – 9
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            >
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                rx="1.5"
              />

              <text
                x="8"
                y="8.5"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="currentColor"
                stroke="none"
                fontSize="6.5"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                Aa
              </text>
            </svg>
            Rename canvas
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {mod} + ,
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="4" y1="8" x2="12" y2="8" />
            </svg>
            Thicker / Thinner
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {"{ / }"}
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="currentColor"
              stroke="none"
            >
              <circle cx="8" cy="8" r="3" />
            </svg>
            Place dot
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            .
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 3h6M6 3v8M4.5 3v1M7.5 3v1" />
            </svg>
            Write text
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            T
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 3h6M6 3v8M4.5 3v1M7.5 3v1" />
              <path d="M10 6l2 2-2 2" strokeWidth="1.2" />
            </svg>
            Cycle text size
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Shift + T
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 5h4M5 3v10M10 4l3 8M10 4l-3 8" strokeWidth="1.3" />
            </svg>
            Cycle font
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            Shift + F
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span>Bold / Italic (in text mode)</span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + B / I
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span>Alignment (in text mode)</span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + ⇧ + L / E / R
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span>Undo / Redo typing</span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + Z / ⇧Z
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="4" y1="12" x2="12" y2="4" />
            </svg>
            Clear canvas
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {mod} + X
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 13h10M8 3v7M5 7l3 3 3-3" />
            </svg>
            Export
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {mod} + E
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="3" y1="4" x2="13" y2="4" />
              <line x1="3" y1="8" x2="13" y2="8" />
              <line x1="3" y1="12" x2="13" y2="12" />
            </svg>
            Menu
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            M
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect
                x="2"
                y="2"
                width="12"
                height="12"
                rx="1.5"
              />
              <path d="M2,6 L6,6 L6,2 M10,2 L10,6 L14,6 M14,10 L10,10 L10,14 M6,14 L6,10 L2,10" />
            </svg>
            Fullscreen
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            {mod} + F
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="4" y1="2" x2="4" y2="14" strokeOpacity="0.5" />
              <line x1="8" y1="2" x2="8" y2="14" strokeOpacity="0.5" />
              <line x1="12" y1="2" x2="12" y2="14" strokeOpacity="0.5" />
              <line x1="2" y1="4" x2="14" y2="4" strokeOpacity="0.5" />
              <line x1="2" y1="8" x2="14" y2="8" strokeOpacity="0.5" />
              <line x1="2" y1="12" x2="14" y2="12" strokeOpacity="0.5" />
            </svg>
            Cycle grid
          </span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            G
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span>Cycle theme</span>
          <kbd
            className={
              isDark ? "text-white/40" : "text-black/40"
            }
          >
            D D
          </kbd>
        </div>
      </div>
      <div
        className={`text-[10px] font-medium uppercase tracking-wider mt-2.5 mb-1 ${isDark ? "text-white/30" : "text-black/30"}`}
      >
        Selection
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2.5 2" />
              <path d="M8 5v6M5 8h6" strokeWidth="1.2" />
            </svg>
            Select / move / resize
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            V + hold
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2.5 2" />
            </svg>
            Box select
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            V + drag
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="8" cy="8" r="5" />
              <circle cx="8" cy="8" r="2" strokeOpacity="0.5" />
            </svg>
            Cycle overlapping
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            Click again
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="2" y="2" width="12" height="12" rx="1" />
              <path d="M5 8h6" strokeWidth="1.2" />
            </svg>
            Select all
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + A
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="2" y="4" width="8" height="10" rx="1" />
              <path d="M6 4V2.5A.5.5 0 016.5 2h7a.5.5 0 01.5.5v9a.5.5 0 01-.5.5H12" strokeOpacity="0.5" />
            </svg>
            Copy
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + C
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="2" y="4" width="8" height="10" rx="1" />
              <path d="M10 2h2.5a.5.5 0 01.5.5v9a.5.5 0 01-.5.5H10" strokeOpacity="0.5" />
              <path d="M5 9l2 2 4-4" strokeWidth="1.2" />
            </svg>
            Paste
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + V
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M4 12l8-8" strokeWidth="1.2" />
              <rect x="2" y="2" width="12" height="12" rx="1" strokeOpacity="0.3" />
            </svg>
            Cut
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + X
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <rect x="1.5" y="3.5" width="8" height="10" rx="1" />
              <rect x="6.5" y="1.5" width="8" height="10" rx="1" strokeOpacity="0.5" />
            </svg>
            Duplicate
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            {mod} + D
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="4" y1="12" x2="12" y2="4" />
            </svg>
            Delete
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            Backspace
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            Nudge
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            ↑ ↓ ← →
          </kbd>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 8h10M8 3v10" strokeOpacity="0.4" />
              <circle cx="8" cy="8" r="3" />
            </svg>
            Deselect
          </span>
          <kbd className={isDark ? "text-white/40" : "text-black/40"}>
            Escape
          </kbd>
        </div>
      </div>
    </div>
  );
}
