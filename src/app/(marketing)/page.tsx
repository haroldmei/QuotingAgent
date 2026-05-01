import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/db/supabase-server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Structured data
// ---------------------------------------------------------------------------
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "QuotingAgent",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: [
        {
          "@type": "Offer",
          name: "Solo",
          price: "0",
          priceCurrency: "AUD",
          description: "A$0/month + 3% per won job. First 5 quotes free.",
        },
        {
          "@type": "Offer",
          name: "Crew",
          price: "99",
          priceCurrency: "AUD",
          description:
            "A$99/month per crew. 100 AI quotes/month, up to 5 users.",
        },
        {
          "@type": "Offer",
          name: "Multi-Crew",
          price: "199",
          priceCurrency: "AUD",
          description:
            "A$199/month. 400 AI quotes/month, up to 20 users, multi-crew dashboard.",
        },
      ],
      description:
        "Turn site photos into Bunnings-priced, NSW-compliant quotes delivered by SMS in under 5 minutes. For Western Sydney residential trades.",
      url: "https://quoting.app",
      featureList: [
        "Photo to AI quote in under 60 seconds",
        "Bunnings live pricing",
        "NSW contractor licence binding",
        "SMS delivery with read receipt",
        "ServiceM8 and Tradify sync",
        "First 5 quotes free",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: 'What counts as a "quote generation"?',
          acceptedAnswer: {
            "@type": "Answer",
            text: 'Each time you tap "Generate quote" on a lead — whether you send it or not. Editing a draft after it\'s generated doesn\'t use another generation.',
          },
        },
        {
          "@type": "Question",
          name: "What happens when I hit 100 quote generations?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Additional generations cost A$1.50 each, or upgrade to Multi-Crew for A$199/mo with 400 included.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a contract?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Month-to-month. Cancel in-app any time, no support ticket needed. Your data is kept for 90 days.",
          },
        },
        {
          "@type": "Question",
          name: "Does the price include GST?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. All prices shown include 10% GST.",
          },
        },
        {
          "@type": "Question",
          name: "What if I run multiple crews?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Crew plan covers one crew (up to 5 users). For 2–4 crews, Multi-Crew at A$199/mo is cheaper than two Crew subscriptions.",
          },
        },
        {
          "@type": "Question",
          name: "Does it work outside NSW?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Not yet. V1 is NSW-only — the NSW contractor licence binding and statutory warranty wording is NSW-specific. Victoria and Queensland are coming in V2.",
          },
        },
        {
          "@type": "Question",
          name: "Do I need to keep using ServiceM8 or Tradify?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, and that's the point. QuotingAgent does one thing: get your quote on the customer's phone in 5 minutes. ServiceM8 and Tradify handle everything else. On the Crew plan, won quotes sync automatically to your FSM — no double-entry.",
          },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Feature block data (from docs/17-positioning.md §6)
// ---------------------------------------------------------------------------
const FEATURES = [
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
        aria-hidden
      >
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    label: "Photo → AI quote in 60 seconds",
    today:
      "With Tradify or a Word template, you look up Bunnings prices, type every material line item, and guess your labour — at home, after dinner, 2–4 hours per quote.",
    withUs:
      'Snap 4–10 site photos, type one sentence (“re-roof, colorbond, single-storey”), and get a fully itemised, Bunnings-priced, labour-rated draft in under 60 seconds — while you’re still in the ute.',
    detail:
      "Current Bunnings live prices for materials, your own labour rates, the 10% GST line, and your NSW contractor licence number — automatically, on every quote.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
        aria-hidden
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: "NSW-compliant by default, every time",
    today:
      "Manually copying your licence number into each quote — or forgetting, and risking an NSW Fair Trading warning (fines up to A$110,000 for unlicensed work quotes over A$5K).",
    withUs:
      "Your NSW contractor licence number and the mandatory Home Building Act statutory warranty wording are stamped on every quote before it leaves your phone — verified against Service NSW at onboarding, never forgotten.",
    detail:
      "The compliance floor that Tradify, ServiceM8, and every US AI quoting tool skip. We make it invisible and automatic.",
  },
  {
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
        aria-hidden
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    label: "SMS-sent, one-tap accepted",
    today:
      "Email the PDF, wait 48–72 hours, follow up manually, lose the job to the tradie who quoted on Tuesday while you were waiting for a reply.",
    withUs:
      "The approved quote goes out as an SMS with a tap-link — your customer reads it on their phone within minutes and can accept with one tap. You get a push notification when they open it and another when they accept.",
    detail:
      "Auto-follow-up SMS nudges fire at D+3 and D+7 for any lead that hasn't responded — so no job goes cold while you're busy on the tools.",
  },
];

