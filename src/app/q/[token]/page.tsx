import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CustomerQuoteView } from "./CustomerQuoteView";
import { ToastProvider } from "@/components/ui/toast";

// ---------------------------------------------------------------------------
// Screen 13 — Public Customer Quote View (no auth, signed URL)
// Stack contract: FR-020, server component + signed token from URL path
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata(_props: PageProps): Promise<Metadata> {
  // Minimal metadata for public page — token not needed for title
  return {
    title: "Your Quote — QuotingAgent",
    description: "View and accept your trade quote.",
    robots: { index: false, follow: false },
  };
}

export default async function CustomerQuotePage({ params }: PageProps) {
  const { token } = await params;

  // Fetch quote via the backend route (validates the HMAC signed token)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(token)}/view`, {
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 401 || res.status === 410) {
    notFound();
  }

  if (!res.ok) {
    throw new Error("Failed to load quote");
  }

  const quote = await res.json();

  const isAccepted = quote.status === "accepted";
  const isDeclined = quote.status === "declined";

  return (
    <ToastProvider>
      <main id="main" className="min-h-screen bg-slate-50">
        {/* Slim header — no auth nav */}
        <header className="bg-white border-b border-slate-200 px-4 py-3">
          <span className="text-lg font-bold text-[#F97316]">QuotingAgent</span>
        </header>

        {/* Tracking pixel — read receipt via GET (FR-018) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/webhooks/twilio/read?t=${encodeURIComponent(token)}`}
          alt=""
          width={1}
          height={1}
          className="sr-only"
          aria-hidden
        />

        <div className="px-4 py-4 max-w-lg mx-auto">
          <CustomerQuoteView
            quote={quote}
            token={token}
            isAccepted={isAccepted}
            isDeclined={isDeclined}
          />
        </div>
      </main>
    </ToastProvider>
  );
}
