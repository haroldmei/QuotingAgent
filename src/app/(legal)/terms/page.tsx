import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — QuotingAgent",
  description: "Legal terms and conditions for using QuotingAgent.",
  robots: { index: true, follow: true },
};

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <article className="max-w-4xl mx-auto px-4 py-12 text-gray-900">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-gray-600">
            Last updated: <time dateTime="2026-05-01">1 May 2026</time>
          </p>
        </header>

        <div className="prose prose-lg max-w-none space-y-8">
          {/* Section 1: Acceptance */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using QuotingAgent (the "Service"), you agree to be bound by these Terms of
              Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
            </p>
            <p>
              We reserve the right to update these Terms at any time. We will notify you of material
              changes via in-app notification, email, or by updating the "last updated" date on this page.
              Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          {/* Section 2: Eligibility */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Eligibility</h2>
            <p>To use QuotingAgent, you must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Be at least 18 years of age</li>
              <li>Hold a valid, current NSW Contractor Licence (for residential work ≥ A$5,000)</li>
              <li>Be authorized to enter into contracts on behalf of your business</li>
              <li>Not be in breach of any Australian laws or regulations</li>
              <li>Provide accurate, current information during onboarding</li>
            </ul>
            <p className="text-sm text-gray-600 mt-4">
              Misrepresenting your license status may result in immediate account suspension.
            </p>
          </section>

          {/* Section 3: Account Responsibilities */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Your Account & Security</h2>
            <p>
              <strong>3.1 Account Ownership:</strong> You are responsible for maintaining the
              confidentiality of your phone number and OTP codes. You are liable for all activity under
              your account.
            </p>
            <p className="mt-4">
              <strong>3.2 Accuracy:</strong> You agree to provide accurate business information,
              contractor licence number, ABN, and labour rates. You are responsible for updating this
              information if it changes.
            </p>
            <p className="mt-4">
              <strong>3.3 One Account Per Business:</strong> Each business entity should have one primary
              account. Multiple accounts for the same business may result in suspension.
            </p>
            <p className="mt-4">
              <strong>3.4 Password Security:</strong> If you set a password (for future OAuth flows), keep
              it secret and do not share it with anyone.
            </p>
            <p className="mt-4">
              <strong>3.5 Notification of Breach:</strong> If you suspect unauthorized access to your
              account, contact us immediately at{" "}
              <a href="mailto:support@quotingagent.io" className="text-orange-600 hover:underline">
                support@quotingagent.io
              </a>
              .
            </p>
          </section>

          {/* Section 4: Acceptable Use */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use Policy</h2>
            <p>You agree not to use QuotingAgent for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                <strong>Illegal activities:</strong> Breaking any Australian law, including sending
                unsolicited SMS to customers
              </li>
              <li>
                <strong>Fraud or misrepresentation:</strong> Sending quotes with false licence numbers,
                forged signatures, or misleading pricing
              </li>
              <li>
                <strong>Abuse:</strong> Harassing, threatening, or discriminating against customers or
                platform staff
              </li>
              <li>
                <strong>Spam:</strong> Sending bulk unsolicited quotes or auto-reply SMS
              </li>
              <li>
                <strong>Circumvention:</strong> Attempting to bypass rate limits, access other crews' data,
                or scrape the platform
              </li>
              <li>
                <strong>Malware:</strong> Uploading malicious files or code
              </li>
              <li>
                <strong>Warranty breach:</strong> Sending quotes without the statutory warranty wording
                required by NSW Home Building Act
              </li>
            </ul>
            <p className="text-sm text-gray-600 mt-4">
              Violations may result in account suspension or permanent termination at our discretion.
            </p>
          </section>

          {/* Section 5: Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property Rights</h2>
            <p>
              <strong>5.1 Platform IP:</strong> All content, features, and functionality of QuotingAgent
              (including the UI, algorithms, and AI models) are the exclusive property of QuotingAgent Pty
              Ltd or our licensors. You are granted a limited, non-exclusive, revocable license to use the
              Service for lawful business purposes.
            </p>
            <p className="mt-4">
              <strong>5.2 Your Content:</strong> You retain all rights to photos, job descriptions, and
              other content you upload. You grant QuotingAgent a license to use this content to provide the
              Service (generating quotes, storing records, displaying on customer pages).
            </p>
            <p className="mt-4">
              <strong>5.3 AI-Generated Quotes:</strong> Quotes generated by QuotingAgent (line items,
              pricing) are suggestions based on historical data and AI analysis. You are responsible for
              reviewing and approving them before sending to customers. QuotingAgent makes no guarantee of
              accuracy or completeness.
            </p>
            <p className="mt-4">
              <strong>5.4 No Copying:</strong> You may not reproduce, distribute, modify, or reverse-engineer
              the QuotingAgent platform or AI models without written permission.
            </p>
          </section>

          {/* Section 6: AI-Generated Content Disclaimer */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. AI-Generated Content Disclaimer</h2>
            <p className="mb-4">
              QuotingAgent uses AI (Anthropic Claude) to generate itemised quotes from photos. You
              acknowledge:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                AI-generated quotes are <strong>estimates and suggestions only</strong>, not professional
                assessments
              </li>
              <li>
                AI may make <strong>errors</strong> in material identification, quantity estimation, or
                pricing
              </li>
              <li>
                You are <strong>solely responsible</strong> for reviewing, validating, and correcting AI
                drafts before sending to customers
              </li>
              <li>
                QuotingAgent does <strong>not guarantee</strong> ≥ 80% accuracy or any specific quality level
              </li>
              <li>
                If AI accuracy falls below your expectations, you can use the app to manually edit line
                items or abandon the tool
              </li>
            </ul>
            <p className="text-sm text-gray-600 mt-4">
              <strong>Your liability to customers remains unchanged.</strong> If you send an inaccurate
              quote, you are liable to the customer, not QuotingAgent.
            </p>
          </section>

          {/* Section 7: Payment Terms */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Payment & Subscription</h2>
            <p>
              <strong>7.1 Pricing:</strong> QuotingAgent is offered on a subscription basis (A$99/month per
              crew) or a commission basis (3% of quote value). Pricing is in AUD and excludes GST (which
              will be added at checkout if applicable).
            </p>
            <p className="mt-4">
              <strong>7.2 Free Trial:</strong> New users receive a 14-day free trial with 5 free quotes. No
              credit card is required for the trial.
            </p>
            <p className="mt-4">
              <strong>7.3 Billing:</strong> Subscription charges are billed monthly via Stripe. You may
              switch between subscription and commission pricing, or cancel at any time (changes take effect
              at the start of the next billing cycle).
            </p>
            <p className="mt-4">
              <strong>7.4 Refunds:</strong> We do not offer refunds for subscription fees. However, if a
              billing error occurs, contact us at{" "}
              <a href="mailto:billing@quotingagent.io" className="text-orange-600 hover:underline">
                billing@quotingagent.io
              </a>{" "}
              within 30 days and we will review.
            </p>
            <p className="mt-4">
              <strong>7.5 Late Payment:</strong> If payment fails, we will retry up to 3 times. If all
              retries fail, your account will be suspended until payment is resolved.
            </p>
            <p className="mt-4">
              <strong>7.6 Stripe Processor:</strong> Payment is processed by Stripe. By entering payment
              information, you authorize Stripe to charge your card. We do not store your card details.
            </p>
          </section>

          {/* Section 8: Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p>
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY AUSTRALIAN LAW:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                QuotingAgent is provided "as is" and "as available" without warranty of any kind
                (express, implied, or statutory)
              </li>
              <li>
                We do not warrant that the Service will be uninterrupted, error-free, or meet your specific
                needs
              </li>
              <li>
                We are not liable for indirect, incidental, consequential, special, or punitive damages
                arising from your use of the Service
              </li>
              <li>
                Our total liability is capped at the amount you paid us in the 12 months preceding the
                claim (or A$100, whichever is greater)
              </li>
              <li>
                We are not liable for losses arising from incorrect AI quotes, lost business, lost data, or
                third-party actions
              </li>
            </ul>
            <p className="text-sm text-gray-600 mt-4">
              These limitations do not apply to liability that cannot be excluded under the Australian
              Consumer Law.
            </p>
          </section>

          {/* Section 9: Indemnity */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Indemnity</h2>
            <p>
              You agree to indemnify, defend, and hold harmless QuotingAgent from any claims, damages, or
              costs (including legal fees) arising from:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Your use of the Service in violation of these Terms</li>
              <li>Your quotes to customers (accuracy, legality, statutory warranty)</li>
              <li>Your collection and handling of customer data</li>
              <li>Your conduct or violations of law</li>
            </ul>
          </section>

          {/* Section 10: Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Dispute Resolution & Governing Law</h2>
            <p>
              <strong>10.1 Governing Law:</strong> These Terms are governed by the laws of New South Wales,
              Australia, and you submit to the exclusive jurisdiction of the NSW District Court.
            </p>
            <p className="mt-4">
              <strong>10.2 Informal Resolution:</strong> If you have a dispute, email us at{" "}
              <a href="mailto:support@quotingagent.io" className="text-orange-600 hover:underline">
                support@quotingagent.io
              </a>{" "}
              and we will attempt to resolve it within 30 days.
            </p>
            <p className="mt-4">
              <strong>10.3 Arbitration:</strong> If informal resolution fails, disputes may be resolved via
              binding arbitration under the Australian Disputes Centre rules, before proceeding to court.
            </p>
          </section>

          {/* Section 11: Termination */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p>
              <strong>11.1 Termination by You:</strong> You may terminate your account at any time via the
              app settings. Your account will be soft-deleted (hidden) immediately and hard-deleted after 30
              days.
            </p>
            <p className="mt-4">
              <strong>11.2 Termination by Us:</strong> We may suspend or terminate your account immediately
              if:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>You violate these Terms or the Acceptable Use Policy</li>
              <li>Your NSW Contractor Licence is suspended, cancelled, or invalid</li>
              <li>You engage in fraud, illegal activity, or abuse</li>
              <li>We receive valid legal process or court order requiring termination</li>
            </ul>
            <p className="mt-4">
              <strong>11.3 Data After Termination:</strong> Upon termination, your account and data
              (quotes, leads, photos) will be retained for 30 days (to allow recovery), then permanently
              deleted. You may export your data before deletion.
            </p>
          </section>

          {/* Section 12: Service Availability */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Service Availability & Performance</h2>
            <p>
              We do not guarantee 100% uptime. At the preview tier, we target ≥ 99% monthly availability.
              Scheduled maintenance may require brief downtime (typically ≤ 1 hour, announced in advance).
            </p>
            <p className="mt-4">
              AI quote generation may be delayed (up to 60 seconds) due to API latency. If delays exceed 60
              seconds, you will receive a notification and can retry.
            </p>
            <p className="mt-4">
              SMS delivery is subject to carrier availability (Telstra, Optus, Vodafone). If SMS fails, we
              will automatically fall back to email. You acknowledge that SMS is not guaranteed delivery and
              recommend having email as a backup method.
            </p>
          </section>

          {/* Section 13: Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Third-Party Integrations & Links</h2>
            <p>
              QuotingAgent integrates with third-party services (Stripe, Twilio, Anthropic, ServiceM8,
              Tradify). You acknowledge:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                We are not responsible for third-party services, their availability, or their terms of
                service
              </li>
              <li>
                Your use of OAuth integrations (ServiceM8, Tradify) is governed by their terms, not ours
              </li>
              <li>
                Payment via Stripe is governed by Stripe's terms and{" "}
                <a
                  href="https://stripe.com/ssa"
                  className="text-orange-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Stripe Connected Account Agreement
                </a>
              </li>
              <li>
                We may update or remove integrations at any time without liability
              </li>
            </ul>
          </section>

          {/* Section 14: Limitation on Your Use */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Rate Limits & Usage Restrictions</h2>
            <p>
              To prevent abuse, we enforce rate limits on API endpoints:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Quote generation: 100 per day per crew</li>
              <li>Manual lead entry: 200 per day per crew</li>
              <li>OTP send: 5 per hour per phone number</li>
            </ul>
            <p className="mt-4">
              If you exceed these limits, your requests will be temporarily blocked. Contact us if you need
              higher limits for legitimate business use.
            </p>
          </section>

          {/* Section 15: Changes to Service */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Changes to the Service</h2>
            <p>
              We may update, modify, or discontinue features of QuotingAgent at any time. We will make
              reasonable efforts to notify you of material changes (such as removal of SMS or AI features)
              via in-app notification or email.
            </p>
          </section>

          {/* Section 16: Contact & Support */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">16. Contact Us</h2>
            <div className="bg-gray-100 p-4 rounded-lg">
              <p>
                <strong>Support:</strong>{" "}
                <a href="mailto:support@quotingagent.io" className="text-orange-600 hover:underline">
                  support@quotingagent.io
                </a>
              </p>
              <p className="mt-2">
                <strong>Billing:</strong>{" "}
                <a href="mailto:billing@quotingagent.io" className="text-orange-600 hover:underline">
                  billing@quotingagent.io
                </a>
              </p>
              <p className="mt-2">
                <strong>Legal:</strong>{" "}
                <a href="mailto:legal@quotingagent.io" className="text-orange-600 hover:underline">
                  legal@quotingagent.io
                </a>
              </p>
            </div>
          </section>

          {/* Disclaimer */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
            <p className="text-sm">
              <strong>Disclaimer:</strong> These Terms of Service are a template based on best practices for
              Australian B2B SaaS and should be reviewed by a qualified Australian lawyer before launch. If
              there is any conflict between these terms and legal requirements, the legal requirements will
              prevail.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
