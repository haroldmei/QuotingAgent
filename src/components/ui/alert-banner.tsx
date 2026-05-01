import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type AlertVariant = "success" | "warning" | "error" | "info";

interface AlertBannerProps {
  variant: AlertVariant;
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}

const STYLES: Record<
  AlertVariant,
  { container: string; icon: React.ReactNode }
> = {
  success: {
    container: "bg-[#DCFCE7] text-[#14532D]",
    icon: <CheckCircle2 className="h-5 w-5 text-[#16A34A] flex-shrink-0" aria-hidden />,
  },
  warning: {
    container: "bg-[#FEF9C3] text-[#713F12]",
    icon: <AlertTriangle className="h-5 w-5 text-[#CA8A04] flex-shrink-0" aria-hidden />,
  },
  error: {
    container: "bg-[#FEE2E2] text-[#7F1D1D]",
    icon: <XCircle className="h-5 w-5 text-[#DC2626] flex-shrink-0" aria-hidden />,
  },
  info: {
    container: "bg-[#DBEAFE] text-[#1E3A8A]",
    icon: <Info className="h-5 w-5 text-[#2563EB] flex-shrink-0" aria-hidden />,
  },
};

function AlertBanner({
  variant,
  title,
  message,
  action,
  className,
}: AlertBannerProps) {
  const { container, icon } = STYLES[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 rounded-md p-4",
        container,
        className
      )}
    >
      {icon}
      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold">{title}</p>}
        <p className="text-sm">{message}</p>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export { AlertBanner };
export type { AlertVariant };
