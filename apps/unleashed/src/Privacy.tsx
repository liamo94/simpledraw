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

export default function Privacy() {
  return (
    <div className="min-h-screen text-white" style={{ background: '#06060f' }}>
      <header className="px-6 py-5">
        <DrawzillaLogo iconSize={32} fontSize="1.5rem" />
      </header>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <a href="/" className="text-xs text-white/30 hover:text-white/60 transition-colors mb-10 inline-block">← Back</a>

        <h1 className="text-2xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-xs text-white/25 mb-12">Last updated: May 2025</p>

        <Section title="Who we are">
          <p>drawzilla is a drawing app at <a href="https://drawzil.la" className="text-white/70 underline hover:text-white">drawzil.la</a>. The drawzilla Unleashed subscription is available at <span className="text-white/70">unleash.drawzil.la</span>. This policy covers both.</p>
          <p>If you have questions, contact us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-white/70 underline hover:text-white">{SUPPORT_EMAIL}</a>.</p>
        </Section>

        <Section title="What we collect">
          <p><span className="text-white/70">Account information.</span> When you sign in, your name and email address are provided to us by Clerk (our authentication provider). We store your email and a user ID in our database.</p>
          <p><span className="text-white/70">Canvas data.</span> If you are signed in, your drawings and canvas settings are stored in our cloud storage (Cloudflare R2). This includes strokes, images you paste or import, and workspace names you choose.</p>
          <p><span className="text-white/70">Subscription information.</span> If you subscribe to Unleashed, Stripe handles your payment. We store your Stripe customer ID and subscription status in our database. We do not store card numbers or payment details.</p>
          <p><span className="text-white/70">Usage data.</span> We do not currently use analytics or tracking. No cookies beyond those set by Clerk and Stripe (which are necessary for authentication and payment) are placed in your browser.</p>
        </Section>

        <Section title="How we use it">
          <ul className="list-disc list-inside space-y-1.5 pl-1">
            <li>To sync your canvases across devices when you are signed in.</li>
            <li>To manage your subscription and enforce plan limits.</li>
            <li>To restore your account and data if something goes wrong.</li>
            <li>To respond to support requests.</li>
          </ul>
          <p>We do not sell your data. We do not use your canvas content for advertising or for training AI models.</p>
        </Section>

        <Section title="How we store it">
          <p>Canvas data is encrypted at rest by Cloudflare R2 (AES-256) — standard infrastructure-level encryption. This is the same model used by Notion, Figma, and Linear.</p>
          <p>As the operator of the service, we can technically access canvas data, but we do not do so except as required to operate or debug the service (for example, investigating a reported data loss bug).</p>
          <p>Our database and storage infrastructure is hosted on Cloudflare's network in the EU and US.</p>
        </Section>

        <Section title="Sharing with third parties">
          <p>We share data with the following third-party services only as needed to operate drawzilla:</p>
          <ul className="list-disc list-inside space-y-1.5 pl-1">
            <li><span className="text-white/70">Clerk</span> — authentication and session management. Clerk processes your sign-in and stores your identity. See <a href="https://clerk.com/privacy" className="underline hover:text-white/70">clerk.com/privacy</a>.</li>
            <li><span className="text-white/70">Stripe</span> — payment processing. Stripe handles all billing for Unleashed subscriptions. See <a href="https://stripe.com/privacy" className="underline hover:text-white/70">stripe.com/privacy</a>.</li>
            <li><span className="text-white/70">Cloudflare</span> — hosting, storage, and infrastructure. See <a href="https://www.cloudflare.com/privacypolicy/" className="underline hover:text-white/70">cloudflare.com/privacypolicy</a>.</li>
          </ul>
          <p>We do not share your data with any other third parties.</p>
        </Section>

        <Section title="Data retention">
          <p>If you cancel your Unleashed subscription, your canvases and workspaces remain accessible for 30 days. After the grace period, your cloud data is deleted and your account reverts to the free tier.</p>
          <p>If you delete your account via Clerk, we will delete your associated data from our database and storage on request. Email us at <a href={`mailto:${SUPPORT_EMAIL}`} className="text-white/70 underline hover:text-white">{SUPPORT_EMAIL}</a>.</p>
          <p>Local (non-signed-in) usage is stored only in your browser's localStorage and IndexedDB. We have no access to this data.</p>
        </Section>

        <Section title="Your rights">
          <p>Depending on where you live, you may have the right to access, correct, or delete your personal data, or to object to its processing. To exercise any of these rights, email <a href={`mailto:${SUPPORT_EMAIL}`} className="text-white/70 underline hover:text-white">{SUPPORT_EMAIL}</a>.</p>
        </Section>

        <Section title="Children">
          <p>drawzilla is not directed at children under 13. We do not knowingly collect data from children under 13.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy from time to time. Material changes will be noted at the top of this page with an updated date. Continued use of the service after changes constitutes acceptance.</p>
        </Section>
      </div>
    </div>
  )
}
