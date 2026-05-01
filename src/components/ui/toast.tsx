"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "warning" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback(
    (message: string, variant: ToastVariant = "info", duration = 4000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast container — above BottomNav, assertive region */}
      <div
        aria-live="assertive"
        aria-atomic="false"
        className="fixed bottom-20 inset-x-0 z-50 flex flex-col gap-2 px-4 pb-safe pointer-events-none"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: React.ReactNode }> = {
  success: {
    border: "border-l-4 border-l-[#16A34A]",
    icon: <CheckCircle2 className="h-5 w-5 text-[#16A34A] flex-shrink-0" aria-hidden />,
  },
  warning: {
    border: "border-l-4 border-l-[#CA8A04]",
    icon: <AlertTriangle className="h-5 w-5 text-[#CA8A04] flex-shrink-0" aria-hidden />,
  },
  error: {
    border: "border-l-4 border-l-[#DC2626]",
    icon: <XCircle className="h-5 w-5 text-[#DC2626] flex-shrink-0" aria-hidden />,
  },
  info: {
    border: "border-l-4 border-l-[#2563EB]",
    icon: <Info className="h-5 w-5 text-[#2563EB] flex-shrink-0" aria-hidden />,
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const { border, icon } = VARIANT_STYLES[toast.variant];
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-center gap-3 min-h-14 w-full rounded-md bg-white shadow-lg px-4 py-3",
        border
      )}
    >
      {icon}
      <p className="flex-1 text-sm font-medium text-slate-800">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 flex-shrink-0"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
