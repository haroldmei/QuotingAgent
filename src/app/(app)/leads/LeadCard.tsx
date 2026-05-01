"use client";

import Link from "next/link";
import { Camera, Eye, CheckCircle2, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime, formatAUD, cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/db/database.types";

// ---------------------------------------------------------------------------
// Status strip colors — 4px left-side indicator
// ---------------------------------------------------------------------------
const STATUS_STRIP: Record<LeadStatus, string> = {
  new: "bg-[#2563EB]",
  generating: "bg-[#CA8A04] animate-pulse-slow",
  draft_ready: "bg-[#CA8A04]",
  sent: "bg-[#F97316]",
  delivered: "bg-[#F97316]",
  opened: "bg-[#16A34A]",
  won: "bg-[#16A34A]",
  lost: "bg-slate-300",
};

interface Lead {
  id: string;
  customer_name: string;
  address: string | null;
  description: string | null;
  status: LeadStatus;
  created_at: string;
  // Quote data may be joined
  quote_total?: string | null;
  flagged_line_count?: number;
}

interface LeadCardProps {
  lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
  const { id, customer_name, address, description, status, created_at, quote_total, flagged_line_count } = lead;

  // Determine description snippet (special cases for generating/flagged)
  const snippet =
    status === "draft_ready" && flagged_line_count
      ? `${flagged_line_count} line${flagged_line_count === 1 ? "" : "s"} need review ⚠`
      : description
      ? description.slice(0, 72) + (description.length > 72 ? "…" : "")
      : null;

  return (
    <article
      className={cn(
        "relative flex min-h-[96px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm",
        // Subtle press feedback
        "active:scale-[0.99] transition-transform duration-100"
      )}
      aria-label={`Lead: ${customer_name}, ${address ?? "no address"}, status: ${status}`}
    >
      {/* Left status strip — 4px wide, full height */}
      <div className={cn("w-1 flex-shrink-0", STATUS_STRIP[status])} aria-hidden />

      <div className="flex-1 p-4 flex flex-col gap-1 min-w-0">
        {/* Row 1: Name + status badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold text-slate-800 truncate">
            {customer_name}
          </span>
          <StatusBadge status={status} />
        </div>

        {/* Row 2: Address */}
        {address && (
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" aria-hidden />
            <span className="truncate">{address}</span>
          </div>
        )}

        {/* Row 3: Description or flagged warning */}
        {snippet && (
          <p
            className={cn(
              "text-sm line-clamp-2",
              status === "draft_ready" && flagged_line_count
                ? "text-[#713F12] font-medium"
                : "text-slate-500"
            )}
          >
            {snippet}
          </p>
        )}

        {/* Row 4: Timestamp + primary action */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-xs text-slate-400 flex-shrink-0">
            {formatRelativeTime(created_at)}
          </span>
          <PrimaryAction
            leadId={id}
            status={status}
            quoteTotal={quote_total}
          />
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Primary action button per status
// ---------------------------------------------------------------------------
function PrimaryAction({
  leadId,
  status,
  quoteTotal,
}: {
  leadId: string;
  status: LeadStatus;
  quoteTotal?: string | null;
}) {
  switch (status) {
    case "new":
      return (
        <Button asChild size="sm" variant="default">
          <Link href={`/leads/${leadId}/photos`}>
            <Camera className="h-4 w-4" aria-hidden />
            Take Photos
          </Link>
        </Button>
      );
    case "generating":
      return (
        <Button size="sm" variant="warning" disabled loading>
          AI Working...
        </Button>
      );
    case "draft_ready":
      return (
        <Button asChild size="sm" variant="default">
          <Link href={`/quotes/${leadId}`}>
            <Eye className="h-4 w-4" aria-hidden />
            Review Quote
          </Link>
        </Button>
      );
    case "sent":
    case "delivered":
    case "opened":
      return (
        <Button asChild size="sm" variant="secondary">
          <Link href={`/quotes/${leadId}/sent`}>
            {quoteTotal ? formatAUD(quoteTotal) : "View Quote"}
          </Link>
        </Button>
      );
    case "won":
      return (
        <Button size="sm" variant="success" disabled aria-label="Quote won">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Won ✓
        </Button>
      );
    case "lost":
      return (
        <Button size="sm" variant="ghost" disabled className="text-slate-400">
          Lost
        </Button>
      );
    default:
      return null;
  }
}
