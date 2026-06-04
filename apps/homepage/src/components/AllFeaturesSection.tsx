import { useEffect, useRef } from 'react'

const FEATURE_GROUPS = [
  {
    label: 'Drawing tools',
    items: ['Freehand', 'Dashed freehand', 'Straight line', 'Highlight', 'Spray paint', 'Laser pointer', 'Eraser', 'Select & move', 'Text tool', 'Hand / pan'],
  },
  {
    label: 'Shapes',
    items: ['Circle', 'Rectangle', 'Triangle', 'Arrow', 'Star', 'Pentagon', 'Hexagon', 'Diamond', 'Cloud', 'Multi-bend line'],
  },
  {
    label: 'Customisation',
    items: ['8 themes', 'Dot & square grids', 'Unlimited colours', 'Line width', 'Fill & opacity', 'Dashed outlines', 'Left/right click tools', 'Sharp or rounded shapes'],
  },
  {
    label: 'Text & fonts',
    items: ['6 font families', '5 text sizes', 'Bold & italic', 'Left / centre / right align', 'Inline text editing', 'Font per stroke'],
  },
  {
    label: 'Touch & input',
    items: ['Apple Pencil support', 'Pressure sensitivity', 'Palm rejection', 'Pinch to zoom', 'Two-finger pan', 'Finger drawing', 'Mobile toolbar'],
  },
  {
    label: 'Canvas & navigation',
    items: ['Infinite canvas', '3 slots free / 9 with Pro', '1–3 key switching (1–9 Pro)', 'Undo / redo', 'Zoom & fit', 'Group select', 'Move & delete selection', 'Image insertion'],
  },
  {
    label: 'Stash',
    items: ['Save any strokes', 'Drag back onto canvas', 'Named stash items', 'Search stash', 'Reorder & delete', 'Theme-adaptive on drop', 'Cloud stash sync'],
  },
  {
    label: 'Export & share',
    items: ['PNG export', 'SVG export (Pro)', 'Live canvas share link', 'Workspace share link (Pro)', 'No-account viewing', 'Copy to clipboard'],
  },
  {
    label: 'Cloud (Pro)',
    items: ['Canvas sync across devices', 'Unlimited workspaces', 'Stash sync', 'Auto-save', 'Before-close backup'],
  },
  {
    label: 'Other',
    items: ['Full keyboard shortcuts', 'Shortcuts panel (?)', 'Interactive tutorial', 'Dark & light themes', 'No account needed', 'Works offline'],
  },
]

export function AllFeaturesSection() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('visible'); observer.disconnect() } },
      { threshold: 0.05 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="py-20 sm:py-28 px-6">
      <div ref={ref} className="scroll-fade max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div
            className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
            style={{ background: 'rgba(59,130,246,0.1)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            Everything included
          </div>
          <h2
            className="text-3xl sm:text-4xl font-bold"
            style={{ letterSpacing: '-0.02em' }}
          >
            The full feature list
          </h2>
          <p className="mt-4 text-base max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.5)' }}>
            No hidden features. Everything you need, right there when you open it.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_GROUPS.map(group => (
            <div
              key={group.label}
              className="rounded-2xl p-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <h3 className="text-sm font-semibold mb-4" style={{ color: '#93c5fd' }}>
                {group.label}
              </h3>
              <ul className="space-y-2">
                {group.items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span style={{ color: 'rgba(59,130,246,0.6)', flexShrink: 0 }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
