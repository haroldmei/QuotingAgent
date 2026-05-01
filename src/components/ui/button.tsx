"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  // Base — 44dp minimum tap target, no-select, accessible focus
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none",
  {
    variants: {
      variant: {
        // Primary — trade-orange-500
        default:
          "bg-[#F97316] text-white hover:bg-[#EA6A0A] active:bg-[#C2510A]",
        // Secondary — white/slate border
        secondary:
          "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 active:bg-slate-100",
        // Ghost — no background
        ghost:
          "bg-transparent text-slate-600 hover:bg-slate-100 active:bg-slate-200",
        // Destructive — error-base
        destructive:
          "bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B]",
        // Success — won state
        success:
          "bg-[#16A34A] text-white hover:bg-[#15803D] active:bg-[#166534]",
        // Warning — flagged state
        warning:
          "bg-[#CA8A04] text-white hover:bg-[#A16207] active:bg-[#854D0E]",
        // Link
        link: "bg-transparent text-[#F97316] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-9 min-h-9 px-3 text-sm rounded-xl",
        md: "h-11 min-h-[44px] px-4 text-base",
        lg: "h-12 min-h-[48px] px-6 text-lg w-full",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {loading && loadingText ? loadingText : children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
