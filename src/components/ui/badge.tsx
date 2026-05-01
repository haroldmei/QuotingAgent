import * as React from "react";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/db/database.types";

// ---------------------------------------------------------------------------
// Generic badge
// ---------------------------------------------------------------------------
const badgeVariants = {
  default: "bg-slate-100 text-slate-700",
  new: "bg-[#DBEAFE] text-[#1E3A8A]",
  generating: "bg-[#FEF9C3] text-[#713F12] animate-pulse",
  draft_ready: "bg-[#FEF9C3] text-[#713F12]",
  sent: "bg-[#FFEDD5] text-[#C2510A]",
  delivered: "bg-[#FFEDD5] text-[#9A3F08]",
  opened: "bg-[#DCFCE7] text-[#14532D]",
  won: "bg-[#DCFCE7] text-[#14532D]",
  lost: "bg-slate-100 text-slate-500",
  success: "bg-[#DCFCE7] text-[#14532D]",
  warning: "bg-[#FEF9C3] text-[#713F12]",
  error: "bg-[#FEE2E2] text-[#7F1D1D]",
  info: "bg-[#DBEAFE] text-[#1E3A8A]",
} as const;

type BadgeVariant = keyof typeof badgeVariants;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Lead status badge with pulse dot for Generating
// ---------------------------------------------------------------------------
const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  generating: "Generating",
  draft_ready: "Review",
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  won: "Won",
  lost: "Lost",
};

interface StatusBadgeProps {
  status: LeadStatus;
  className?: string;
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = status as BadgeVariant;
  return (
    <Badge variant={variant} className={className} aria-label={`Status: ${STATUS_LABELS[status]}`}>
      {status === "generating" && (
        <span className="h-1.5 w-1.5 rounded-full bg-[#CA8A04] animate-pulse" aria-hidden />
      )}
      {status === "won" && (
        <span aria-hidden>✓</span>
      )}
      {STATUS_LABELS[status]}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Confidence badge for quote line items
// ---------------------------------------------------------------------------
interface ConfidenceBadgeProps {
  score: number; // 0–100
  className?: string;
}

function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  const colorClass =
    score >= 80
      ? "bg-[#DCFCE7] text-[#14532D]"
      : score >= 60
      ? "bg-[#FEF9C3] text-[#713F12]"
      : "bg-[#FEE2E2] text-[#7F1D1D]";

  const icon = score >= 80 ? "●" : score >= 60 ? "◐" : "⚠";
  const label = `Confidence: ${score}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full w-10 h-6 text-xs font-medium",
        colorClass,
        className
      )}
      aria-label={label}
      title={label}
    >
      <span aria-hidden>{icon}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Badge, StatusBadge, ConfidenceBadge, badgeVariants };
export type { BadgeVariant };
