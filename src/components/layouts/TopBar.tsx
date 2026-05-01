"use client";

import Link from "next/link";
import type React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopBarProps {
  /** If set, shows a back arrow linking to this href */
  backHref?: string;
  backLabel?: string;
  /** Center title — shown as h1 or just text */
  title?: string;
  /** Right-side slot for contextual action */
  rightSlot?: React.ReactNode;
  className?: string;
}

export function TopBar({ backHref, backLabel = "Back", title, rightSlot, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-white border-b border-slate-200",
        "pt-safe",
        className
      )}
    >
      {/* Left: back button or logo */}
      {backHref ? (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="h-11 w-11 flex items-center justify-center -ml-2 rounded-full text-slate-600 hover:bg-slate-100 flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>
      ) : (
        <div className="w-11 flex-shrink-0" aria-hidden />
      )}

      {/* Center: title */}
      {title && (
        <h1 className="flex-1 text-center text-lg font-semibold text-slate-800 truncate">
          {title}
        </h1>
      )}

      {/* Right: contextual slot */}
      <div className="w-11 flex items-center justify-end flex-shrink-0">
        {rightSlot ?? null}
      </div>
    </header>
  );
}
