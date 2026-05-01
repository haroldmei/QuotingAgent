"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const titleId = React.useId();
  const descId = React.useId();

  // Trap focus and handle ESC
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    // Prevent body scroll
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
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className={cn(
          "relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="h-11 w-11 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 flex-shrink-0"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {description && (
          <p id={descId} className="text-base text-slate-600 mb-4">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog — for destructive actions
// ---------------------------------------------------------------------------
interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "warning" | "default";
  loading?: boolean;
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      {/* Cancel ABOVE destructive — per design spec §5e */}
      <div className="flex flex-col gap-3 mt-4">
        <Button variant="secondary" size="md" onClick={onClose} className="w-full">
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : variant === "warning" ? "warning" : "default"}
          size="md"
          onClick={onConfirm}
          loading={loading}
          className="w-full"
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

export { Dialog, ConfirmDialog };
