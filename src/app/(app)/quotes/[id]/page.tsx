"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { TopBar } from "@/components/layouts/TopBar";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ConfidenceBadge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { QuoteDraftSkeleton } from "@/components/ui/skeleton";
import { GeneratingState } from "./GeneratingState";
import { EditLineItemSheet } from "./EditLineItemSheet";

import { formatAUD, computeGst, cn } from "@/lib/utils";
import { CheckCircle2, ChevronDown } from "lucide-react";
import type { LineItemKind } from "@/lib/db/database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface LineItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unit_price_aud: string;
  confidence_score: number;
  kind: LineItemKind;
  sort_order: number;
  // Track whether user has reviewed a flagged line
  userReviewed?: boolean;
}

interface Quote {
  id: string;
  lead_id: string;
  status: string;
  subtotal_aud: string | null;
  gst_aud: string | null;
  total_aud: string | null;
  licence_number_snapshot: string | null;
  licence_verified_snapshot: boolean | null;
  statutory_warranty_text: string | null;
  rate_card_source: string;
  quote_line_items: LineItem[];
}

// ---------------------------------------------------------------------------
// Quote Review Page — Screens 6, 7, 8
// ---------------------------------------------------------------------------
export default function QuoteReviewPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const quoteId = params.id;

  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editItem, setEditItem] = React.useState<LineItem | null>(null);
  const [warrantyExpanded, setWarrantyExpanded] = React.useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  async function loadQuote() {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`);
      if (res.status === 404) {
        // Try loading from lead — quote not yet created
        return;
      }
      if (!res.ok) throw new Error("Failed to load quote");
      const data: Quote = await res.json();
      setQuote(data);
      setLineItems(
        (data.quote_line_items ?? []).sort((a, b) => a.sort_order - b.sort_order)
      );
    } catch {
      // Will show in generating state or error
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadQuote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  // Derived state
  const flaggedItems = lineItems.filter((li) => li.confidence_score < 80 && !li.userReviewed);
  const allResolved = flaggedItems.length === 0;
  const subtotal = lineItems.reduce(
    (sum, li) => sum + parseFloat(li.qty) * parseFloat(li.unit_price_aud),
    0
  );
  const { gst, total } = computeGst(subtotal);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleItemSaved(updated: LineItem) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === updated.id ? { ...updated, userReviewed: true } : li))
    );
  }

  function markReviewed(itemId: string) {
    setLineItems((prev) =>
      prev.map((li) => (li.id === itemId ? { ...li, userReviewed: true } : li))
    );
  }

  async function sendQuote() {
    setSending(true);
    setConfirmSendOpen(false);
    try {
      router.push(`/quotes/${quoteId}/send`);
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <>
        <TopBar backHref="/leads" title="Quote" />
        <div className="px-4 py-4">
          <QuoteDraftSkeleton />
        </div>
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Generating state — quote not ready yet
  // ---------------------------------------------------------------------------
  if (!quote || quote.status === "generating" || !quote.quote_line_items?.length) {
    return (
      <>
        <TopBar backHref="/leads" title="Generating Quote" />
        <GeneratingState onRefresh={loadQuote} />
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Group line items
  // ---------------------------------------------------------------------------
  const materialItems = lineItems.filter((li) => li.kind === "material");
  const labourItems = lineItems.filter((li) => li.kind === "labour");
  const otherItems = lineItems.filter((li) => li.kind === "other");

  return (
    <>
      <TopBar backHref="/leads" backLabel="Back to leads" title="Review Quote" />

      <div className="px-4 py-4 flex flex-col gap-4">
        {/* Status banner */}
        {allResolved ? (
          <AlertBanner
            variant="success"
            title="AI quote ready"
            message="All lines ≥ 80% confident"
          />
        ) : (
          <AlertBanner
            variant="warning"
            title={`${flaggedItems.length} line${flaggedItems.length === 1 ? "" : "s"} need review`}
            message="Tap each amber line to confirm or edit"
          />
        )}

        {/* Stale rate card warning */}
        {quote.rate_card_source === "cached" && (
          <AlertBanner
            variant="info"
            message="Prices may be outdated — using cached Bunnings rates"
          />
        )}

        {/* Line items — Materials */}
        {materialItems.length > 0 && (
          <section aria-labelledby="materials-heading">
            <h2
              id="materials-heading"
              className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2"
            >
              Materials
            </h2>
            <div className="border border-slate-200 rounded-md overflow-hidden bg-white divide-y divide-slate-100">
              {materialItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditItem(item)}
                  onMarkReviewed={() => markReviewed(item.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Labour */}
        {labourItems.length > 0 && (
          <section aria-labelledby="labour-heading">
            <h2
              id="labour-heading"
              className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2"
            >
              Labour
            </h2>
            <div className="border border-slate-200 rounded-md overflow-hidden bg-white divide-y divide-slate-100">
              {labourItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditItem(item)}
                  onMarkReviewed={() => markReviewed(item.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Other */}
        {otherItems.length > 0 && (
          <section aria-labelledby="other-heading">
            <h2
              id="other-heading"
              className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2"
            >
              Other
            </h2>
            <div className="border border-slate-200 rounded-md overflow-hidden bg-white divide-y divide-slate-100">
              {otherItems.map((item) => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  onEdit={() => setEditItem(item)}
                  onMarkReviewed={() => markReviewed(item.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Totals */}
        <div
          className="rounded-md border border-slate-200 bg-white p-4"
          aria-label="Quote totals"
        >
          <div className="flex justify-between text-base text-slate-700 mb-1">
            <span>Subtotal</span>
            <span>{formatAUD(subtotal)}</span>
          </div>
          <div className="flex justify-between text-base text-slate-700 mb-2">
            <span>GST (10%)</span>
            <span>{formatAUD(gst)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="text-base font-semibold text-slate-700">TOTAL</span>
            <span
              className="text-2xl font-bold text-slate-900"
              aria-live="polite"
            >
              {formatAUD(total)}
            </span>
          </div>
        </div>

        {/* NSW Compliance — collapsed */}
        <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
          <button
            onClick={() => setWarrantyExpanded((v) => !v)}
            aria-expanded={warrantyExpanded}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-500 hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A]" aria-hidden />
              {quote.licence_number_snapshot
                ? `Lic: ${quote.licence_number_snapshot} (NSW) ✓`
                : "NSW Compliance"}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                warrantyExpanded && "rotate-180"
              )}
              aria-hidden
            />
          </button>
          {warrantyExpanded && quote.statutory_warranty_text && (
            <div className="px-4 pb-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                {quote.statutory_warranty_text}
              </p>
            </div>
          )}
        </div>

        {/* Send CTA */}
        {allResolved ? (
          <Button
            size="lg"
            variant="success"
            onClick={() => router.push(`/quotes/${quoteId}/send`)}
            className="gap-2"
            aria-label="Looks good, send this quote"
          >
            <CheckCircle2 className="h-5 w-5" aria-hidden />
            Looks good — Send!
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant="warning"
              disabled
              className="gap-2"
              aria-label={`${flaggedItems.length} lines need review before sending`}
            >
              ⚠️ Review {flaggedItems.length} flagged line{flaggedItems.length === 1 ? "" : "s"}
            </Button>

            <button
              onClick={() => setConfirmSendOpen(true)}
              className="text-sm text-slate-500 underline text-center"
              aria-label={`Send anyway with ${flaggedItems.length} unresolved lines`}
            >
              Send anyway ({flaggedItems.length} unresolved)
            </button>
          </>
        )}
      </div>

      {/* Edit drawer */}
      <EditLineItemSheet
        quoteId={quoteId}
        lineItem={editItem}
        onClose={() => setEditItem(null)}
        onSaved={handleItemSaved}
      />

      {/* Confirm send with low confidence */}
      <ConfirmDialog
        open={confirmSendOpen}
        onClose={() => setConfirmSendOpen(false)}
        onConfirm={sendQuote}
        title="Send with unreviewed lines?"
        description={`${flaggedItems.length} line${flaggedItems.length === 1 ? " was" : "s were"} flagged by AI. Are you sure you want to send without reviewing?`}
        confirmLabel="Send anyway"
        cancelLabel="Go back and review"
        variant="warning"
        loading={sending}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Line item row component
// ---------------------------------------------------------------------------
interface LineItemRowProps {
  item: LineItem;
  onEdit: () => void;
  onMarkReviewed?: () => void;
}

function LineItemRow({ item, onEdit }: LineItemRowProps) {
  const isFlagged = item.confidence_score < 80 && !item.userReviewed;
  const lineTotal = parseFloat(item.qty) * parseFloat(item.unit_price_aud);

  return (
    <button
      onClick={onEdit}
      onKeyDown={(e) => e.key === "Enter" && onEdit()}
      className={cn(
        "w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors",
        isFlagged && "bg-[#FEF9C3]"
      )}
      aria-label={`Edit line item: ${item.description}, ${item.qty} ${item.unit} × ${formatAUD(item.unit_price_aud)}, confidence ${item.confidence_score}%`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">
          {isFlagged && (
            <span className="text-[#CA8A04] mr-1" aria-hidden>
              ⚠
            </span>
          )}
          {item.description}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">
          {item.qty} {item.unit} × {formatAUD(item.unit_price_aud)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-slate-700">
          {formatAUD(lineTotal)}
        </span>
        <ConfidenceBadge score={item.confidence_score} />
      </div>
    </button>
  );
}
