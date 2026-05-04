import Link from "next/link";

/**
 * Customer-facing not-found for /q/{token}.
 *
 * Triggered when the HMAC token is invalid, expired, malformed, or the API
 * threw — anything that would otherwise surface Next's raw "Application
 * error" page. The customer here is a homeowner who has never heard of
 * QuotingAgent; the friendly fallback prevents them from thinking the SMS
 * link was a scam.
 */
export default function CustomerQuoteNotFound() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <span className="text-lg font-bold text-[#F97316]">QuotingAgent</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-3xl">
            <span aria-hidden>⏱️</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            This quote link has expired
          </h1>
          <p className="text-base text-slate-600 mb-8">
            For security, quote links are only valid for a short window. Please
            ask your tradie to send you a fresh link, or contact them directly.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl bg-[#F97316] px-6 h-12 min-h-[48px] text-white font-semibold hover:bg-[#EA6A0A]"
          >
            Visit QuotingAgent
          </Link>
          <p className="mt-8 text-xs text-slate-400">
            If you believe this is an error, please reply to the SMS your
            tradie sent or contact them directly.
          </p>
        </div>
      </div>
    </main>
  );
}
