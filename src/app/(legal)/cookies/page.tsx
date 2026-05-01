import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy — QuotingAgent",
  description: "Information about cookies and tracking used on QuotingAgent.",
  robots: { index: true, follow: true },
};

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-white">
      <article className="max-w-4xl mx-auto px-4 py-12 text-gray-900">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
          <p className="text-gray-600">
            Last updated: <time dateTime="2026-05-01">1 May 2026</time>
          </p>
        </header>

        <div className="prose prose-lg max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <p>
              This Cookie Policy explains how QuotingAgent uses cookies and similar tracking technologies
              to recognize you, remember your settings, understand how you use the platform, and improve
              your experience.
            </p>
          </section>

          {/* Section 1: What Are Cookies */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies?</h2>
            <p>
              A cookie is a small text file stored on your device (computer, phone, tablet) that contains
              data about your browsing. Cookies are sent back to the server on each request, allowing us to
              recognize you and remember your preferences.
            </p>
            <p className="mt-4">
              <strong>Similar technologies:</strong> We also use local storage (localStorage), session
              storage (sessionStorage), and web beacons (tracking pixels) for similar purposes.
            </p>
          </section>

          {/* Section 2: Categories of Cookies */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Cookie Categories</h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Necessary / Essential Cookies</h3>
            <p>
              These cookies are required for the platform to function. They are always enabled and do not
              require consent.
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left">Cookie Name</th>
                    <th className="border p-2 text-left">Purpose</th>
                    <th className="border p-2 text-left">Duration</th>
                    <th className="border p-2 text-left">Provider</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">__Host-auth-token</td>
                    <td className="border p-2">JWT access token for authentication</td>
                    <td className="border p-2">1 hour</td>
                    <td className="border p-2">QuotingAgent / Supabase</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border p-2">__Host-refresh-token</td>
                    <td className="border p-2">JWT refresh token for session management</td>
                    <td className="border p-2">30 days</td>
                    <td className="border p-2">QuotingAgent / Supabase</td>
                  </tr>
                  <tr>
                    <td className="border p-2">sb-ap-southeast-2-auth-token</td>
                    <td className="border p-2">Supabase Auth session identifier</td>
                    <td className="border p-2">Session / 1 hour</td>
                    <td className="border p-2">Supabase</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border p-2">NEXT_LOCALE</td>
                    <td className="border p-2">Language preference (en-AU)</td>
                    <td className="border p-2">1 year</td>
                    <td className="border p-2">Next.js</td>
                  </tr>
                  <tr>
                    <td className="border p-2">cookie_consent</td>
                    <td className="border p-2">Your cookie consent preference</td>
                    <td className="border p-2">1 year</td>
                    <td className="border p-2">QuotingAgent</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.2 Analytics Cookies</h3>
            <p>
              These cookies help us understand how you use the platform (which pages you visit, how long
              you stay, errors you encounter). They are <strong>optional</strong> and require your consent.
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left">Cookie Name</th>
                    <th className="border p-2 text-left">Purpose</th>
                    <th className="border p-2 text-left">Duration</th>
                    <th className="border p-2 text-left">Provider</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">ph_... (multiple)</td>
                    <td className="border p-2">
                      PostHog analytics: user ID, session ID, feature flags
                    </td>
                    <td className="border p-2">365 days</td>
                    <td className="border p-2">PostHog</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border p-2">sentry-... (multiple)</td>
                    <td className="border p-2">
                      Sentry error tracking: crash reports, performance traces
                    </td>
                    <td className="border p-2">Session / 30 days</td>
                    <td className="border p-2">Sentry</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.3 Marketing / Functional Cookies</h3>
            <p>
              Currently, QuotingAgent does not use marketing cookies or third-party tracking cookies
              (Google Analytics, Facebook Pixel, etc.). All tracking is internal (PostHog, Sentry) and
              consent-gated.
            </p>
          </section>

          {/* Section 3: Web Storage */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Web Storage (localStorage & sessionStorage)</h2>

            <p>
              In addition to cookies, QuotingAgent uses browser-based storage for the following:
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full border border-gray-300 text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left">Storage Key</th>
                    <th className="border p-2 text-left">Purpose</th>
                    <th className="border p-2 text-left">Duration</th>
                    <th className="border p-2 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">user_preferences</td>
                    <td className="border p-2">Dark mode, notification settings, layout preference</td>
                    <td className="border p-2">Indefinite (until cleared)</td>
                    <td className="border p-2">localStorage</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border p-2">draft_quote</td>
                    <td className="border p-2">Temporary quote draft while editing (not submitted)</td>
                    <td className="border p-2">Session (cleared on logout)</td>
                    <td className="border p-2">sessionStorage</td>
                  </tr>
                  <tr>
                    <td className="border p-2">onboarding_step</td>
                    <td className="border p-2">Onboarding progress (phone, OTP, profile)</td>
                    <td className="border p-2">Session</td>
                    <td className="border p-2">sessionStorage</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Consent & Opt-Out */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Consent & Opting Out</h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Cookie Consent Banner</h3>
            <p>
              When you first visit QuotingAgent, a cookie consent banner appears. You can:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                <strong>Accept All:</strong> Enable all cookies (necessary + analytics).
              </li>
              <li>
                <strong>Reject Non-Essential:</strong> Enable only necessary cookies (authentication,
                session).
              </li>
              <li>
                <strong>Customize:</strong> Choose which categories to enable.
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Changing Your Preference</h3>
            <p>
              You can change your cookie consent preference at any time by:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-4">
              <li>Opening the app settings (⚙ icon)</li>
              <li>Scrolling to "Privacy & Cookies"</li>
              <li>Adjusting your consent preferences</li>
              <li>Clicking "Save Preferences"</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.3 Browser-Level Controls</h3>
            <p>
              You can also manage cookies at the browser level:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                <strong>Chrome / Edge:</strong> Settings &gt; Privacy and security &gt; Cookies and other
                site data
              </li>
              <li>
                <strong>Safari (iOS/macOS):</strong> Settings &gt; Safari &gt; Privacy
              </li>
              <li>
                <strong>Firefox:</strong> Preferences &gt; Privacy & Security &gt; Cookies and Site Data
              </li>
            </ul>

            <p className="text-sm text-gray-600 mt-4">
              <strong>Note:</strong> Disabling necessary cookies may impair your ability to use
              QuotingAgent (you may not be able to log in).
            </p>
          </section>

          {/* Section 5: Do Not Track */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Do Not Track (DNT)</h2>

            <p>
              Some browsers include a "Do Not Track" (DNT) feature. Currently, QuotingAgent does not respond
              to DNT signals, as DNT is not widely standardized. However, you can opt out of analytics via
              the cookie consent banner (§4).
            </p>
          </section>

          {/* Section 6: Third-Party Cookies */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Cookies</h2>

            <p>
              QuotingAgent uses the following third-party services that may set cookies:
            </p>

            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                <strong>Supabase (Authentication):</strong> May set authentication cookies. See{" "}
                <a
                  href="https://supabase.com/privacy"
                  className="text-orange-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Supabase Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>PostHog (Analytics):</strong> Sets analytics cookies. See{" "}
                <a
                  href="https://posthog.com/privacy"
                  className="text-orange-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PostHog Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Sentry (Error Tracking):</strong> May set performance tracking cookies. See{" "}
                <a
                  href="https://sentry.io/privacy/"
                  className="text-orange-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sentry Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Vercel (Hosting):</strong> May set edge analytics cookies. See{" "}
                <a
                  href="https://vercel.com/legal/privacy"
                  className="text-orange-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Vercel Privacy Policy
                </a>
                .
              </li>
            </ul>
          </section>

          {/* Section 7: Automatic Updates */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Automatic Updates</h2>

            <p>
              We may update this Cookie Policy to reflect changes in technology, legal requirements, or
              service providers. We will update the "last updated" date and notify you of material changes
              via in-app notification or email.
            </p>
          </section>

          {/* Section 8: Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Questions?</h2>

            <p>
              If you have questions about our use of cookies or would like to opt out, contact:
            </p>

            <div className="bg-gray-100 p-4 rounded-lg mt-4">
              <a href="mailto:privacy@quotingagent.io" className="text-orange-600 hover:underline">
                privacy@quotingagent.io
              </a>
            </div>
          </section>

          {/* Disclaimer */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
            <p className="text-sm">
              <strong>Disclaimer:</strong> This Cookie Policy is a template and should be reviewed by a
              qualified Australian lawyer before launch. Ensure compliance with the Privacy Act 1988 and
              Australian Privacy Principles.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
