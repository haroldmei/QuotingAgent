"use client";

import * as React from "react";
import { Plus, RefreshCw } from "lucide-react";
import { TopBar } from "@/components/layouts/TopBar";
import { LeadCard } from "./LeadCard";
import { NewLeadSheet } from "./NewLeadSheet";
import { LeadCardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/db/database.types";

// ---------------------------------------------------------------------------
// Status filter tabs — Screen 4
// ---------------------------------------------------------------------------
const STATUS_TABS: Array<{ value: LeadStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "generating", label: "Generating" },
  { value: "draft_ready", label: "Review" },
  { value: "sent", label: "Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

interface LeadRow {
  id: string;
  customer_name: string;
  address: string | null;
  description: string | null;
  status: LeadStatus;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LeadsPage() {
  const [leads, setLeads] = React.useState<LeadRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<LeadStatus | "all">("all");
  const [newLeadOpen, setNewLeadOpen] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);

  // Register service worker for PWA
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {/* silent */});
    }
  }, []);

  // Subscribe to push notifications
  React.useEffect(() => {
    async function subscribePush() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        if (existing) return; // already subscribed
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) return;
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(publicKey) as unknown as ArrayBuffer,
        });
        await fetch("/api/notifications/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: {
              p256dh: arrayBufferToBase64(sub.getKey("p256dh")!),
              auth: arrayBufferToBase64(sub.getKey("auth")!),
            },
          }),
        });
      } catch {/* silent — push is enhancement only */}
    }
    subscribePush();
  }, []);

  async function fetchLeads(status?: LeadStatus | "all", cursor?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "20" });
      if (status && status !== "all") params.set("status", status);
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = await res.json();
      if (cursor) {
        setLeads((prev) => [...prev, ...(data.items ?? [])]);
      } else {
        setLeads(data.items ?? []);
      }
      setNextCursor(data.next_cursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchLeads(activeTab);
    // Poll every 5 seconds for generating leads (push fallback per FR-004)
    const hasGenerating = leads.some((l) => l.status === "generating");
    if (!hasGenerating) return;
    const poll = setInterval(() => fetchLeads(activeTab), 5000);
    return () => clearInterval(poll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  function handleTabChange(tab: LeadStatus | "all") {
    setActiveTab(tab);
    setLeads([]);
    setNextCursor(null);
  }

  return (
    <>
      <TopBar
        title="QuotingAgent"
        rightSlot={
          <button
            onClick={() => setNewLeadOpen(true)}
            aria-label="Add new lead"
            className="h-11 w-11 flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </button>
        }
      />

      {/* Status tabs */}
      <div
        className="bg-white border-b border-slate-200 overflow-x-auto scrollbar-none"
        aria-label="Filter leads by status"
      >
        <div className="flex px-4 gap-0 min-w-max">
          {STATUS_TABS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => handleTabChange(value)}
              role="tab"
              aria-selected={activeTab === value}
              className={cn(
                "px-3 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === value
                  ? "border-[#F97316] text-slate-900 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lead list */}
      <section className="px-4 py-4 flex flex-col gap-3">
        {loading && leads.length === 0 && (
          <>
            {[...Array(4)].map((_, i) => <LeadCardSkeleton key={i} />)}
          </>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => fetchLeads(activeTab)}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && leads.length === 0 && (
          <div className="text-center py-16" aria-live="polite">
            <p className="text-2xl mb-2">📸</p>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              No leads yet
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Snap a site photo. Get a quote in 5 minutes.
            </p>
            <Button size="md" onClick={() => setNewLeadOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Add your first lead
            </Button>
          </div>
        )}

        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}

        {/* Load more */}
        {nextCursor && !loading && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => fetchLeads(activeTab, nextCursor)}
            className="mt-2"
          >
            Load more
          </Button>
        )}

        {loading && leads.length > 0 && (
          <div className="text-center py-4 text-sm text-slate-400 animate-pulse">
            Loading more…
          </div>
        )}
      </section>

      {/* New lead sheet */}
      <NewLeadSheet
        open={newLeadOpen}
        onClose={() => setNewLeadOpen(false)}
        onCreated={() => fetchLeads(activeTab)}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Push notification helpers
// ---------------------------------------------------------------------------
function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
}
