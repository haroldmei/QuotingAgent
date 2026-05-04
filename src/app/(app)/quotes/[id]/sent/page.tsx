"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layouts/TopBar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatAUD, formatTime, cn } from "@/lib/utils";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";

interface SmsEvent {
  id: string;
  event_type: "sent" | "delivered" | "failed" | "opened";
  occurred_at: string;
}

interface QuoteLineItem {
  id: string;
  kind: "material" | "labour" | "other";
  description: string;
  qty: string | number;
  unit: string;
  unit_price_aud: string | number;
  confidence_score: number;
}

interface QuoteWithEvents {
  id: string;
  lead_id: string;
  status: string;
  total_aud: string | null;
  subtotal_aud: string | null;
  gst_aud?: string | null;
  licence_number_snapshot?: string | null;
  statutory_warranty_text?: string | null;
  sms_events: SmsEvent[];
  sms_disabled_followup?: boolean;
  lead?: {
    customer_name: string;
    customer_mobile: string | null;
    sms_disabled_followup: boolean;
  };
  quote_line_items?: QuoteLineItem[];
}

// ---------------------------------------------------------------------------
// Status timeline events
// ---------------------------------------------------------------------------
const TIMELINE_STEPS: Array<{
  event: SmsEvent["event_type"];
  label: string;
}> = [
  { event: "sent", label: "Sent" },
  { event: "delivered", label: "Delivered" },
  { event: "opened", label: "Opened" },
];

// ---------------------------------------------------------------------------
// Screen 11 — Quote Sent + Read Receipt
// ---------------------------------------------------------------------------
export default function QuoteSentPage() {
  const params = useParams<{ id: string }>();
  const quoteId = params.id;
  const { addToast } = useToast();

  const [quote, setQuote] = React.useState<QuoteWithEvents | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [followupEnabled, setFollowupEnabled] = React.useState(true);
  const [toggling, setToggling] = React.useState(false);

  async function loadQuote() {
    const res = await fetch(`/api/quotes/${quoteId}`);
    if (!res.ok) return;
    const data: QuoteWithEvents = await res.json();
    setQuote(data);
    setFollowupEnabled(!data.lead?.sms_disabled_followup);
    setLoading(false);
  }

  React.useEffect(() => {
    loadQuote();
    // Poll for status updates (read receipts may arrive via webhook)
    const poll = setInterval(loadQuote, 5000);
    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  async function toggleFollowup() {
    if (!quote?.lead_id) return;
    setToggling(true);
    const newValue = !followupEnabled;
    const res = await fetch(`/api/leads/${quote.lead_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sms_disabled_followup: !newValue }),
    });
    if (res.ok) {
      setFollowupEnabled(newValue);
      addToast(
        newValue ? "Auto follow-up enabled" : "Auto follow-up disabled",
        "info"
      );
    }
    setToggling(false);
  }

  const smsEvents = quote?.sms_events ?? [];

  function getEventTime(eventType: SmsEvent["event_type"]): string | null {
    const evt = smsEvents
      .filter((e) => e.event_type === eventType)
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
      )[0];
    return evt ? formatTime(evt.occurred_at) : null;
  }

  const materialCount = quote?.quote_line_items?.filter((li) => li.kind === "material").length ?? 0;
  const labourCount = quote?.quote_line_items?.filter((li) => li.kind === "labour").length ?? 0;
  const total = quote?.total_aud ?? quote?.subtotal_aud ?? "0";

  if (loading) {
    return (
      <>
        <TopBar backHref="/leads" title="Quote Sent" />
        <div className="px-4 py-4 flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        backHref="/leads"
        backLabel="Back to leads"
        title={quote?.lead?.customer_name ?? "Quote Sent"}
      />

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Status timeline */}
        <div
          className="rounded-md border border-slate-200 bg-white p-4"
          aria-label="Quote delivery status"
          aria-live="polite"
        >
          {TIMELINE_STEPS.map(({ event, label }) => {
            const time = getEventTime(event);
            const isDone = !!time;
            return (
              <div
                key={event}
                className="flex items-center gap-3 py-1.5"
              >
                {isDone ? (
                  <CheckCircle2
                    className="h-5 w-5 text-[#F97316] flex-shrink-0"
                    aria-hidden
                  />
                ) : (
                  <Circle
                    className="h-5 w-5 text-slate-300 flex-shrink-0"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "flex-1 text-sm font-medium",
                    isDone ? "text-slate-800" : "text-slate-400"
                  )}
                >
                  {label}
                </span>
                {time && (
                  <span className="text-xs text-slate-400">{time}</span>
                )}
                {!time && (
                  <span className="text-xs text-slate-300">——</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Quote total + line item breakdown */}
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-slate-900">
            {formatAUD(total)}{" "}
            <span className="text-sm font-normal text-slate-500">inc. GST</span>
          </p>
          {(materialCount > 0 || labourCount > 0) && (
            <p className="text-sm text-slate-500 mt-1">
              {materialCount > 0 && `${materialCount} material${materialCount === 1 ? "" : "s"}`}
              {materialCount > 0 && labourCount > 0 && " + "}
              {labourCount > 0 && `${labourCount} labour item${labourCount === 1 ? "" : "s"}`}
            </p>
          )}
          {quote?.quote_line_items && quote.quote_line_items.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-3">
              {quote.quote_line_items.map((li) => {
                const lineTotal =
                  Number(li.qty) * Number(li.unit_price_aud);
                return (
                  <li
                    key={li.id}
                    className="flex items-start justify-between gap-2 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-800">{li.description}</p>
                      <p className="text-xs text-slate-500">
                        {Number(li.qty).toLocaleString()} {li.unit} @ {formatAUD(li.unit_price_aud)}
                      </p>
                    </div>
                    <p className="font-medium text-slate-900 whitespace-nowrap">
                      {formatAUD(lineTotal)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          {quote?.licence_number_snapshot && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">
                NSW contractor licence{" "}
                <span className="font-medium text-slate-700">
                  {quote.licence_number_snapshot}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Statutory warranty wording */}
        {quote?.statutory_warranty_text && (
          <details className="rounded-md border border-slate-200 bg-white p-4 text-sm">
            <summary className="cursor-pointer font-medium text-slate-800">
              NSW Home Building Act statutory warranty
            </summary>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-xs text-slate-600">
              {quote.statutory_warranty_text}
            </pre>
          </details>
        )}

        {/* Auto follow-up toggle */}
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800">Auto follow-up</p>
              <p className="text-xs text-slate-500 mt-0.5">Nudge at D+3, D+7</p>
            </div>
            <button
              role="switch"
              aria-checked={followupEnabled}
              aria-label="Toggle auto follow-up SMS"
              onClick={toggleFollowup}
              disabled={toggling}
              className={cn(
                "relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                followupEnabled ? "bg-[#F97316]" : "bg-slate-200",
                "focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition-transform",
                  followupEnabled ? "translate-x-5" : "translate-x-0"
                )}
                aria-hidden
              />
            </button>
          </div>
        </div>

        {/* Resend */}
        <Button
          variant="ghost"
          size="md"
          onClick={() => addToast("Resend flow coming soon", "info")}
          className="gap-2 text-slate-600"
          aria-label="Resend quote or change customer number"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Resend / change number
        </Button>
      </div>
    </>
  );
}
