"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  /** Show AU +61 prefix locked — for phone inputs */
  auPrefix?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, helperText, error, auPrefix, id, ...props }, ref) => {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {auPrefix && (
            <span className="absolute left-3 text-base text-slate-600 select-none pointer-events-none font-medium">
              +61
            </span>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            aria-invalid={error ? "true" : undefined}
            className={cn(
              // Height: 48px on mobile (h-12), 44px min tap target
              "h-12 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-800",
              "placeholder:text-slate-400",
              "focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20",
              "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50",
              error && "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20",
              auPrefix && "pl-11",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-[#DC2626]">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={helperId} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