// ---------------------------------------------------------------------------
// Pricing tiers (from docs/16-pricing.md §3 + §7)
// ---------------------------------------------------------------------------
const TIERS = [
  {
    name: "Solo",
    price: "A$0",
    period: "/mo + 3% per won job",
    tagline: "For sole traders quoting 1–3 jobs a month.",
    cta: "Get started — no credit card",
    ctaHref: "/onboarding",
    popular: false,
    features: [
      "Full photo → SMS quote workflow",
      "AI-generated, Bunnings-priced, NSW-licence-bound",
      "5 quotes free, then 3% of every job you win",
      "1 user · SMS at A$0.10 each · Manual lead entry",
    ],
  },
  {
    name: "Crew",
    price: "A$99",
    period: "/mo per crew",
    annualNote: "or A$82/mo billed annually (2 months free)",
    tagline: "For 1–10 staff crews quoting 4–40 jobs a month.",
    cta: "Start free — 5 quotes, no card",
    ctaHref: "/onboarding",
    popular: true,
    features: [
      "100 AI quote generations/month",
      "Up to 5 team members",
      "DA lead auto-tray (connect your DA aggregator)",
      "ServiceM8 + Tradify sync — won quote → job, automatically",
      "Rate-card learning from your own won jobs",
      "Auto follow-up SMS at D+3 and D+7",
      "Logo + colour branding on quotes",
      "200 SMS/month included",
      "Basic analytics dashboard",
      "Priority email support",
    ],
  },
  {
    name: "Multi-Crew",
    price: "A$199",
    period: "/mo",
    annualNote: "or A$165/mo billed annually (2 months free)",
    tagline: "For growing operators running multiple crews.",
    cta: "Talk to us",
    ctaHref: "/onboarding",
    popular: false,
    features: [
      "400 AI quote generations/month",
      "Up to 20 team members",
      "Per-crew rate card isolation",
      "Multi-crew pipeline dashboard",
      "AroFlo integration",
      "CSV data export",
      "500 SMS/month included",
      "Phone support (AEST business hours)",
      "1-hour onboarding call",
    ],
  },
];

