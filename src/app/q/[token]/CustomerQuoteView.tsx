"use client";

import * as React from "react";
import { formatAUD } from "@/lib/utils";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LineItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unit_price_aud: string;
  kind: string;
}

interface CustomerQuote {
  id: string;
  subtotal_aud: string;
  gst_aud: string;
  total_aud: string;
  licence_number_snapshot: string | null;
  statutory_warranty_text: string | null;
  licence_verified_snapshot: boolean | null;
  quote_line_items: LineItem[];
  lead: {
    customer_name: string;
    address: string | null;
    description: string | null;
  };
  crew: {
    business_name: string;
    trade_type: string;
  };
  prepared_at: string;
}

interface CustomerQuoteViewProps {
  quote: CustomerQuote;
  token: string;
  isAccepted?: boolean;
  isDeclined?: boolean;
}

// ---------------------------------------------------------------------------
// Screen 13 — Customer public quote view (no auth)
// ---------------------------------------------------------------------------
export function CustomerQuoteView({
  quote,
  token,
  isAccepted: initialAccepted = false,
  isDeclined: initialDeclined = false,
}: CustomerQuoteViewProps) {
  const [warrantyExpanded, setWarrantyExpanded] = React.useState(false);
  const [accepting, setAccepting] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);
  const [accepted, setAccepted] = React.useState(initialAccepted);
  const [declined, setDeclined] = React.useState(initialDeclined);
  const [error, setError] = React.useState("");

  const materialItems = quote.quote_line_items.filter((li) => li.kind === "material");
  const labourItems = quote.quote_line_items.filter((li) => li.kind === "labour");
  const otherItems = quote.quote_line_items.filter((li) => li.kind === "other");

  async function handleAccept() {
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed_token: token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to accept quote");
      }
      setAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAccepting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quote.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signed_token: token }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to decline quote");
      }
      setDeclined(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDeclining(false);
    }
  }

  if (accepted) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-4xl mb-4" aria-hidden>✅</p>
        <h2 className="text-xl font-bold text-[#14532D] mb-2">
          Quote Accepted!
        </h2>
        <p className="text-sm text-slate-600">
          {quote.crew.business_name} has been notified. They&apos;ll be in touch to arrange the work.
        </p>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-4xl mb-4" aria-hidden>👋</p>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Quote Declined
        </h2>
        <p className="text-sm text-slate-600">
          Thanks for letting {quote.crew.business_name} know.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Quote header */}
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <p className="text-lg font-semibold text-slate-800">
          Quote from {quote.crew.business_name}
        </p>
        <p className="text-sm text-slate-600 mt-0.5">
          For: {quote.lead.customer_name}
        </p>
        {quote.lead.address && (
          <p className="text-sm text-slate-500 mt-0.5">{quote.lead.address}</p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Prepared: {new Date(quote.prepared_at).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Line items */}
      <div className="rounded-md border border-slate-200 bg-white p-4">
        {materialItems.length > 0 && (
          <section aria-label="Materials">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Materials
            </h2>
            {materialItems.map((item) => {
              const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price_aud);
              return (
                <div key={item.id} className="flex justify-between py-1.5 text-sm">
                  <span className="text-slate-700 flex-1 pr-2">{item.description}</span>
                  <span className="text-slate-700 font-medium flex-shrink-0">
                    {formatAUD(lineTotal)}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {labourItems.length > 0 && (
          <section aria-label="Labour" className={materialItems.length > 0 ? "mt-3 pt-3 border-t border-slate-100" : ""}>
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
              Labour
            </h2>
            {labourItems.map((item) => {
              const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price_aud);
              return (
                <div key={item.id} className="flex justify-between py-1.5 text-sm">
                  <span className="text-slate-700 flex-1 pr-2">{item.description}</span>
                  <span className="text-slate-700 font-medium flex-shrink-0">
                    {formatAUD(lineTotal)}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {otherItems.length > 0 && (
          <section aria-label="Other" className="mt-3 pt-3 border-t border-slate-100">
            {otherItems.map((item) => {
              const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price_aud);
              return (
                <div key={item.id} className="flex justify-between py-1.5 text-sm">
                  <span className="text-slate-700 flex-1 pr-2">{item.description}</span>
                  <span className="text-slate-700 font-medium flex-shrink-0">
                    {formatAUD(lineTotal)}
                  </span>
                </div>
              );
            })}
          </section>
        )}

        {/* Totals */}
        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex justify-between text-sm text-slate-600 mb-1">
            <span>Subtotal</span>
            <span>{formatAUD(quote.subtotal_aud)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>GST (10%)</span>
            <span>{formatAUD(quote.gst_aud)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-base font-semibold text-slate-700">TOTAL</span>
            <span className="text-xl font-bold text-slate-900">
              {formatAUD(quote.total_aud)}
            </span>
          </div>
        </div>
      </div>

      {/* NSW Compliance */}
      {quote.licence_number_snapshot && (
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">NSW Contractor Licence</p>
              <p className="text-sm text-slate-600 mt-0.5">
                {quote.licence_number_snapshot}
              </p>
              {quote.licence_verified_snapshot && (
                <div className="flex items-center gap-1 mt-1 text-xs text-[#16A34A]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Verified by NSW Fair Trading
                </div>
              )}
            </div>
          </div>

          {quote.statutory_warranty_text && (
            <>
              <button
                onClick={() => setWarrantyExpanded((v) => !v)}
                aria-expanded={warrantyExpanded}
                className="flex items-center gap-1 mt-3 text-xs text-slate-500 hover:text-slate-700"
              >
                Statutory warranty wording (HBA 1989)
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", warrantyExpanded && "rotate-180")}
                  aria-hidden
                />
              </button>
              {warrantyExpanded && (
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  {quote.statutory_warranty_text}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p role="alert" className="text-sm text-[#DC2626] text-center">
          {error}
        </p>
      )}

      {/* Accept CTA — h-14 (56dp) for homeowner large finger */}
      <Button
        size="lg"
        variant="success"
        onClick={handleAccept}
        loading={accepting}
        loadingText="Accepting..."
        className="h-14 text-lg font-bold gap-2"
        aria-label="Accept this quote"
      >
        <CheckCircle2 className="h-5 w-5" aria-hidden />
        Accept Quote
      </Button>

      <Button
        variant="ghost"
        size="md"
        onClick={handleDecline}
        loading={declining}
        loadingText="Declining..."
        className="text-slate-500"
        aria-label="Decline this quote"
      >
        Decline
      </Button>

      <p className="text-xs text-slate-400 text-center pb-4">
        By accepting you agree to the terms and statutory warranty above.
      </p>
    </div>
  );
}
