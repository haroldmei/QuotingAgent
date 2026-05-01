"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  maxLength?: number;
  showCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      maxLength,
      showCount = false,
      value,
      onChange,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const charCount =
      typeof value === "string"
        ? value.length
        : typeof value === "number"
        ? String(value).length
        : 0;
    const isNearLimit = maxLength && charCount >= maxLength * 0.96;

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
        <div className="relative">
          <textarea
            id={inputId}
            ref={ref}
            value={value}
            onChange={onChange}
            maxLength={maxLength}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            aria-invalid={error ? "true" : undefined}
            className={cn(
              "w-full min-h-[72px] max-h-[120px] resize-none rounded-md border border-slate-300 bg-white px-3 py-3 text-base text-slate-800",
              "placeholder:text-slate-400",
              "focus:border-[#F97316] focus:outline-none focus:ring-2 focus:ring-[#F97316]/20",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20",
              showCount && maxLength && "pb-6",
              className
            )}
            {...props}
          />
          {showCount && maxLength && (
            <span
              className={cn(
                "absolute bottom-2 right-3 text-xs",
                isNearLimit ? "text-[#DC2626]" : "text-slate-400"
              )}
              aria-live="polite"
            >
              {charCount} / {maxLength}
            </span>
          )}
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
Textarea.displayName = "Textarea";

export { Textarea };
