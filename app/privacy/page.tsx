import Link from "next/link";

// Privacy policy. Written to be legally complete on its own — standard
// GDPR/CCPA-style sections (controller identity, legal bases, retention,
// rights, sub-processors, cookies) — not just a Vercel Analytics disclosure.
// EXTEND HERE: if a new feature starts collecting data this page doesn't
// cover yet (a new account field, a new third-party service, a cookie-based
// tool), add it under "Information We Collect" / "How We Share Information"
// before shipping the feature, not after.
export const metadata = {
  title: "Privacy Policy",
  description: "How Besley's Lab collects, uses, and protects information from visitors and account holders.",
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3.5rem 1.5rem" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", margin: "0 0 0.25rem" }}>
        Privacy Policy
      </h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: "2.25rem" }}>
        Effective and last updated: August 26, 2026.
      </p>

      <article className="prose">
        <p>
          Besley&rsquo;s Lab (the &ldquo;Site&rdquo;) is operated by Samuel Besley, an individual
          based in Georgia, United States (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;the
          Site operator&rdquo;). This policy explains what information the Site collects, how
          it&rsquo;s used, who it&rsquo;s shared with, and the choices and rights you have,
          whether you&rsquo;re just browsing or have created an account.
        </p>
        <p>
          This policy applies only to besleyslab.com and does not cover third-party sites we link
          to (GitHub, LinkedIn, Instagram, and similar), which are governed by their own privacy
          policies.
        </p>

        <h2>1. Information We Collect</h2>

        <h3>Account information</h3>
        <p>
          If you create an account (to save arcade progress, build Hunger Games rosters, or write
          book reviews), we collect the email address, username, and optional display name you
          provide, and store your password as a salted bcrypt hash — we never store or have
          access to your plaintext password.
        </p>

        <h3>Content associated with your account</h3>
        <p>
          Content you choose to create is stored against your account: saved game progress and
          results, simulator rosters and run history, achievements, and book reviews. This
          content is only as identifying as what you choose to put in it.
        </p>

        <h3>Correspondence</h3>
        <p>
          If you email us through the contact page, we receive your email address and whatever
          you send us, and may keep that correspondence to respond to you and maintain a record
          of the exchange.
        </p>

        <h3>Automatically collected information (analytics)</h3>
        <p>
          The Site uses <strong>Vercel Web Analytics</strong> to understand how it&rsquo;s used —
          which pages get read, roughly how visitors arrive, and whether the Site works well
          across browsers and devices. It is <strong>cookieless</strong>: it does not set cookies
          or store a persistent identifier for you, and it does not track you across other
          websites. For each visit it may receive:
        </p>
        <ul>
          <li>The page URL you visited</li>
          <li>The referring site or link, if any</li>
          <li>A broad, coarse location (typically country or region — not a precise location)</li>
          <li>Browser and device type</li>
          <li>The timestamp of the visit</li>
        </ul>
        <p>
          This data is aggregated and anonymized for reporting rather than reviewed as individual
          visitor records, and is not linked to your account. We do not send names, email
          addresses, account or user IDs, order IDs, authentication tokens, or other directly
          identifying information to analytics — whether in a custom event or embedded in a page
          URL — and any dynamic route segment or query parameter that could carry identifying
          information is excluded from what analytics is given.
        </p>

        <h3>Cookies</h3>
        <p>
          We use exactly one cookie: a <strong>strictly necessary session cookie</strong> set by
          our authentication provider (NextAuth) that keeps you signed in if you have an account.
          It is required for account features to function and is not used for tracking or
          advertising. Because our analytics is cookieless and we use no advertising, tracking,
          or cross-site cookies, the Site does not show a cookie-consent banner — one generally
          isn&rsquo;t required for a strictly necessary cookie and cookieless analytics of this
          kind.
        </p>

        <h3>Local storage</h3>
        <p>
          The Site uses your browser&rsquo;s local storage to remember interface preferences
          (like light/dark theme) and progress in on-site games and easter eggs. This information
          stays on your device, is never transmitted to us or any third party, and is not
          analytics or tracking.
        </p>

        <h2>2. How We Use Information</h2>
        <p>We use the information above to:</p>
        <ul>
          <li>Provide, maintain, and secure your account and the features tied to it</li>
          <li>Authenticate you when you sign in</li>
          <li>Operate, maintain, and improve the Site, including understanding aggregate usage patterns through analytics</li>
          <li>Respond to messages you send us</li>
          <li>Detect, prevent, and address fraud, abuse, or security issues</li>
        </ul>

        <h2>3. Legal Bases for Processing (EEA/UK visitors)</h2>
        <p>If you&rsquo;re located in the EEA, UK, or another jurisdiction requiring a legal basis, we process your information under:</p>
        <ul>
          <li><strong>Performance of a contract</strong> — to provide account features you request, like saved games and reviews</li>
          <li><strong>Legitimate interests</strong> — to operate, secure, and understand usage of the Site through aggregated analytics, balanced against your rights and interests</li>
          <li><strong>Consent</strong> — where a specific feature requires it</li>
        </ul>

        <h2>4. How We Share Information</h2>
        <p>We do not sell or rent your personal information. We share information only with:</p>
        <ul>
          <li>
            <strong>Service providers</strong> — hosting, database, and analytics infrastructure
            provided by Vercel Inc. (&ldquo;Vercel&rdquo;), which processes data on our behalf to
            operate the Site and is not permitted to use it for its own marketing purposes. See{" "}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
              Vercel&rsquo;s Privacy Policy
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </li>
          <li><strong>Legal reasons</strong> — if required by law, subpoena, or other legal process, or to protect the rights, property, or safety of the Site, its users, or others</li>
          <li><strong>Business transfer</strong> — if the Site or its assets are ever transferred, information may transfer as part of that transaction, subject to this policy or a successor policy you&rsquo;re notified of</li>
        </ul>

        <h2>5. International Data Transfers</h2>
        <p>
          Our infrastructure provider, Vercel, may process and store information in the United
          States and other countries. Where required by applicable law, we rely on appropriate
          safeguards for such transfers.
        </p>

        <h2>6. Data Retention</h2>
        <p>
          We retain account information and its associated content for as long as your account is
          active, and delete or anonymize it upon a verified deletion request or account closure.
          Correspondence is kept as long as needed to address the inquiry it relates to.
          Aggregated analytics data is not linked to an identifiable person and is retained
          according to Vercel&rsquo;s own analytics retention practices.
        </p>

        <h2>7. Your Privacy Rights</h2>
        <p>
          Regardless of where you&rsquo;re located, you can request access to, correction of, or
          deletion of your account and its associated data at any time by{" "}
          <Link href="/contact">contacting us</Link>. We&rsquo;ll verify your request and act on
          it promptly.
        </p>
        <p>
          <strong>If you&rsquo;re in the EEA or UK</strong>, the GDPR/UK GDPR additionally gives
          you the right to rectify, restrict, or object to processing, to receive a copy of your
          data in a portable format, and to lodge a complaint with your local supervisory
          authority.
        </p>
        <p>
          <strong>If you&rsquo;re a California resident</strong>, the CCPA/CPRA gives you the
          right to know what personal information we&rsquo;ve collected, to delete it, to correct
          it, and to opt out of the sale or sharing of personal information — we do not sell or
          share personal information for cross-context behavioral advertising, so no opt-out is
          necessary. We will not discriminate against you for exercising any of these rights.
        </p>

        <h2>8. Children&rsquo;s Privacy</h2>
        <p>
          The Site is not directed to children under 13 (or under 16 in the EEA/UK), and we do
          not knowingly collect personal information from children. If you believe a child has
          provided us with personal information, contact us and we will delete it.
        </p>

        <h2>9. Security</h2>
        <p>
          We use reasonable technical measures to protect your information, including
          bcrypt-hashed passwords, encrypted transport (HTTPS/TLS), and access controls on
          administrative functions. No method of transmission or storage is completely secure,
          and we cannot guarantee absolute security.
        </p>

        <h2>10. Do Not Track</h2>
        <p>
          Because our analytics is cookieless and we don&rsquo;t track visitors across third-party
          sites for behavioral advertising, there is no cross-site tracking for a Do Not Track
          signal to disable, and we do not currently respond to DNT signals differently.
        </p>

        <h2>11. Other Tracking Technologies</h2>
        <p>
          We do not currently use Google Analytics, Meta/Facebook Pixel, advertising trackers, or
          session-replay tools. If that ever changes, this policy will be updated first, and —
          for visitors in the UK or EU in particular — those tools won&rsquo;t load until
          you&rsquo;ve given opt-in consent, typically via a cookie/consent banner introduced at
          that time.
        </p>

        <h2>12. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Changes take effect when posted, and the
          &ldquo;last updated&rdquo; date above will reflect the most recent revision. Material
          changes will be noted on this page.
        </p>

        <h2>13. Contact Us</h2>
        <p>
          Questions about this policy or your data can be sent via the{" "}
          <Link href="/contact">contact page</Link>.
        </p>
      </article>
    </main>
  );
}
