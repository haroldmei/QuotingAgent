"use client";

import * as React from "react";
import { TopBar } from "@/components/layouts/TopBar";
import { LeadCard } from "../leads/LeadCard";
import { LeadCardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { LeadStatus } from "@/lib/db/database.types";

interface LeadRow {
  id: string;
  customer_name: string;
  address: string | null;
  description: string | null;
  status: LeadStatus;
  created_at: string;
}

export default function HistoryPage() {
  const [leads, setLeads] = React.useState<LeadRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/leads?status=won&limit=50")
      .then((r) => r.json())
      .then((data) => { setLeads(data.items ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load history"); setLoading(false); });
  }, []);

  return (
    <>
      <TopBar title="History" />
      <section className="px-4 py-4 flex flex-col gap-3" aria-label="Won quotes history">
        {loading && [...Array(3)].map((_, i) => <LeadCardSkeleton key={i} />)}

        {error && (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500 mb-4">{error}</p>
            <Button
              variant="secondary"
              size="md"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && leads.length === 0 && (
          <div className="text-center py-16" aria-live="polite">
            <p className="text-2xl mb-2">🏆</p>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">
              No won quotes yet
            </h2>
            <p className="text-sm text-slate-500">
              Accepted quotes will appear here.
            </p>
          </div>
        )}

        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} />
        ))}
      </section>
    </>
  );
}