// ---------------------------------------------------------------------------
// FAQ items (from docs/16-pricing.md §7.6 + extras)
// ---------------------------------------------------------------------------
const FAQS = [
  {
    q: 'What counts as a "quote generation"?',
    a: 'Each time you tap "Generate quote" on a lead — whether you send it or not. Editing a draft after it\'s generated doesn\'t use another generation.',
  },
  {
    q: "What happens when I hit 100 quote generations?",
    a: "Additional generations cost A$1.50 each, or upgrade to Multi-Crew for A$199/mo with 400 included.",
  },
  {
    q: "Is there a contract?",
    a: "No. Month-to-month. Cancel in-app any time, no support ticket needed. Your data is kept for 90 days after cancellation.",
  },
  {
    q: "Does the price include GST?",
    a: "Yes. All prices shown include 10% GST.",
  },
  {
    q: "What if I run multiple crews?",
    a: "The Crew plan covers one crew (up to 5 users). For 2–4 crews, Multi-Crew at A$199/mo is cheaper than two Crew subscriptions.",
  },
  {
    q: "Does it work outside NSW?",
    a: "Not yet. V1 is NSW-only — the NSW contractor licence binding and statutory warranty wording is state-specific. Victoria and Queensland are coming in V2.",
  },
  {
    q: "Do I need to keep using ServiceM8 or Tradify?",
    a: "Yes — and that's the point. QuotingAgent does one thing: get your quote on the customer's phone in 5 minutes. ServiceM8 and Tradify handle everything else. On the Crew plan, won quotes sync automatically to your FSM — no double-entry.",
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function MarketingPage() {
  // Authenticated users (with a completed crew) land on /leads, not here.
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.app_metadata?.crew_id) {
      redirect("/leads");
    }
  } catch {
    // Supabase client may throw during build/static generation — continue
    // rendering the marketing page. Runtime requests will be auth-checked.
  }
  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="min-h-screen bg-white font-[Inter,ui-sans-serif,system-ui,sans-serif]">
        {/* ------------------------------------------------------------------ */}
        {/* NAV */}
        {/* ------------------------------------------------------------------ */}
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-8">
            <a href="#hero" className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]"
                aria-hidden
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </span>
              <span className="text-base font-bold text-slate-900">
                QuotingAgent
              </span>
            </a>

            <nav
              className="hidden items-center gap-6 sm:flex"
              aria-label="Main navigation"
            >
              <a
                href="#features"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                How it works
              </a>
              <a
                href="#pricing"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#faq"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                FAQ
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="secondary" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/onboarding">
                <Button size="sm">Try free</Button>
              </Link>
            </div>
          </div>
        </header>

        <main id="main">
          {/* ---------------------------------------------------------------- */}
          {/* HERO */}
          {/* ---------------------------------------------------------------- */}
          <section
            id="hero"
            aria-labelledby="hero-heading"
            className="relative overflow-hidden bg-white px-4 pb-16 pt-12 sm:px-8 sm:pb-24 sm:pt-20"
          >
            {/* Subtle orange glow */}
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              aria-hidden
            >
              <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#FFF7ED] blur-3xl opacity-60" />
              <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-[#FFEDD5] blur-3xl opacity-40" />
            </div>

            <div className="relative mx-auto max-w-3xl text-center">
              {/* Eyebrow */}
              <p className="mb-4 inline-block rounded-full border border-[#FED7AA] bg-[#FFF7ED] px-4 py-1 text-sm font-medium text-[#C2510A]">
                Fast AI quoting for Western Sydney trades
              </p>

              {/* Headline — user-confirmed */}
              <h1
                id="hero-heading"
                className="mb-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl md:text-6xl"
              >
                Your next quote done before you start the ute.
              </h1>

              {/* Sub-headline */}
              <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-600 sm:text-xl">
                Snap site photos. Get a Bunnings-priced, NSW-licensed itemised
                quote on your customer&apos;s phone in 5 minutes —{" "}
                <em>not tonight&apos;s homework.</em>
              </p>

              {/* CTAs */}
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link href="/onboarding" className="w-full sm:w-auto">
                  <Button size="lg" className="sm:w-auto">
                    Try free — no card
                  </Button>
                </Link>
                <a href="#features" className="w-full sm:w-auto">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="sm:w-auto"
                  >
                    See how it works
                  </Button>
                </a>
              </div>

              <p className="mt-4 text-sm text-slate-500">
                First 5 quotes free. No credit card. No time limit.
              </p>

              {/* Hero visual placeholder */}
              <div className="relative mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-xl">
                <div className="flex h-56 items-center justify-center sm:h-80">
                  <div className="flex flex-col items-center gap-4 px-6 text-center">
                    <div className="flex gap-4">
                      {/* "Before" phone */}
                      <div className="flex h-32 w-20 flex-col overflow-hidden rounded-xl border-2 border-slate-300 bg-white shadow-md sm:h-44 sm:w-28">
                        <div className="flex h-5 items-center justify-center bg-slate-800 sm:h-7">
                          <div className="h-1.5 w-8 rounded-full bg-slate-600 sm:h-2 sm:w-10" />
                        </div>
                        <div className="flex flex-1 items-center justify-center bg-slate-200">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#64748B"
                            strokeWidth={1.5}
                            className="h-10 w-10 sm:h-14 sm:w-14"
                          >
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </div>
                        <div className="flex h-6 items-center justify-center bg-slate-50 sm:h-8">
                          <span className="text-[8px] font-medium text-slate-600 sm:text-[10px]">
                            Site photo
                          </span>
                        </div>
                      </div>

                      {/* Timing arrow */}
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="rounded-full bg-[#F97316] px-2 py-0.5 text-[9px] font-bold text-white sm:px-3 sm:text-xs">
                          4 min 38 sec
                        </span>
                        <svg
                          viewBox="0 0 40 16"
                          fill="none"
                          className="w-10 sm:w-14"
                        >
                          <path
                            d="M2 8h32M28 3l6 5-6 5"
                            stroke="#F97316"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      {/* "After" phone */}
                      <div className="flex h-32 w-20 flex-col overflow-hidden rounded-xl border-2 border-[#F97316] bg-white shadow-md sm:h-44 sm:w-28">
                        <div className="flex h-5 items-center justify-center bg-slate-800 sm:h-7">
                          <div className="h-1.5 w-8 rounded-full bg-slate-600 sm:h-2 sm:w-10" />
                        </div>
                        <div className="flex flex-1 flex-col items-start justify-start gap-1 bg-white p-2 sm:gap-2 sm:p-3">
                          <div className="h-1.5 w-14 rounded-full bg-[#FFEDD5] sm:h-2 sm:w-20" />
                          <div className="h-1.5 w-10 rounded-full bg-slate-200 sm:h-2 sm:w-16" />
                          <div className="h-1.5 w-12 rounded-full bg-slate-200 sm:h-2 sm:w-18" />
                          <div className="mt-1 h-5 w-full rounded bg-[#F97316] sm:mt-2 sm:h-7" />
                        </div>
                        <div className="flex h-6 items-center justify-center bg-[#FFF7ED] sm:h-8">
                          <span className="text-[8px] font-medium text-[#C2510A] sm:text-[10px]">
                            Quote delivered
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* SOCIAL PROOF */}
          {/* ---------------------------------------------------------------- */}
          <section
            aria-labelledby="social-proof-heading"
            className="border-y border-slate-200 bg-slate-50 px-4 py-8 sm:px-8"
          >
            <div className="mx-auto max-w-4xl">
              <p
                id="social-proof-heading"
                className="mb-6 text-center text-sm font-medium uppercase tracking-wider text-slate-500"
              >
                Built for the Western Sydney trades community
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12">
                {/* NSW Master Builders Association placeholder */}
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    NSW Master Builders
                  </span>
                </div>

                {/* Service NSW */}
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F97316]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    Service NSW verified
                  </span>
                </div>

                {/* Bunnings */}
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-700">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    Bunnings live prices
                  </span>
                </div>

                {/* AU GST */}
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth={2}
                      className="h-4 w-4"
                    >
                      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-700">
                    AU GST incl. always
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* FEATURES */}
          {/* ---------------------------------------------------------------- */}
          <section
            id="features"
            aria-labelledby="features-heading"
            className="px-4 py-16 sm:px-8 sm:py-24"
          >
            <div className="mx-auto max-w-5xl">
              <div className="mb-12 text-center">
                <h2
                  id="features-heading"
                  className="mb-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
                >
                  How it works
                </h2>
                <p className="mx-auto max-w-xl text-base text-slate-600 sm:text-lg">
                  Three steps. Five minutes. The quote is on your customer&apos;s
                  phone before you start the ute.
                </p>
              </div>

              <div className="flex flex-col gap-8">
                {FEATURES.map((f, i) => (
                  <article
                    key={f.label}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Icon col */}
                      <div className="flex min-w-[80px] items-start justify-center bg-[#FFF7ED] p-6 sm:min-w-[100px] sm:items-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F97316] text-white shadow-md">
                          {f.icon}
                        </div>
                      </div>

                      {/* Content col */}
                      <div className="p-5 sm:p-6">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#F97316]">
                            Step {i + 1}
                          </span>
                        </div>
                        <h3 className="mb-3 text-xl font-bold text-slate-900">
                          {f.label}
                        </h3>
                        <div className="mb-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                              Today
                            </p>
                            <p className="text-sm text-slate-600">{f.today}</p>
                          </div>
                          <div className="rounded-xl bg-[#FFF7ED] p-3">
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#EA6A0A]">
                              With QuotingAgent
                            </p>
                            <p className="text-sm text-slate-700">{f.withUs}</p>
                          </div>
                        </div>
                        <p className="text-sm text-slate-500">{f.detail}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* ROI COMPARISON */}
          {/* ---------------------------------------------------------------- */}
          <section
            aria-labelledby="roi-heading"
            className="bg-slate-900 px-4 py-14 sm:px-8 sm:py-20"
          >
            <div className="mx-auto max-w-3xl text-center">
              <h2
                id="roi-heading"
                className="mb-3 text-2xl font-bold text-white sm:text-3xl"
              >
                How does A$99/month compare?
              </h2>
              <p className="mb-10 text-slate-400">
                At A$8K average job value, winning one extra job per month pays
                for 80× the subscription.
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-4 py-3 text-slate-400 font-medium" />
                      <th className="px-4 py-3 text-slate-400 font-medium">
                        Status quo
                      </th>
                      <th className="px-4 py-3 font-medium text-[#F97316]">
                        QuotingAgent Crew
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Time per quote", "2–4 hours evening", "< 5 minutes on-site"],
                      ["Quotes per week", "10", "10"],
                      [
                        "Jobs lost to slow quoting",
                        "~3/week × A$8K avg",
                        "~0",
                      ],
                      [
                        "Monthly cost",
                        "A$0 (but 24h delay kills 30% of jobs)",
                        "A$99/mo",
                      ],
                    ].map(([label, before, after]) => (
                      <tr
                        key={label}
                        className="border-b border-slate-800 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-white">
                          {label}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{before}</td>
                        <td className="px-4 py-3 font-medium text-[#FB923C]">
                          {after}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* PRICING */}
          {/* ---------------------------------------------------------------- */}
          <section
            id="pricing"
            aria-labelledby="pricing-heading"
            className="px-4 py-16 sm:px-8 sm:py-24"
          >
            <div className="mx-auto max-w-5xl">
              <div className="mb-12 text-center">
                <h2
                  id="pricing-heading"
                  className="mb-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
                >
                  Quote faster. Win more jobs.
                </h2>
                <p className="mb-2 text-lg text-slate-600">
                  From site photo to customer&apos;s phone in 5 minutes — flat
                  A$99/month per crew.
                </p>
                <p className="text-base text-slate-500">
                  No per-user fees. No contracts. Your first 5 quotes are free.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {TIERS.map((tier) => (
                  <Card
                    key={tier.name}
                    className={
                      tier.popular
                        ? "relative border-2 border-[#F97316] shadow-lg"
                        : "relative"
                    }
                  >
                    {tier.popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <Badge className="bg-[#F97316] text-white px-3 py-1 text-xs font-semibold">
                          Most popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="pb-4 pt-6">
                      <CardTitle className="text-xl">{tier.name}</CardTitle>
                      <div className="mt-1">
                        <span className="text-3xl font-extrabold text-slate-900">
                          {tier.price}
                        </span>
                        <span className="text-sm text-slate-500">
                          {tier.period}
                        </span>
                      </div>
                      {tier.annualNote && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tier.annualNote}
                        </p>
                      )}
                      <CardDescription className="mt-1">
                        {tier.tagline}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-6">
                      <Link href={tier.ctaHref}>
                        <Button
                          variant={tier.popular ? "default" : "secondary"}
                          size="lg"
                          className="mb-5"
                        >
                          {tier.cta}
                        </Button>
                      </Link>
                      <ul className="flex flex-col gap-2.5">
                        {tier.features.map((feat) => (
                          <li
                            key={feat}
                            className="flex items-start gap-2 text-sm text-slate-600"
                          >
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              className="mt-0.5 h-4 w-4 shrink-0 text-[#F97316]"
                              aria-hidden
                            >
                              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                              <path
                                d="M5 8l2 2 4-4"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Trial callout */}
              <div className="mt-10 rounded-2xl border border-[#FED7AA] bg-[#FFF7ED] p-6 text-center sm:p-8">
                <p className="mb-1 text-xl font-bold text-slate-900">
                  Your first 5 quotes are on us.
                </p>
                <p className="mx-auto max-w-lg text-base text-slate-600">
                  No credit card. No time limit. Just snap a photo, get a
                  quote, send it by SMS — and see what happens when your
                  customer gets it in 5 minutes instead of 2 days.
                </p>
              </div>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* FAQ */}
          {/* ---------------------------------------------------------------- */}
          <section
            id="faq"
            aria-labelledby="faq-heading"
            className="border-t border-slate-200 bg-slate-50 px-4 py-16 sm:px-8 sm:py-24"
          >
            <div className="mx-auto max-w-2xl">
              <h2
                id="faq-heading"
                className="mb-10 text-center text-3xl font-bold tracking-tight text-slate-900"
              >
                Common questions
              </h2>
              <dl className="flex flex-col gap-6">
                {FAQS.map((item) => (
                  <div
                    key={item.q}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <dt className="mb-2 font-semibold text-slate-900">
                      {item.q}
                    </dt>
                    <dd className="text-sm text-slate-600 leading-relaxed">
                      {item.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* CTA FOOTER */}
          {/* ---------------------------------------------------------------- */}
          <section
            aria-labelledby="cta-footer-heading"
            className="bg-[#F97316] px-4 py-16 sm:px-8 sm:py-24"
          >
            <div className="mx-auto max-w-2xl text-center">
              <h2
                id="cta-footer-heading"
                className="mb-4 text-3xl font-extrabold text-white sm:text-4xl"
              >
                Quote from the job-site, not the kitchen table at 9pm.
              </h2>
              <p className="mb-8 text-lg text-orange-100">
                Priced live from Bunnings. NSW contractor licence stamped on
                every quote. No typing.
              </p>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <Link href="/onboarding" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="bg-white text-[#F97316] hover:bg-orange-50 active:bg-orange-100 sm:w-auto"
                  >
                    Get 5 free quotes
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-sm text-orange-100">
                No credit card · No contract · Cancel any time
              </p>
            </div>
          </section>
        </main>

        {/* ------------------------------------------------------------------ */}
        {/* FOOTER */}
        {/* ------------------------------------------------------------------ */}
        <footer className="border-t border-slate-200 bg-white px-4 py-10 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              {/* Brand */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F97316]"
                    aria-hidden
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </span>
                  <span className="font-bold text-slate-900">QuotingAgent</span>
                </div>
                <p className="max-w-xs text-xs text-slate-500">
                  The fastest quote-to-win tool for Western Sydney residential
                  trades. NSW-only in V1.
                </p>
              </div>

              {/* Links */}
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Product
                  </p>
                  <ul className="flex flex-col gap-2">
                    <li>
                      <a
                        href="#features"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        How it works
                      </a>
                    </li>
                    <li>
                      <a
                        href="#pricing"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Pricing
                      </a>
                    </li>
                    <li>
                      <a
                        href="#faq"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        FAQ
                      </a>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Account
                  </p>
                  <ul className="flex flex-col gap-2">
                    <li>
                      <Link
                        href="/onboarding"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Sign up free
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/login"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Log in
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Legal
                  </p>
                  <ul className="flex flex-col gap-2">
                    <li>
                      <a
                        href="/legal/privacy"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Privacy Policy
                      </a>
                    </li>
                    <li>
                      <a
                        href="/legal/terms"
                        className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        Terms of Service
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">
                &copy; {new Date().getFullYear()} QuotingAgent. All prices
                include 10% GST. NSW residential trades only.
              </p>
              <p className="text-xs text-slate-400">
                Not affiliated with Bunnings Warehouse or Service NSW.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
