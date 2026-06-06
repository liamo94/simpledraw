import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { FeatureSection, SpotlightSection, USPSection } from './components/FeatureSection'
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
        videoLabel="VIDEO: hold E briefly to erase one stroke, release back to freehand, hold a shape key to draw a shape, release and immediately draw freehand again - fluid, never touching the toolbar"
        body={
          <>
            <p>
              Most drawing apps put you in a <em style={{ color: 'rgba(255,255,255,0.45)', fontStyle: 'normal' }}>mode</em>. Click the eraser - you're erasing. Click the shape tool - you're drawing shapes. To get back to drawing, you click something else. Every tool change is an interruption.
            </p>
            <p className="mt-4">
              drawzilla works differently. <strong style={{ color: '#fff' }}>Hold a key and drag - you're in that mode for as long as you hold it. Release and you're drawing again.</strong> Hold <kbd className="kbd">⌥</kbd> and drag to erase, release to draw. Hold <kbd className="kbd">S</kbd> and drag to draw a shape, release and keep going. Hold <kbd className="kbd">Q</kbd> for laser, <kbd className="kbd">W</kbd> for highlight - same idea everywhere.
            </p>
            <p className="mt-4">
              You never leave draw mode. You just borrow other tools for a moment.
            </p>
          </>
        }
      />

      <USPSection
        number="02"
        flip={true}
        headline="Your drawing hand only draws."
        videoLabel="VIDEO: Cmd+drag drawing - left hand holds Cmd, right hand does the stroke. Show clean starts and stops. Then contrast with click-to-draw showing pressure artefacts at stroke start."
        body={
          <>
            <p>
              When you press down to start a stroke, that pressure shows up in it. The start gets heavier, the end gets lighter as you brace for the release. It's a fundamental problem with click-to-draw - your input hand is doing two jobs at once.
            </p>
            <p className="mt-4">
              <strong style={{ color: '#fff' }}>Hold <kbd className="kbd">⌘</kbd> and drag to draw.</strong> One hand holds the trigger. Your other hand does only one thing: the stroke itself. No press-to-start tension. No release-to-stop bracing. Just the motion.
            </p>
            <p className="mt-4">
              It takes about a minute to get used to. Then you don't want to go back.
            </p>
          </>
        }
      />

      <Divider />

      {/* Feature breakdown */}

      <FeatureSection
        flip={false}
        badge="Freehand"
        headline="Every stroke feels real"
        videoLabel="VIDEO: slow careful strokes vs fast loose gestures - showing how line width responds to speed and pressure"
        body={
          <>
            <p>Powered by perfect-freehand, every stroke responds to how fast you draw and how hard you press. Thin and delicate when you're being precise. Bold and expressive when you move fast.</p>
            <p className="mt-3">No lag. No smoothing that fights you. Just your hand on the canvas.</p>
          </>
        }
      />

      <Divider />

      <FeatureSection
        flip={true}
        badge="Shortcuts"
        headline="Speed comes standard"
        videoLabel="VIDEO: rapid tool switching with keyboard - draw, erase, select, undo, colour change, zoom - hands never leave the canvas"
        body={
          <>
            <p>Beyond the hold-to-activate modes, everything else has a shortcut too. Grid, undo, canvas switching, theme cycling - all one key.</p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              <li><kbd className="kbd">S</kbd> + drag shape &nbsp;·&nbsp; <kbd className="kbd">R</kbd> rect &nbsp;·&nbsp; <kbd className="kbd">C</kbd> circle &nbsp;·&nbsp; <kbd className="kbd">A</kbd> arrow</li>
              <li><kbd className="kbd">⌥</kbd> + drag erase &nbsp;·&nbsp; <kbd className="kbd">W</kbd>/<kbd className="kbd">H</kbd> highlight &nbsp;·&nbsp; <kbd className="kbd">Q</kbd>/<kbd className="kbd">L</kbd> laser &nbsp;·&nbsp; <kbd className="kbd">B</kbd> spray</li>
              <li><kbd className="kbd">T</kbd> text &nbsp;·&nbsp; <kbd className="kbd">G</kbd> grid &nbsp;·&nbsp; <kbd className="kbd">DD</kbd> theme &nbsp;·&nbsp; <kbd className="kbd">U</kbd> undo</li>
              <li><kbd className="kbd">V</kbd> select &nbsp;·&nbsp; <kbd className="kbd">]</kbd>/<kbd className="kbd">[</kbd> next/prev colour &nbsp;·&nbsp; <kbd className="kbd">1–3</kbd> canvas</li>
            </ul>
            <p className="mt-4 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Press <kbd className="kbd">?</kbd> any time to open the full shortcuts reference.
            </p>
          </>
        }
      />

      <Divider />

      <FeatureSection
        flip={false}
        badge="Multiple canvases"
        headline="Multiple canvases. Ideas in parallel."
        videoLabel="VIDEO: pressing 1, 2, 3 keys to jump instantly between different canvases - each has a different idea, no loading, instant switch"
        body={
          <>
            <p>Every canvas slot is its own infinite workspace. Keep your main diagram on canvas 1, rough sketches on 2, notes on 3 - and jump between them instantly with a single key.</p>
            <p className="mt-3">No saving. No exporting. No losing your train of thought. The context switch costs you one keystroke.</p>
            <p className="mt-3 text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>Free: 3 canvas slots &nbsp;·&nbsp; Pro: 9 canvas slots</p>
          </>
        }
      />

      <Divider />

      <FeatureSection
        flip={true}
        badge="Presentations"
        headline="What's better than one infinite canvas?"
        videoLabel="VIDEO: jumping between canvas slots mid-presentation - each canvas is a different slide, switching instantly with a keypress to walk an audience through an idea"
        body={
          <>
            <p>Each canvas slot is a slide. Jump between them instantly to walk an audience through your thinking - diagrams, sketches, annotations, all live as you draw. No slides to prepare, no switching apps, no leaving the canvas.</p>
          </>
        }
      />

      <Divider />

      <FeatureSection
        flip={false}
        badge="Mouse buttons"
        headline="Two hands. Two tools."
        videoLabel="VIDEO: right-click erasing while drawing with left click - fluid back-and-forth with no tool switching at all"
        body={
          <>
            <p>Assign any tool to each mouse button. Left click draws, right click erases - or dashes, or lasers. No switching, no interruption.</p>
            <p className="mt-3">Pick your combination once and forget the toolbar exists. It's the kind of thing that feels obvious the first time you try it.</p>
          </>
        }
      />

      <Divider />

      <SpotlightSection
        badge="Stash"
        headline="A library that lives on your canvas"
        videoLabel="VIDEO: selecting strokes → saving to stash panel → panel showing thumbnails → dragging a stash item back onto the canvas on a different theme"
        body={
          <>
            <p>Select any group of strokes and save them to the Stash. They become reusable pieces - icons, components, diagrams, whatever you keep reaching for.</p>
            <p className="mt-3">Drag anything back onto the canvas at any time. It adapts to your current theme automatically. Named, searchable, and synced across devices on Pro.</p>
          </>
        }
      />

      <Divider />

      <FeatureSection
        flip={true}
        badge="Customisation"
        headline="Make it completely yours"
        videoLabel="VIDEO: cycling through 8 themes, toggling dot/square/off grid, changing line colour and fill opacity, adjusting left/right click tool assignment"
        body={
          <>
            <p>Eight themes. Dot or square grid. Unlimited colours. Line width, fill, dash patterns, and opacity per stroke - everything is adjustable.</p>
            <p className="mt-3">Assign different tools to left and right mouse buttons so your favourite workflow is always one click away. Your canvas, your rules.</p>
          </>
        }
      />

      <Divider />

      <FeatureSection
        flip={false}
        badge="Shapes"
        headline="Multiple shapes, different styles and fills."
        videoLabel="VIDEO: drawing circle → rectangle → star → cloud → arrow, filling a shape, adjusting opacity, switching to dashed outline"
        body={
          <>
            <p>Ten shape types, all rendered with a deliberately hand-drawn aesthetic. No two circles look exactly alike - that's the point.</p>
            <p className="mt-3">Fill, outline, opacity, dashes. Combine them freely. Shapes that feel like they belong on a whiteboard, not a vector editor.</p>
          </>
        }
      />

      <Divider />

      <TabletSection />

      <Divider />

      <UseCasesSection />

      <Divider />

      <FeatureSection
        flip={false}
        badge="Cloud"
        headline="Your canvases, everywhere"
        videoLabel="VIDEO: switching between workspace canvas slots, sync indicator appearing, then opening same canvas on a different device"
        body={
          <>
            <p>Sign in once. All your canvases sync across every device. Start sketching on your phone on the commute, pick it up on your laptop when you get to your desk.</p>
            <p className="mt-3">Your Stash syncs too. Everything is there when you need it, without thinking about it.</p>
          </>
        }
      />

      <Divider />

      <FeatureSection
        flip={true}
        badge="Sharing"
        headline="Share with one link"
        videoLabel="VIDEO: selecting a canvas, opening share modal, copying link, opening it in a new tab - viewer sees live canvas with no sign-in required"
        body={
          <>
            <p>Generate a live, read-only link for any canvas or entire workspace. Anyone with the link sees your latest version - no account, no friction.</p>
            <p className="mt-3">Send a mockup to a client. Share a diagram with a teammate. Walk someone through your thinking without exporting anything.</p>
            <p className="mt-3">The link always shows the latest. There's no "resend the updated version".</p>
          </>
        }
      />

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
