"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertBanner } from "@/components/ui/alert-banner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface GeneratingStateProps {
  photoCount?: number;
  onRefresh: () => void;
}

export function GeneratingState({ photoCount, onRefresh }: GeneratingStateProps) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll for draft_ready
  React.useEffect(() => {
    const poll = setInterval(onRefresh, 3000);
    return () => clearInterval(poll);
  }, [onRefresh]);

  return (
    <div className="px-4 py-6 flex flex-col gap-6">
      <AlertBanner
        variant="info"
        title="Generating your quote"
        message="AI is working on it…"
      />

      {/* Animated progress ring */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div
          className="relative h-24 w-24"
          aria-label={`Generating quote, ${elapsed} seconds elapsed`}
          role="status"
        >
          <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden>
            {/* Track */}
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="8"
            />
            {/* Progress — animates continuously */}
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              stroke="#F97316"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="251.2"
              strokeDashoffset="62.8"
              className="animate-spin-slow origin-center"
              style={{ transformOrigin: "48px 48px" }}
            />
          </svg>
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl animate-pulse" aria-hidden>✨</span>
          </div>
        </div>

        <p className="text-sm text-[#CA8A04] font-medium" aria-live="polite">
          {elapsed}s
        </p>
      </div>

      <div className="text-center">
        <p className="text-base font-semibold text-slate-800">
          AI is building your quote
          {photoCount ? ` from ${photoCount} photo${photoCount === 1 ? "" : "s"}` : ""}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Usually takes 20–60 seconds
        </p>
        <p className="text-sm text-slate-500 mt-2">
          You can navigate away — we&apos;ll notify you when it&apos;s ready
        </p>
      </div>

      <Button
        asChild
        variant="ghost"
        size="md"
        className="self-center gap-2"
      >
        <Link href="/leads">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to leads
        </Link>
      </Button>
    </div>
  );
}
