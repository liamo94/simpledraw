import { DrawzillaLogo } from './Logo'

const SUPPORT_EMAIL = 'liam@drawzil.la'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-base font-semibold text-white/80 mb-3">{title}</h2>
      <div className="text-sm text-white/50 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function Terms() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#06060f' }}>
      <header className="px-6 py-5">
        <DrawzillaLogo iconSize={32} fontSize="1.5rem" />
      </header>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <a href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors mb-10 inline-block">← Back</a>

        <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
        <p className="text-xs text-white/25 mb-12">Last updated: May 2025</p>

        <Section title="About drawzilla">
          <p>drawzilla is a drawing application available at <a href="https://drawzil.la" className="text-white/70 underline hover:text-white">drawzil.la</a>. The drawzilla Unleashed subscription ("Unleashed") is available at <span className="text-white/70">unleash.drawzil.la</span>.</p>
          <p>By using drawzilla or subscribing to Unleashed, you agree to these terms. If you do not agree, please do not use the service.</p>
        </Section>

        <Section title="The free service">
          <p>drawzilla is free to use without an account. Signed-in users on the free tier get one cloud workspace with up to 3 canvases, frozen share links (7-day), and PNG export with a watermark.</p>
          <p>We reserve the right to change or discontinue free-tier features at any time with reasonable notice.</p>
        </Section>

        <Section title="Unleashed subscription">
          <p>Unleashed costs £2.99 per month, billed monthly via Stripe. Subscribing gives you access to all 9 canvas slots per workspace, unlimited workspaces, clean PNG and SVG export, permanent share links, and priority support.</p>
          <p>You can cancel at any time via the Stripe Customer Portal. After cancellation, you retain full Pro access until the end of your current billing period, then enter a 30-day grace period. After the grace period, your cloud canvases and workspaces are deleted and your account reverts to the free tier.</p>
          <p>We do not offer refunds for partial billing periods, but you can export all your canvas data at any time before deletion.</p>
        </Section>

        <Section title="Your content">
          <p>You own the drawings you create in drawzilla. We do not claim any rights over your canvas content.</p>
          <p>By storing canvases in the cloud, you grant us the limited right to store and transmit your content as needed to operate the service - for example, syncing canvases across your devices and serving share links you create.</p>
          <p>You are responsible for the content you create and share. Do not use drawzilla to create or share content that is illegal, harmful, or infringes on others' rights.</p>
        </Section>

        <Section title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1">
            <li>Use drawzilla for any illegal purpose.</li>
            <li>Attempt to access or interfere with other users' data.</li>
            <li>Circumvent plan limits or attempt to abuse the free tier.</li>
            <li>Use the service in a way that places unreasonable load on our infrastructure.</li>
          </ul>
          <p>We reserve the right to terminate or suspend accounts that violate these terms.</p>
        </Section>

        <Section title="Availability">
          <p>We aim to keep drawzilla available at all times but do not guarantee uptime. We may take the service down for maintenance or updates with or without notice.</p>
          <p>drawzilla is provided "as is." To the extent permitted by law, we disclaim all warranties - express or implied - about the service, including warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
        </Section>

        <Section title="Limitation of liability">
          <p>To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages arising from your use of drawzilla, including loss of data. Our total liability for any claim related to the service is limited to the amount you paid us in the 12 months before the claim.</p>
          <p>We strongly recommend exporting important work via the export function. We perform daily backups but cannot guarantee against data loss.</p>
        </Section>

        <Section title="Changes to these terms">
          <p>We may update these terms from time to time. Material changes will be noted at the top of this page. Continued use of the service after changes constitutes acceptance of the new terms.</p>
        </Section>

        <Section title="Contact">
          <p>Questions about these terms? Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-white/70 underline hover:text-white">{SUPPORT_EMAIL}</a>.</p>
        </Section>
      </div>
    </div>
  )
}
