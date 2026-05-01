"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: BottomSheetProps) {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      {/* Sheet — 75vh max per design spec */}
      <div
        className={cn(
          "relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl",
          "max-h-[75vh] overflow-y-auto",
          "animate-in slide-in-from-bottom-4 duration-300",
          className
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="h-1 w-8 rounded-full bg-slate-300"
            aria-hidden
          />
        </div>
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-4 pb-2">
            <h2 id={titleId} className="text-lg font-semibold text-slate-800">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="h-11 w-11 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
        {/* Content */}
        <div className="px-4 pb-safe pb-6">{children}</div>
      </div>
    </div>
  );
}

export { BottomSheet };
