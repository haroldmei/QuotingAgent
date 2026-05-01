import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — QuotingAgent",
  description: "How QuotingAgent collects, uses, and protects your personal data.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <article className="max-w-4xl mx-auto px-4 py-12 text-gray-900">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-gray-600">
            Last updated: <time dateTime="2026-05-01">1 May 2026</time>
          </p>
        </header>

        <div className="prose prose-lg max-w-none space-y-8">
          {/* Section 1: Identity & Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Who We Are</h2>
            <p>
              <strong>Service Provider:</strong> QuotingAgent Pty Ltd (ABN [TBD])
            </p>
            <p>
              <strong>Contact:</strong>{" "}
              <a href="mailto:privacy@quotingagent.io" className="text-orange-600 hover:underline">
                privacy@quotingagent.io
              </a>
            </p>
            <p className="text-sm text-gray-600 mt-4">
              We are an Australian Data Custodian registered to collect and process personal information
              under the <em>Privacy Act 1988 (Cth)</em> and the Australian Privacy Principles (APPs). This
              privacy policy explains how we handle personal information in accordance with the APPs.
            </p>
          </section>

          {/* Section 2: Data We Collect */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Personal Information We Collect</h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Account & Identification Data</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Mobile phone number (E.164 format)</li>
              <li>Business name</li>
              <li>Trade type (roofer, painter, electrician, plumber, landscaper)</li>
              <li>NSW Contractor Licence number (validated against Service NSW)</li>
              <li>Australian Business Number (ABN)</li>
              <li>Default labour rate (AUD)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.2 Content & Job Data</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Site photos (with EXIF and GPS metadata preserved)</li>
              <li>Lead information (customer name, mobile, address, job description)</li>
              <li>Generated quotes (line items, pricing, totals)</li>
              <li>Quote acceptance records (customer names, timestamps, IP addresses, device info)</li>
              <li>Job completion records (quoted vs. invoiced amounts)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.3 Usage & Technical Data</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>IP address and location</li>
              <li>Browser type, device type, and operating system</li>
              <li>Pages visited, features used, time spent</li>
              <li>Crash logs and error reports (via Sentry)</li>
              <li>SMS delivery status and read receipts (from Twilio)</li>
              <li>API latency and AI model usage metrics</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.4 AI & Payment Processing Data</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Photos and job descriptions sent to Anthropic (Claude AI) for quote generation</li>
              <li>AI model performance metrics (tokens used, cost, confidence scores)</li>
              <li>Payment information processed by Stripe (we do not store card numbers)</li>
              <li>OAuth tokens for FSM integrations (ServiceM8, Tradify) — encrypted at rest</li>
            </ul>

            <p className="text-sm text-gray-600 mt-4">
              <strong>Important:</strong> We do not intentionally collect sensitive information (racial or
              ethnic origin, political opinion, religious belief, trade union membership, genetic data,
              biometric data for ID, health information, criminal record) except where required by law
              (e.g., licence number for regulatory compliance).
            </p>
          </section>

          {/* Section 3: How We Use Data */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Service Delivery</h4>
                <p>
                  To provide the core QuotingAgent service: authenticating users, generating quotes via
                  AI, sending quotes by SMS, capturing customer acceptance, integrating with your FSM,
                  and tracking quote outcomes.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Communication</h4>
                <p>
                  To send push notifications (quote ready, SMS delivered, quote opened), SMS follow-ups
                  (D+3, D+7), and support emails. You can disable SMS follow-ups per lead in the app.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Regulatory Compliance</h4>
                <p>
                  To validate your NSW Contractor Licence number against Service NSW (required before
                  first quote), bind your licence number to every quote you send, and maintain statutory
                  warranty wording on quotes.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Product Improvement & Analytics</h4>
                <p>
                  To measure how the product is used (via PostHog, after you consent), improve quote
                  accuracy via AI evaluation (promptfoo), and identify and fix bugs. We do not sell your
                  data for marketing purposes.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">AI Model Training</h4>
                <p>
                  Photos and job descriptions are sent to Anthropic (Claude AI) to generate quotes.
                  Anthropic may use this data for model improvement per their privacy policy. We
                  recommend reading{" "}
                  <a
                    href="https://www.anthropic.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Anthropic's Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Legal & Safety</h4>
                <p>
                  To comply with law, enforce our Terms of Service, protect against fraud, and respond
                  to valid legal requests from Australian authorities.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Legal Basis */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">
              4. Legal Basis for Processing (APP 1 & 6)
            </h2>

            <p className="mb-4">
              Under the Australian Privacy Principles, we process your personal information on one or more
              of these bases:
            </p>

            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Consent:</strong> You have consented (e.g., you created an account, enabled push
                notifications, agreed to analytics).
              </li>
              <li>
                <strong>Contract Performance:</strong> Processing is necessary to provide the service you
                requested (e.g., generating quotes, sending SMSes).
              </li>
              <li>
                <strong>Legal Obligation:</strong> We are required by law to process your information
                (e.g., validating your NSW licence, maintaining records for statutory warranty claims).
              </li>
              <li>
                <strong>Legitimate Interest:</strong> We have a legitimate business interest and it does
                not override your privacy interests (e.g., fraud detection, analytics, product improvement).
              </li>
            </ul>
          </section>

          {/* Section 5: Data Sharing */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Who We Share Your Data With (APP 1 & 6)</h2>

            <p className="mb-4">We share personal information with the following third parties:</p>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Supabase (Cloud Provider)</h4>
                <p>
                  Database hosting (Postgres, JWT tokens, OTP codes). Data stored in AWS ap-southeast-2
                  (Sydney). See{" "}
                  <a
                    href="https://supabase.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Supabase Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Google Cloud Platform (GCS)</h4>
                <p>
                  Photo and PDF storage in ap-southeast-2 (Sydney) and australia-southeast1 (Canberra).
                  Default encryption at rest. See{" "}
                  <a
                    href="https://cloud.google.com/terms/cloud-privacy-notice"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GCP Privacy Notice
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Anthropic (Claude AI)</h4>
                <p>
                  Photos and job descriptions are sent to Claude API (Opus-4-7, Haiku-4-5 models) to
                  generate quote line items. Anthropic may use this data per their privacy policy. See{" "}
                  <a
                    href="https://www.anthropic.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Anthropic Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Twilio (SMS Delivery)</h4>
                <p>
                  Customer name, address, and message body are sent to Twilio AU long-code service to
                  deliver quotes by SMS. Twilio tracks delivery and read status. See{" "}
                  <a
                    href="https://www.twilio.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Twilio Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Resend (Email Fallback)</h4>
                <p>
                  If SMS delivery fails, quotes are sent by email via Resend. See{" "}
                  <a
                    href="https://resend.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Resend Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Service NSW (Licence Validation)</h4>
                <p>
                  Your NSW Contractor Licence number is validated against the Service NSW REST API at
                  onboarding. See{" "}
                  <a
                    href="https://www.nsw.gov.au/"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Service NSW
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Stripe (Payment Processing)</h4>
                <p>
                  If you subscribe, payment is processed by Stripe (we do not store card numbers). See{" "}
                  <a
                    href="https://stripe.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Stripe Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">PostHog (Analytics)</h4>
                <p>
                  Usage events are sent to PostHog (only after you consent). PostHog can be opted out
                  at any time. See{" "}
                  <a
                    href="https://posthog.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    PostHog Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Sentry (Error Tracking)</h4>
                <p>
                  Crashes and errors are logged to Sentry with PII redaction. See{" "}
                  <a
                    href="https://sentry.io/privacy/"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sentry Privacy Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-semibold">ServiceM8 / Tradify (FSM Integration)</h4>
                <p>
                  If you connect your FSM account via OAuth, won quotes are pushed to your FSM as job
                  records. See ServiceM8 and Tradify privacy policies.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Upstash Redis (Queue & Cache)</h4>
                <p>
                  Rate limits and job queues are backed by Upstash Redis. See{" "}
                  <a
                    href="https://upstash.com/privacy"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Upstash Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              <strong>No sale of data:</strong> We do not sell your personal information to third parties
              for marketing purposes. We are a B2B tool, not an ad network.
            </p>
          </section>

          {/* Section 6: Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention (APP 11)</h2>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Account Data</h4>
                <p>
                  Retained while your account is active. Upon account deletion, personal information
                  (phone, business name, ABN, licence) is permanently deleted within 30 days.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Quotes & Leads</h4>
                <p>
                  Retained for 2 years after the quote is sent (to comply with statutory warranty claim
                  periods under NSW Home Building Act). Deleted automatically after 2 years.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Photos</h4>
                <p>
                  Retained for 2 years with the associated quote. Deleted when the quote is purged.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Quote Acceptance Records</h4>
                <p>
                  Retained for 7 years from date of acceptance (to comply with statutory warranties and
                  potential disputes). Automatically deleted after 7 years.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Analytics Events</h4>
                <p>
                  PostHog analytics data is retained for 1 year by default (configurable in PostHog).
                  You can request deletion earlier.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Logs & Error Reports</h4>
                <p>
                  Application logs (Sentry, Pino) are retained for 30 days and then deleted.
                </p>
              </div>
            </div>
          </section>

          {/* Section 7: Your Privacy Rights */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Privacy Rights (APPs 12 & 13)</h2>

            <p className="mb-4">
              Under the Australian Privacy Principles, you have the following rights:
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold">Right of Access (APP 12.1)</h4>
                <p>
                  You can request a copy of all personal information we hold about you. Use the{" "}
                  <strong>/api/auth/export</strong> endpoint to download your data in JSON format.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Right of Rectification (APP 12.2)</h4>
                <p>
                  You can request correction of inaccurate or incomplete information. Contact us at{" "}
                  <a href="mailto:privacy@quotingagent.io" className="text-orange-600 hover:underline">
                    privacy@quotingagent.io
                  </a>{" "}
                  with details.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Right of Erasure (APP 12.2)</h4>
                <p>
                  You can request deletion of your account and associated data. Use the{" "}
                  <strong>/api/auth/account</strong> endpoint to initiate account deletion. Your account
                  will be soft-deleted immediately and hard-deleted after 30 days (in case you want to
                  reactivate).
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Right to Portability (APP 12.1)</h4>
                <p>
                  You can request your data in a portable, structured format (JSON). Use the{" "}
                  <strong>/api/auth/export</strong> endpoint.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Right to Object (APP 12.3)</h4>
                <p>
                  You can opt out of analytics, disable SMS follow-ups, and revoke FSM integrations at
                  any time in the app. Contact us for other objections.
                </p>
              </div>

              <div>
                <h4 className="font-semibold">Complaint to Privacy Commissioner (APP 1.2)</h4>
                <p>
                  If you believe your privacy has been breached, you can lodge a complaint with the
                  Office of the Australian Information Commissioner (OAIC) at{" "}
                  <a
                    href="https://www.oaic.gov.au/"
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    www.oaic.gov.au
                  </a>
                  .
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 mt-4">
              To exercise any of these rights, email{" "}
              <a href="mailto:privacy@quotingagent.io" className="text-orange-600 hover:underline">
                privacy@quotingagent.io
              </a>{" "}
              with your request. We will respond within 30 days.
            </p>
          </section>

          {/* Section 8: International Transfers */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers (APP 1.2)</h2>

            <p>
              Your data is primarily stored in Australia (ap-southeast-2, Sydney). However, some processing
              occurs overseas:
            </p>

            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                <strong>Anthropic (Claude API):</strong> USA-based. Photos and descriptions are sent to
                Anthropic's servers for AI processing. Anthropic is not subject to Australian privacy law
                but has committed to privacy protections under their own policy.
              </li>
              <li>
                <strong>PostHog (Analytics):</strong> EU-based. Usage events are sent for analytics.
              </li>
              <li>
                <strong>Sentry (Error Tracking):</strong> USA-based. Error reports are sent.
              </li>
              <li>
                <strong>Stripe (Payments):</strong> USA-based. Payment processing via PCI-compliant
                infrastructure.
              </li>
            </ul>

            <p className="text-sm text-gray-600 mt-4">
              By using QuotingAgent, you consent to these international transfers. We only transfer data
              when necessary for service delivery and require our service providers to protect your
              information.
            </p>
          </section>

          {/* Section 9: Security */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Security Measures</h2>

            <p className="mb-4">We implement the following security controls:</p>

            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>HTTPS everywhere:</strong> All data is encrypted in transit (TLS 1.2+).
              </li>
              <li>
                <strong>Encryption at rest:</strong> Database and cloud storage are encrypted by default
                (AES-256).
              </li>
              <li>
                <strong>Secrets management:</strong> API keys and OAuth tokens are stored in GCP Secret
                Manager (encrypted).
              </li>
              <li>
                <strong>Row-Level Security (RLS):</strong> Postgres RLS policies ensure crew data is
                isolated per tenant.
              </li>
              <li>
                <strong>Rate limiting:</strong> API endpoints are protected against brute-force attacks.
              </li>
              <li>
                <strong>Argon2id hashing:</strong> Any passwords are hashed with Argon2id (no plain text
                stored).
              </li>
              <li>
                <strong>Content Security Policy (CSP):</strong> Strict CSP headers prevent XSS and
                injection attacks.
              </li>
              <li>
                <strong>HSTS:</strong> HTTP Strict Transport Security enforced for 2 years.
              </li>
              <li>
                <strong>PII redaction in logs:</strong> Customer names, phone numbers, and addresses are
                redacted from application logs.
              </li>
              <li>
                <strong>Signed URLs:</strong> PDFs and photos are accessed via time-limited, HMAC-signed
                URLs (≤ 30 days expiry).
              </li>
            </ul>

            <p className="text-sm text-gray-600 mt-4">
              <strong>Note:</strong> No system is 100% secure. If we discover a security breach, we will
              notify affected users within 30 days as required by the Privacy Act.
            </p>
          </section>

          {/* Section 10: Policy Changes */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>

            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, legal requirements, or other factors. We will notify you of material changes by:
            </p>

            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Posting the updated policy on this page (with a new "last updated" date)</li>
              <li>
                Sending you an in-app notification or email (if the change materially affects your rights)
              </li>
              <li>Requesting your consent (if required by law)</li>
            </ul>

            <p className="mt-4">
              Your continued use of QuotingAgent after changes constitutes acceptance of the updated
              Privacy Policy.
            </p>
          </section>

          {/* Section 11: Contact Us */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>

            <p className="mb-4">If you have questions about this Privacy Policy or our privacy practices:</p>

            <div className="bg-gray-100 p-4 rounded-lg">
              <p>
                <strong>Email:</strong>{" "}
                <a href="mailto:privacy@quotingagent.io" className="text-orange-600 hover:underline">
                  privacy@quotingagent.io
                </a>
              </p>
              <p className="mt-2">
                <strong>Mailing Address:</strong>
                <br />
                QuotingAgent Pty Ltd
                <br />
                Sydney, NSW 2000
                <br />
                Australia
              </p>
              <p className="mt-2">
                <strong>Response time:</strong> We aim to respond to all inquiries within 5 business days.
              </p>
            </div>
          </section>

          {/* Disclaimer */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
            <p className="text-sm">
              <strong>Disclaimer:</strong> This Privacy Policy is a template based on best practices for
              Australian compliance (Privacy Act 1988, APPs) and is not legal advice. We recommend having
              this policy reviewed by a qualified Australian privacy lawyer before launch. If there is any
              conflict between this policy and legal requirements, the legal requirements will prevail.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
