"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { TopBar } from "@/components/layouts/TopBar";
import { OnboardingReqSchema, type OnboardingReq } from "@/lib/schemas/auth";
import { CheckCircle2, Loader2 } from "lucide-react";

const TRADE_OPTIONS = [
  { value: "roofer", label: "Roofer" },
  { value: "painter", label: "Painter" },
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "landscaper", label: "Landscaper" },
];

const LABOUR_DEFAULTS: Record<string, string> = {
  roofer: "95",
  painter: "75",
  electrician: "110",
  plumber: "105",
  landscaper: "65",
};

// ---------------------------------------------------------------------------
// Screen 3: Onboarding Profile Setup
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [licenceStatus, setLicenceStatus] = React.useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [licenceHolderName, setLicenceHolderName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingReq & { labour_rate_str: string }>({
    resolver: zodResolver(
      OnboardingReqSchema.extend({
        labour_rate_str: OnboardingReqSchema.shape.default_labour_rate_aud
          .optional()
          .transform(() => 0)
          .pipe(OnboardingReqSchema.shape.default_labour_rate_aud),
      }).partial({ default_labour_rate_aud: true })
    ),
    mode: "onBlur",
  });

  const tradeType = watch("trade_type");

  // Pre-fill labour rate when trade changes
  React.useEffect(() => {
    if (tradeType && LABOUR_DEFAULTS[tradeType]) {
      setValue("default_labour_rate_aud", parseFloat(LABOUR_DEFAULTS[tradeType]));
    }
  }, [tradeType, setValue]);

  // Validate licence on blur
  async function validateLicence(licence: string) {
    if (!licence || licence.length < 4) return;
    setLicenceStatus("checking");
    try {
      const res = await fetch("/api/crew/licence-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nsw_licence_number: licence.toUpperCase() }),
      });
      const data = await res.json();
      if (data.valid) {
        setLicenceStatus("valid");
        setLicenceHolderName(data.licence_holder_name ?? "");
      } else {
        setLicenceStatus("invalid");
        setLicenceHolderName("");
      }
    } catch {
      setLicenceStatus("invalid");
    }
  }

  async function onSubmit(data: OnboardingReq) {
    if (licenceStatus !== "valid") {
      addToast("Please verify your NSW Contractor Licence first", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Onboarding failed");
      }
      addToast("Welcome to QuotingAgent!", "success");
      router.push("/leads");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Setup failed", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Almost done!" />

      <div className="flex-1 px-4 py-6 max-w-sm mx-auto w-full">
        <h1 className="text-xl font-bold text-slate-900 mb-6">
          Set up your trade profile
        </h1>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Business name */}
          <Input
            label="Business name"
            type="text"
            placeholder="Rob's Roofing"
            autoComplete="organization"
            error={errors.business_name?.message}
            {...register("business_name")}
          />

          {/* Trade type */}
          <Select
            label="Trade type"
            options={TRADE_OPTIONS}
            placeholder="Select your trade"
            error={errors.trade_type?.message}
            {...register("trade_type")}
          />

          {/* NSW Licence */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              NSW Contractor Licence #
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="123456C"
                className={[
                  "h-12 w-full rounded-md border px-3 py-2 text-base uppercase",
                  "focus:outline-none focus:ring-2",
                  licenceStatus === "valid"
                    ? "border-[#16A34A] focus:ring-[#16A34A]/20"
                    : licenceStatus === "invalid"
                    ? "border-[#DC2626] focus:ring-[#DC2626]/20 focus:border-[#DC2626]"
                    : "border-slate-300 focus:border-[#F97316] focus:ring-[#F97316]/20",
                ].join(" ")}
                {...register("nsw_licence_number", {
                  onBlur: (e) => validateLicence(e.target.value),
                })}
              />
              {licenceStatus === "checking" && (
                <Loader2
                  className="absolute right-3 top-3.5 h-5 w-5 animate-spin text-slate-400"
                  aria-hidden
                />
              )}
              {licenceStatus === "valid" && (
                <CheckCircle2
                  className="absolute right-3 top-3.5 h-5 w-5 text-[#16A34A]"
                  aria-hidden
                />
              )}
            </div>
            {licenceStatus === "valid" && (
              <p className="text-xs text-[#16A34A]" aria-live="polite">
                ✓ Verified by NSW Fair Trading
                {licenceHolderName && ` — ${licenceHolderName}`}
              </p>
            )}
            {licenceStatus === "invalid" && (
              <p className="text-xs text-[#DC2626]" role="alert">
                Licence not found — check your NSW licence number or try again
              </p>
            )}
          </div>

          {/* ABN (optional) */}
          <Input
            label="ABN (optional)"
            type="text"
            inputMode="numeric"
            placeholder="12 345 678 901"
            helperText="For GST invoices — can be added later"
            error={errors.abn?.message}
            {...register("abn")}
          />

          {/* Default labour rate */}
          <Input
            label="Default labour rate (A$/hr)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max="1000"
            placeholder="95.00"
            helperText="Pre-filled with the trade median — you can change this any time"
            error={errors.default_labour_rate_aud?.message}
            {...register("default_labour_rate_aud", { valueAsNumber: true })}
          />

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            disabled={licenceStatus !== "valid"}
            loading={submitting}
            loadingText="Setting up..."
            className="mt-2"
          >
            Start quoting →
          </Button>
        </form>
      </div>
    </div>
  );
}
