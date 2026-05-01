"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TopBar } from "@/components/layouts/TopBar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { SendReqSchema, type SendReq } from "@/lib/schemas/quotes";
import { formatAUD, formatAuMobile, computeGst } from "@/lib/utils";
import { CheckCircle2, MessageSquare } from "lucide-react";

interface QuoteWithLead {
  id: string;
  lead_id: string;
  subtotal_aud: string | null;
  total_aud: string | null;
  licence_number_snapshot: string | null;
  lead: {
    customer_name: string;
    customer_mobile: string | null;
    address: string | null;
    description: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Screen 10 — SMS Send Preview
// ---------------------------------------------------------------------------
export default function SendQuotePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const quoteId = params.id;

  const { addToast } = useToast();
  const [quote, setQuote] = React.useState<QuoteWithLead | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [editingMessage, setEditingMessage] = React.useState(false);

  const defaultSmsBody = React.useMemo(() => {
    if (!quote?.lead) return "";
    const name = quote.lead.customer_name.split(" ")[0];
    const businessName = "your tradie"; // Would come from crew profile
    return `Hi ${name}, ${businessName} has sent you a quote. View & accept here: [link]`;
  }, [quote]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SendReq>({
    resolver: zodResolver(SendReqSchema),
    defaultValues: { sms_body: "" },
  });

  const smsBody = watch("sms_body") ?? "";

  React.useEffect(() => {
    fetch(`/api/quotes/${quoteId}`)
      .then((r) => r.json())
      .then((data) => {
        setQuote(data);
        // Set default SMS body
        const name = data.lead?.customer_name?.split(" ")[0] ?? "there";
        const addr = data.lead?.address ?? "your property";
        const defaultBody = `Hi ${name}, here is your quote for ${addr}. Tap to view & accept: [link]`;
        setValue("sms_body", defaultBody.slice(0, 160));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [quoteId, setValue]);

  async function onSubmit(data: SendReq) {
    const res = await fetch(`/api/quotes/${quoteId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addToast(err.error ?? "Failed to send quote", "error");
      return;
    }

    addToast("Quote sent by SMS!", "success");
    router.push(`/quotes/${quoteId}/sent`);
  }

  async function sendByEmail() {
    // Email fallback — calls the send endpoint with email flag
    const res = await fetch(`/api/quotes/${quoteId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sms_body: smsBody, channel: "email" }),
    });
    if (!res.ok) {
      addToast("Failed to send email", "error");
      return;
    }
    addToast("Quote sent by email", "success");
    router.push(`/quotes/${quoteId}/sent`);
  }

  const total = quote?.total_aud
    ? parseFloat(quote.total_aud)
    : quote?.subtotal_aud
    ? computeGst(parseFloat(quote.subtotal_aud)).total
    : 0;

  if (loading) {
    return (
      <>
        <TopBar backHref={`/quotes/${quoteId}`} title="Send Quote" />
        <div className="px-4 py-4 flex flex-col gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        backHref={`/quotes/${quoteId}`}
        backLabel="Back to review"
        title="Send Quote"
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="px-4 py-4 flex flex-col gap-4"
        noValidate
      >
        {/* Sending to */}
        <div>
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Sending to
          </h2>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="text-base font-semibold text-slate-800">
              {quote?.lead?.customer_name}
            </p>
            {quote?.lead?.customer_mobile && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-600">
                <MessageSquare className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                {formatAuMobile(quote.lead.customer_mobile)}
              </div>
            )}
            {quote?.lead?.address && (
              <p className="text-sm text-slate-500 mt-0.5">{quote.lead.address}</p>
            )}
          </div>
        </div>

        {/* SMS preview */}
        <div>
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            SMS message preview
          </h2>
          {editingMessage ? (
            <Textarea
              maxLength={160}
              showCount
              value={smsBody}
              error={errors.sms_body?.message}
              {...register("sms_body")}
            />
          ) : (
            <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700 relative">
              <p>{smsBody || defaultSmsBody}</p>
              <p className="text-right text-xs text-slate-400 mt-1">
                {(smsBody || defaultSmsBody).length}/160
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditingMessage((v) => !v)}
            className="text-sm text-[#F97316] mt-1 hover:underline"
          >
            {editingMessage ? "Preview" : "Edit message"}
          </button>
        </div>

        {/* Quote summary */}
        <div>
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
            Quote summary
          </h2>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p
              className="text-2xl font-bold text-slate-900"
              aria-label={`Quote total: ${formatAUD(total)} including GST`}
            >
              {formatAUD(total)}{" "}
              <span className="text-sm font-normal text-slate-500">inc. GST</span>
            </p>
            {quote?.lead?.description && (
              <p className="text-sm text-slate-500 mt-1">{quote.lead.description}</p>
            )}
            {quote?.licence_number_snapshot && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[#16A34A]">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Lic: {quote.licence_number_snapshot} (NSW) ✓
              </div>
            )}
          </div>
        </div>

        {/* Primary CTA */}
        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          loadingText="Sending..."
          className="gap-2 mt-2"
          aria-label="Confirm and send quote by SMS"
        >
          <MessageSquare className="h-5 w-5" aria-hidden />
          Confirm & Send SMS
        </Button>

        {/* Email fallback */}
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={sendByEmail}
          className="text-slate-600"
          aria-label="Send quote by email instead"
        >
          Send by email instead
        </Button>
      </form>
    </>
  );
}
