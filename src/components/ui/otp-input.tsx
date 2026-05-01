"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
}

function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
  error,
  autoFocus = false,
}: OtpInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split("").concat(Array(length).fill("")).slice(0, length);

  const handleChange = (index: number, char: string) => {
    if (!/^\d?$/.test(char)) return; // only digits
    const newDigits = [...digits];
    newDigits[index] = char;
    const newValue = newDigits.join("");
    onChange(newValue);
    // Auto-advance
    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(paste);
    const nextIndex = Math.min(paste.length, length - 1);
    inputRefs.current[nextIndex]?.focus();
  };

  const errorId = React.useId();

  return (
    <div className="flex flex-col gap-2">
      <div
        role="group"
        aria-label="Enter 6-digit verification code"
        aria-describedby={error ? errorId : undefined}
        className="flex gap-2 justify-center"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            pattern="\d"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            aria-label={`Digit ${index + 1} of ${length}`}
            className={cn(
              // 52×64dp per design spec
              "w-12 h-16 text-center text-2xl font-bold rounded-md border-2",
              "text-slate-900 bg-white",
              "focus:outline-none focus:ring-2 focus:ring-[#F97316]/20",
              digit
                ? "border-[#F97316]"
                : "border-slate-300",
              error && "border-[#DC2626]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-[#DC2626] text-center">
          {error}
        </p>
      )}
    </div>
  );
}

export { OtpInput };
