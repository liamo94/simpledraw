import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { USPSection } from './components/FeatureSection'
import { UseCasesSection } from './components/UseCasesSection'
import { UnleashedBanner } from './components/UnleashedBanner'
import { TutorialSection } from './components/TutorialSection'
import { TabletSection } from './components/TabletSection'
import { AllFeaturesSection } from './components/AllFeaturesSection'
import { Footer } from './components/Footer'
import { DRAW_URL } from './components/Logo'

function Divider() {
  return (
    <div
      className="mx-6 sm:mx-auto sm:max-w-6xl"
      style={{ height: 1, background: 'rgba(255,255,255,0.06)' }}
    />
  )
}

export default function App() {
  return (
    <div style={{ background: '#06060f', minHeight: '100vh' }}>
      <Navbar />
      <Hero />

      {/* The two core ideas that make drawzilla different */}
      <USPSection
        number="01"
        flip={false}
        headline="You're always in draw mode."
        videoSrc="/draw-mode.mp4"
        videoNatural
        videoLabel="VIDEO: hold E briefly to erase one stroke, release back to freehand, hold a shape key to draw a shape, release and immediately draw freehand again - fluid, never touching the toolbar"
        body={
          <>
            <p>
              drawzilla works differently to most canvas apps - your keyboard controls the canvas. Hold <kbd className="kbd">⌘</kbd> to draw, <kbd className="kbd">⌥</kbd> to erase, hold <kbd className="kbd">S</kbd> to draw a shape and <kbd className="kbd">Q</kbd> to access the laser pointer. Every action is accessible with a key and switching modes is as fast as your fingers can move.
            </p>
            <p className="mt-4">
              <strong style={{ color: '#fff' }}>You never leave draw mode and you never interrupt your flow.</strong>
            </p>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              Press <kbd className="kbd">?</kbd> in drawzilla to see the full list of 90+ keyboard commands
            </p>
          </>
        }
      />

      <USPSection
        number="02"
        flip={true}
        headline="Your drawing hand only draws."
        videoSrc="/cmd-draw.mp4"
        videoNatural
        videoLabel="VIDEO: Cmd+drag drawing - left hand holds Cmd, right hand does the stroke. Show clean starts and stops. Then contrast with click-to-draw showing pressure artefacts at stroke start."
        body={
          <>
            <p>
              Click-to-draw is inherently flawed. Drawing with your trackpad or mouse alone will always look sloppy. But not with drawzilla. Hold <kbd className="kbd">⌘</kbd> to start the flow of ink and release when you're done - no press-to-start tension and no release-to-stop bracing.
            </p>
            <p className="mt-4">
              <strong style={{ color: '#fff' }}>Your annotation has never looked so smooth.</strong>
            </p>
          </>
        }
      />

      <Divider />

      {/* Feature breakdown */}

      <USPSection
        number="03"
        flip={false}
        headline="Every stroke feels real."
        videoLabel="VIDEO: slow careful strokes vs fast loose gestures - showing how line width responds to speed and pressure"
        videoSrc="/stroke.mp4"
        body={
          <>
            <p>
              Powered by perfect-freehand, every stroke responds to how fast you draw and how hard you press. Thin and delicate when you're being precise. Bold and expressive when you move fast.
            </p>
            <p className="mt-4">
              <strong style={{ color: '#fff' }}>drawzilla puts your hand on the canvas, not just your mouse.</strong>
            </p>
          </>
        }
      />


      <Divider />

      <USPSection
        number="04"
        flip={true}
        headline="Multiple canvases. Ideas in parallel."
        videoLabel="Multiple canvases. Ideas in parallel."
        videoSrc="/canvases.mp4"
        body={
          <>
            <p>Every canvas is its own infinite space. Keep your main diagram on canvas 1, rough sketches on 2, notes on 3 — and jump between them instantly with a single key.</p>
            <p className="mt-3">No saving. No exporting. No losing your train of thought. The context switch costs you one keystroke.</p>
            <p className="mt-3 text-sm flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Free: 3 canvas slots &nbsp;·&nbsp; <span style={{ fontFamily: "'Bangers', cursive", fontSize: '0.75rem', letterSpacing: '0.1em', color: '#39ff14' }}>UNLEASHED</span>: 9 canvas slots
            </p>
          </>
        }
      />

      <Divider />

      <USPSection
        number="05"
        flip={false}
        headline="Separate workspaces for separate projects."
        videoLabel="Separate workspaces for separate projects"
        videoImgSrc="/workspaces.png"
        body={
          <>
            <p>With <span style={{ fontFamily: "'Bangers', cursive", fontSize: '1em', letterSpacing: '0.1em', color: '#39ff14' }}>UNLEASHED</span>, canvases can be sorted into separate workspaces. Keep client work away from personal notes. Teaching prep separate from side projects. Switch between them without anything bleeding together.</p>
          </>
        }
      />


      <Divider />

      <USPSection
        number="06"
        flip={true}
        headline="Stash your best stuff."
        videoSrc="/stash.mp4"
        videoNatural
        videoLabel="VIDEO: selecting strokes → saving to stash panel → panel showing thumbnails → dragging a stash item back onto the canvas on a different theme"
        body={
          <>
            <p>Save reusable assets into your stash - icons, components, diagrams, or logos. Whatever you keep reaching for. Drag anything back onto the canvas at any time. It adapts to your current theme automatically.</p>
            <p className="mt-3 font-bold" style={{ color: '#fff' }}>Named, searchable, and synced across devices.</p>
          </>
        }
      />

      <Divider />

      <USPSection
        number="07"
        flip={false}
        headline="Share with one link."
        videoSrc="/share.mp4"
        videoNatural={true}
        videoLabel="VIDEO: selecting a canvas, opening share modal, copying link, opening it in a new tab - viewer sees live canvas with no sign-in required"
        body={
          <>
            <p>Share your work instantly—no exports required. Anyone can use your link friction-free, with or without a Drawzilla account. Send a mockup to a client. Share a diagram with a teammate. Walk someone through your thinking without exporting anything.</p>
            <p className="mt-3">Go further with <span style={{ fontFamily: "'Bangers', cursive", fontSize: '1em', letterSpacing: '0.1em', color: '#39ff14' }}>UNLEASHED</span> and generate live links that always show the latest. No need to resend an updated version again.</p>
          </>
        }
      />

      <Divider />

      <TabletSection />

      <Divider />

      <UseCasesSection />

      <Divider />

      <TutorialSection />

      <Divider />

      <AllFeaturesSection />

      <Divider />

      <UnleashedBanner />

      <Divider />

      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto flex justify-center">
          <img src="/pie-chart.png" alt="" width={600} height={600} style={{ objectFit: 'contain' }} />
        </div>
      </section>

      <Divider />

      <section className="py-28 px-6 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ letterSpacing: '-0.02em' }}>
          Ready to draw?
        </h2>
        <p className="text-lg mb-10" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Free to use. No account needed.
        </p>
        <a
          href={DRAW_URL}
          className="inline-flex items-center gap-2 text-base font-semibold px-10 py-4 rounded-full transition-all duration-200 hover:scale-105 hover:brightness-110 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #ec4899)', color: '#fff' }}
        >
          Open drawzilla →
        </a>
      </section>

      <Footer />
    </div>
  )
}
