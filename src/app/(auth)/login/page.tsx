"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { toE164 } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/db/supabase-client";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const phoneSchema = z.object({
  phone: z
    .string()
    .min(9, "Enter your mobile number")
    .transform((v) => toE164(v))
    .refine((v) => /^\+614\d{8}$/.test(v), "Must be an Australian mobile (+61 4XX XXX XXX)"),
});

type Step = "phone" | "otp";

// ---------------------------------------------------------------------------
// Page — Screen 1 + Screen 2 combined in state machine
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [step, setStep] = React.useState<Step>("phone");
  const [e164, setE164] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [otpError, setOtpError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  // Phone form
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ phone: string }>({
    resolver: zodResolver(phoneSchema),
  });

  // Cooldown timer
  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  // Auto-submit when 6 digits entered
  React.useEffect(() => {
    if (otp.length === 6 && step === "otp") {
      void verifyOtp();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  async function sendOtp(phone: string) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, action: "send" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to send code");
      }
      setE164(phone);
      setStep("otp");
      setResendCooldown(30);
      addToast("Code sent to your mobile", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Failed to send code", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp() {
    if (submitting) return;
    setOtpError("");
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164,
        token: otp,
        type: "sms",
      });
      if (error) throw new Error(error.message);
      // Check if onboarding needed
      const crewId = data.user?.app_metadata?.crew_id as string | undefined;
      if (!crewId) {
        router.push("/onboarding");
      } else {
        router.push("/leads");
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Invalid code — try again");
      setOtp("");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Screen 1: Phone Entry
  // ---------------------------------------------------------------------------
  if (step === "phone") {
    return (
      <div className="flex flex-col flex-1 px-6 py-8 max-w-sm mx-auto w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <span className="text-2xl font-bold text-[#F97316]">QuotingAgent</span>
        </div>

        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold text-slate-900">
            Photo to SMS quote in 5 minutes.
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Western Sydney trades only.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit((data) => sendOtp(data.phone))}
          className="flex flex-col gap-4"
          noValidate
        >
          <Input
            label="Your mobile number"
            type="tel"
            inputMode="numeric"
            placeholder="0412 345 678"
            auPrefix
            autoComplete="tel"
            error={errors.phone?.message}
            {...register("phone")}
          />

          <Button
            type="submit"
            size="lg"
            loading={submitting}
            loadingText="Sending code..."
            className="mt-2"
          >
            Send me a code →
          </Button>
        </form>

        {/* Legal */}
        <p className="text-xs text-slate-400 text-center mt-6">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline hover:text-slate-600">
            Terms
          </a>{" "}
          &{" "}
          <a href="/privacy" className="underline hover:text-slate-600">
            Privacy Policy
          </a>
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Screen 2: OTP Verification
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col flex-1 px-6 py-8 max-w-sm mx-auto w-full">
      {/* Back */}
      <button
        onClick={() => { setStep("phone"); setOtp(""); setOtpError(""); }}
        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-8 -ml-1 h-11 w-auto"
        aria-label="Back to phone entry"
      >
        ← Back
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">
          Enter the 6-digit code
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Sent to {e164.replace(/^\+61/, "0").replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3")}
        </p>
      </div>

      <OtpInput
        value={otp}
        onChange={setOtp}
        disabled={submitting}
        error={otpError}
        autoFocus
      />

      <div className="mt-4 text-center">
        {resendCooldown > 0 ? (
          <p className="text-sm text-slate-500">
            Resend code in {resendCooldown}s
          </p>
        ) : (
          <button
            onClick={() => { setOtp(""); sendOtp(e164); }}
            disabled={submitting}
            className="text-sm text-[#F97316] hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        )}
      </div>

      {submitting && (
        <p className="text-center text-sm text-slate-500 mt-4 animate-pulse" aria-live="polite">
          Verifying…
        </p>
      )}
    </div>
  );
}
