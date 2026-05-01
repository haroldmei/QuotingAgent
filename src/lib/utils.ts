import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, handling conflicts correctly */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format AUD currency with 2 decimal places */
export function formatAUD(amount: number | string | null | undefined): string {
  const num = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(isNaN(num) ? 0 : num);
}

/** Format a timestamp as relative time (e.g. "2 min ago") */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/** Format time as HH:MM for display */
export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Format date as "1 May 2026" */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Convert AU mobile to display format: +61412345678 → 0412 345 678 */
export function formatAuMobile(phone: string): string {
  const local = phone.replace(/^\+61/, "0");
  return local.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
}

/** Strip non-digits and convert "04XX…" to E.164 +614… */
export function toE164(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("61")) return `+${digits}`;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  return `+61${digits}`;
}

/** Check if a lead status is still actionable */
export function isLeadActive(status: string): boolean {
  return ["new", "generating", "draft_ready"].includes(status);
}

/** Compute GST and total from subtotal */
export function computeGst(subtotal: number): { gst: number; total: number } {
  const gst = Math.round(subtotal * 0.1 * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  return { gst, total };
}
