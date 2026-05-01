import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — QuotingAgent",
  description: "Rules and guidelines for using QuotingAgent responsibly.",
  robots: { index: true, follow: true },
};

export default function AcceptableUsePolicy() {
  return (
    <div className="min-h-screen bg-white">
      <article className="max-w-4xl mx-auto px-4 py-12 text-gray-900">
        <header className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Acceptable Use Policy</h1>
          <p className="text-gray-600">
            Last updated: <time dateTime="2026-05-01">1 May 2026</time>
          </p>
        </header>

        <div className="prose prose-lg max-w-none space-y-8">
          {/* Introduction */}
          <section>
            <p>
              This Acceptable Use Policy ("AUP") outlines prohibited conduct and content on QuotingAgent.
              Violations may result in suspension or permanent account termination. This policy supplements
              our Terms of Service and Privacy Policy.
            </p>
          </section>

          {/* Section 1: Prohibited Conduct */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Prohibited Conduct</h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">1.1 Fraud & Misrepresentation</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sending quotes with a false or invalid NSW Contractor Licence number</li>
              <li>Sending quotes on behalf of another business without authorization</li>
              <li>Forging customer signatures or falsifying acceptance records</li>
              <li>Sending quotes for work you are not licensed to perform</li>
              <li>Misrepresenting the source of AI-generated pricing (implying it is your own assessment)</li>
              <li>Invoicing customers for more than the approved quote without consent</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">1.2 Abuse & Harassment</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sending abusive, threatening, or harassing SMS messages to customers</li>
              <li>Discriminating against customers based on race, gender, religion, age, disability, or
              sexual orientation</li>
              <li>Sending unsolicited bulk SMS to customers (spam)</li>
              <li>Retaliating against customers who decline your quote with further unwanted messages</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">1.3 Warranty & Compliance Violations</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sending quotes for residential work ≥ A$5K without the statutory warranty wording
              (NSW Home Building Act 1989)</li>
              <li>Removing or altering the statutory warranty text before sending</li>
              <li>Failing to retain the quote acceptance record (required for 7 years)</li>
              <li>Not complying with your own licence conditions or Fair Trading obligations</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">1.4 System Abuse</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Attempting to bypass rate limits (e.g., creating multiple accounts to generate &gt;100
              quotes/day)</li>
              <li>Attempting to access other crews' data or quotes</li>
              <li>Scraping the platform, automating access, or using bots</li>
              <li>Attacking or probing the platform for vulnerabilities (without authorization)</li>
              <li>Uploading malware or malicious files</li>
              <li>Interfering with the service's operation or infrastructure</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">1.5 Illegal Activity</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Using the platform to facilitate any illegal conduct (e.g., money laundering, fraud,
              unlicensed trading)</li>
              <li>Sending quotes that breach trade practice laws, pricing regulations, or consumer
              protection laws</li>
              <li>Violating any Australian federal, state, or local law</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">1.6 Data Privacy Violations</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sharing customer phone numbers, addresses, or data with unauthorized third parties</li>
              <li>Collecting customer data for purposes beyond quote delivery (e.g., marketing to
              competitors)</li>
              <li>Failing to respect customer privacy settings (e.g., sending SMS when opted-out)</li>
            </ul>
          </section>

          {/* Section 2: Prohibited Content */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Prohibited Content</h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Uploads (Photos, Descriptions, Messages)</h3>
            <p>You agree not to upload, send, or display:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Illegal, obscene, defamatory, or hateful content</li>
              <li>Sexually explicit, violent, or gore imagery</li>
              <li>Content that infringes another person's intellectual property, privacy, or rights</li>
              <li>Malware, viruses, or code intended to harm systems or users</li>
              <li>Personal data of others (names, phone numbers, addresses) in unrelated contexts</li>
              <li>Images of identifiable individuals without consent (other than customers on quotes)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">2.2 SMS & Customer Messages</h3>
            <p>Quote SMS messages to customers must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Be professional and respectful in tone</li>
              <li>Contain only legitimate business information (quote link, brief message)</li>
              <li>Not include links to malicious or phishing websites</li>
              <li>Comply with Australian Marketing Code of Conduct (e.g., include opt-out)</li>
            </ul>
          </section>

          {/* Section 3: Enforcement & Actions */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Enforcement Actions</h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Progressive Enforcement</h3>
            <p>
              In most cases, we follow a progressive approach:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-4">
              <li>
                <strong>Warning:</strong> For first-time minor violations (e.g., one spam quote), we may
                contact you and request corrective action.
              </li>
              <li>
                <strong>Suspension:</strong> For repeated or serious violations, we may temporarily suspend
                your account (7–30 days) and block quote generation.
              </li>
              <li>
                <strong>Permanent Termination:</strong> For severe violations (fraud, illegal activity) or
                repeated suspension, we may permanently delete your account and data, and refer you to
                authorities if appropriate.
              </li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Immediate Termination</h3>
            <p>
              We may immediately suspend or terminate your account without warning if:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>You engage in fraud or send fraudulent quotes</li>
              <li>You access or attempt to access other crews' data</li>
              <li>You upload malware or attack the platform</li>
              <li>You violate criminal law or engage in sexual exploitation</li>
              <li>Your NSW Contractor Licence is suspended or cancelled</li>
              <li>We receive a valid legal order to suspend your account</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">3.3 No Restoration</h3>
            <p>
              We do not restore permanently terminated accounts. Any data associated with a terminated
              account is permanently deleted after 30 days.
            </p>
          </section>

          {/* Section 4: Monitoring & Reporting */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Monitoring & Reporting Violations</h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Automated Monitoring</h3>
            <p>
              We use automated systems to monitor for:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>Licence number mismatches (number does not match Service NSW records)</li>
              <li>Repeated OTP attempts (brute force)</li>
              <li>Rate limit violations (&gt;100 quotes/day per crew)</li>
              <li>SMS delivery failures and bounces</li>
              <li>Error patterns indicating system abuse</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.2 How to Report Violations</h3>
            <p>
              If you witness a violation, report it to:
            </p>
            <div className="bg-gray-100 p-4 rounded-lg mt-4">
              <a href="mailto:abuse@quotingagent.io" className="text-orange-600 hover:underline">
                abuse@quotingagent.io
              </a>
              <p className="text-sm text-gray-600 mt-2">
                Please provide: account email/phone, description of violation, and evidence (screenshot,
                quote ID, timestamp).
              </p>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">4.3 Response Timeframe</h3>
            <p>
              We investigate reports within 5 business days and take appropriate action. We may not disclose
              the outcome due to privacy reasons.
            </p>
          </section>

          {/* Section 5: License-Specific Obligations */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">5. NSW Contractor Licence Obligations</h2>

            <p>
              When you use QuotingAgent to send quotes for residential work ≥ A$5,000, you must comply with
              the NSW Fair Trading Act 1987 and NSW Home Building Act 1989:
            </p>

            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li>
                <strong>Licence Display:</strong> Your licence number must be displayed on every quote. We
                enforce this automatically.
              </li>
              <li>
                <strong>Statutory Warranty:</strong> You must include the statutory warranty wording
                (prescribed by the NSW Home Building Act). We include this automatically, and you may not
                alter it.
              </li>
              <li>
                <strong>Accuracy:</strong> Quotes must be honest, fair, and not unconscionable. AI-generated
                quotes are estimates; you must verify them against your costs and rates before sending.
              </li>
              <li>
                <strong>Cooling-Off Period:</strong> If required by law, you must inform customers of their
                right to cancel within 5 business days.
              </li>
              <li>
                <strong>Record Retention:</strong> You must retain quote acceptance records for at least 7
                years. We retain these for you automatically.
              </li>
            </ul>

            <p className="text-sm text-gray-600 mt-4">
              <strong>Your Responsibility:</strong> While we provide tools to help you comply, you remain
              solely responsible for ensuring your quotes and conduct comply with NSW Fair Trading law. We
              recommend consulting a legal advisor if you are unsure.
            </p>
          </section>

          {/* Section 6: Appeals */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Appeals & Dispute Resolution</h2>

            <p>
              If you believe your account was suspended or terminated in error, you may appeal:
            </p>

            <ol className="list-decimal pl-6 space-y-2 mt-4">
              <li>
                Email{" "}
                <a href="mailto:legal@quotingagent.io" className="text-orange-600 hover:underline">
                  legal@quotingagent.io
                </a>{" "}
                with the subject "AUP Appeal" within 30 days of suspension/termination.
              </li>
              <li>Provide your account details and explain why you believe the action was unjustified.</li>
              <li>We will review and respond within 10 business days.</li>
              <li>
                If you remain unsatisfied, you may escalate to formal dispute resolution (see Terms of
                Service §10).
              </li>
            </ol>

            <p className="text-sm text-gray-600 mt-4">
              Permanent terminations for fraud, illegal activity, or security breaches are final and not
              subject to appeal.
            </p>
          </section>

          {/* Section 7: Changes */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Changes to This Policy</h2>

            <p>
              We may update this AUP to reflect changes in our enforcement practices, legal requirements, or
              user feedback. We will notify you of material changes via in-app notification or email. Your
              continued use of QuotingAgent constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* Section 8: Contact */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>

            <div className="bg-gray-100 p-4 rounded-lg space-y-2">
              <p>
                <strong>Report Violations:</strong>{" "}
                <a href="mailto:abuse@quotingagent.io" className="text-orange-600 hover:underline">
                  abuse@quotingagent.io
                </a>
              </p>
              <p>
                <strong>Appeal Suspension:</strong>{" "}
                <a href="mailto:legal@quotingagent.io" className="text-orange-600 hover:underline">
                  legal@quotingagent.io
                </a>
              </p>
              <p>
                <strong>General Support:</strong>{" "}
                <a href="mailto:support@quotingagent.io" className="text-orange-600 hover:underline">
                  support@quotingagent.io
                </a>
              </p>
            </div>
          </section>

          {/* Disclaimer */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-8">
            <p className="text-sm">
              <strong>Disclaimer:</strong> This Acceptable Use Policy is a template based on industry best
              practices and should be reviewed by a qualified Australian lawyer before launch.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
