"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ManualLeadReqSchema, type ManualLeadReq } from "@/lib/schemas/leads";
import { toE164 } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface NewLeadSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function NewLeadSheet({ open, onClose, onCreated }: NewLeadSheetProps) {
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ManualLeadReq & { customer_mobile_raw?: string }>({
    resolver: zodResolver(
      ManualLeadReqSchema.extend({
        customer_mobile_raw: ManualLeadReqSchema.shape.customer_mobile.optional(),
      })
    ),
    mode: "onBlur",
  });

  const description = watch("description") ?? "";

  async function onSubmit(data: ManualLeadReq & { customer_mobile_raw?: string }) {
    const payload: ManualLeadReq = {
      customer_name: data.customer_name,
      address: data.address,
      description: data.description,
      customer_email: data.customer_email,
    };
    if (data.customer_mobile_raw) {
      payload.customer_mobile = toE164(data.customer_mobile_raw);
    }

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addToast(err.error ?? "Failed to add lead", "error");
      return;
    }

    addToast("Lead added", "success");
    reset();
    onCreated();
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="New Lead">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        {/* Screen 14 per design spec */}
        <Input
          label="Customer name"
          type="text"
          placeholder="Sarah Chen"
          autoComplete="name"
          error={errors.customer_name?.message}
          {...register("customer_name")}
        />

        <Input
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          placeholder="0412 345 678"
          autoComplete="tel"
          auPrefix
          error={errors.customer_mobile?.message}
          {...register("customer_mobile_raw")}
        />

        <Input
          label="Address"
          type="text"
          placeholder="24 Westfield Rd, Penrith"
          autoComplete="street-address"
          error={errors.address?.message}
          {...register("address")}
        />

        <Textarea
          label="Job description (optional)"
          placeholder="Re-roof, colorbond, single-storey..."
          maxLength={280}
          showCount
          value={description}
          error={errors.description?.message}
          {...register("description")}
        />

        <Button
          type="submit"
          size="lg"
          loading={isSubmitting}
          loadingText="Adding lead..."
          className="mt-2"
        >
          Add lead →
        </Button>
      </form>
    </BottomSheet>
  );
}
