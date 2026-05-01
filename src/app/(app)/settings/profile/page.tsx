"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TopBar } from "@/components/layouts/TopBar";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth/context";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, LogOut, Link as LinkIcon } from "lucide-react";
import { z } from "zod";

const TRADE_OPTIONS = [
  { value: "roofer", label: "Roofer" },
  { value: "painter", label: "Painter" },
  { value: "electrician", label: "Electrician" },
  { value: "plumber", label: "Plumber" },
  { value: "landscaper", label: "Landscaper" },
];

const ProfileSchema = z.object({
  business_name: z.string().min(2).max(128),
  trade_type: z.enum(["roofer", "painter", "electrician", "plumber", "landscaper"]),
  default_labour_rate_aud: z.number().positive().max(1000),
  abn: z.string().regex(/^\d{11}$/).optional().or(z.literal("")),
});

type ProfileForm = z.infer<typeof ProfileSchema>;

interface CrewProfile {
  id: string;
  business_name: string;
  trade_type: string;
  nsw_licence_number: string;
  licence_verified: boolean;
  licence_verified_at: string | null;
  default_labour_rate_aud: string;
  abn: string | null;
}

// ---------------------------------------------------------------------------
// Screen 14 — Profile Settings (BottomNav 3rd tab)
// ---------------------------------------------------------------------------
export default function ProfilePage() {
  const { user, signOut, crewId } = useAuth();
  const { addToast } = useToast();

  const [crew, setCrew] = React.useState<CrewProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [fsmConnections] = React.useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(ProfileSchema),
  });

  React.useEffect(() => {
    if (!crewId) return;
    fetch(`/api/crew/${crewId}`)
      .then((r) => r.json())
      .then((data) => {
        setCrew(data);
        reset({
          business_name: data.business_name,
          trade_type: data.trade_type,
          default_labour_rate_aud: parseFloat(data.default_labour_rate_aud),
          abn: data.abn ?? "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [crewId, reset]);

  async function onSubmit(data: ProfileForm) {
    const res = await fetch(`/api/crew/${crewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      addToast("Failed to save profile", "error");
      return;
    }
    const updated = await res.json();
    setCrew(updated);
    addToast("Profile saved", "success");
    reset(data);
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  function connectFsm(provider: string) {
    window.location.href = `/api/fsm/${provider}/oauth/start`;
  }

  if (loading) {
    return (
      <>
        <TopBar title="Profile" />
        <div className="px-4 py-4 flex flex-col gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Profile" />

      <div className="px-4 py-4 flex flex-col gap-6">
        {/* Account info */}
        <section aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Account
          </h2>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-800">
              {user?.phone ?? "Unknown phone"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Crew ID: {crewId?.slice(0, 8)}…
            </p>
          </div>
        </section>

        {/* NSW Licence status */}
        {crew && (
          <section aria-labelledby="licence-heading">
            <h2 id="licence-heading" className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
              NSW Licence
            </h2>
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {crew.nsw_licence_number}
                  </p>
                  {crew.licence_verified ? (
                    <div className="flex items-center gap-1 mt-1 text-xs text-[#16A34A]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Verified by NSW Fair Trading
                    </div>
                  ) : (
                    <p className="text-xs text-[#DC2626] mt-1">
                      Not verified — licence validation required
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Edit profile form */}
        <section aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Trade Profile
          </h2>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
            noValidate
          >
            <Input
              label="Business name"
              type="text"
              error={errors.business_name?.message}
              {...register("business_name")}
            />

            <Select
              label="Trade type"
              options={TRADE_OPTIONS}
              error={errors.trade_type?.message}
              {...register("trade_type")}
            />

            <Input
              label="Default labour rate (A$/hr)"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="1000"
              error={errors.default_labour_rate_aud?.message}
              {...register("default_labour_rate_aud", { valueAsNumber: true })}
            />

            <Input
              label="ABN (optional)"
              type="text"
              inputMode="numeric"
              placeholder="12345678901"
              helperText="11 digits, no spaces"
              error={errors.abn?.message}
              {...register("abn")}
            />

            <Button
              type="submit"
              size="md"
              loading={isSubmitting}
              disabled={!isDirty}
              loadingText="Saving..."
              className="w-full"
            >
              Save changes
            </Button>
          </form>
        </section>

        {/* FSM connections */}
        <section aria-labelledby="fsm-heading" id="fsm">
          <h2 id="fsm-heading" className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Integrations
          </h2>
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-slate-200 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">ServiceM8</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fsmConnections.includes("servicem8")
                    ? "Connected"
                    : "Auto-create jobs when quotes are accepted"}
                </p>
              </div>
              <Button
                variant={fsmConnections.includes("servicem8") ? "secondary" : "default"}
                size="sm"
                onClick={() => connectFsm("servicem8")}
                className="gap-1.5"
              >
                <LinkIcon className="h-3.5 w-3.5" aria-hidden />
                {fsmConnections.includes("servicem8") ? "Reconnect" : "Connect"}
              </Button>
            </div>

            <div className="rounded-md border border-slate-200 bg-white p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">Tradify</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {fsmConnections.includes("tradify")
                    ? "Connected"
                    : "Auto-create jobs when quotes are accepted"}
                </p>
              </div>
              <Button
                variant={fsmConnections.includes("tradify") ? "secondary" : "default"}
                size="sm"
                onClick={() => connectFsm("tradify")}
                className="gap-1.5"
              >
                <LinkIcon className="h-3.5 w-3.5" aria-hidden />
                {fsmConnections.includes("tradify") ? "Reconnect" : "Connect"}
              </Button>
            </div>
          </div>
        </section>

        {/* Sign out */}
        <Button
          variant="secondary"
          size="md"
          onClick={handleSignOut}
          className="w-full gap-2 text-slate-600"
          aria-label="Sign out of QuotingAgent"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </>
  );
}
