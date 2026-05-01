"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LineItemPatchReqSchema, type LineItemPatchReq } from "@/lib/schemas/quotes";
import { formatAUD } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

import type { LineItemKind } from "@/lib/db/database.types";

interface LineItem {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unit_price_aud: string;
  confidence_score: number;
  kind: LineItemKind;
  sort_order: number;
  userReviewed?: boolean;
}

interface EditLineItemSheetProps {
  quoteId: string;
  lineItem: LineItem | null;
  onClose: () => void;
  onSaved: (updated: LineItem) => void;
}

export function EditLineItemSheet({
  quoteId,
  lineItem,
  onClose,
  onSaved,
}: EditLineItemSheetProps) {
  const { addToast } = useToast();
  const isFlagged = lineItem ? lineItem.confidence_score < 80 : false;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LineItemPatchReq>({
    resolver: zodResolver(LineItemPatchReqSchema),
  });

  React.useEffect(() => {
    if (lineItem) {
      reset({
        description: lineItem.description,
        qty: parseFloat(lineItem.qty),
        unit: lineItem.unit,
        unit_price_aud: parseFloat(lineItem.unit_price_aud),
      });
    }
  }, [lineItem, reset]);

  const qty = watch("qty") ?? 0;
  const unitPrice = watch("unit_price_aud") ?? 0;
  const lineTotal = (Number(qty) || 0) * (Number(unitPrice) || 0);

  async function onSubmit(data: LineItemPatchReq) {
    if (!lineItem) return;
    const res = await fetch(`/api/quotes/${quoteId}/line-items/${lineItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addToast(err.error ?? "Failed to save", "error");
      return;
    }
    const updated = await res.json();
    addToast("Line item updated", "success");
    onSaved({ ...lineItem, ...updated });
    onClose();
  }

  return (
    <BottomSheet
      open={!!lineItem}
      onClose={onClose}
      title={isFlagged ? "⚠️ Edit line item" : "Edit line item"}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
        noValidate
      >
        {isFlagged && (
          <p className="text-sm text-[#CA8A04] font-medium">
            This line was flagged — please confirm or adjust before sending
          </p>
        )}

        <Input
          label="Description"
          type="text"
          error={errors.description?.message}
          {...register("description")}
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              label="Quantity"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              error={errors.qty?.message}
              {...register("qty", { valueAsNumber: true })}
            />
          </div>
          <div className="w-24">
            <Input
              label="Unit"
              type="text"
              placeholder="m²"
              error={errors.unit?.message}
              {...register("unit")}
            />
          </div>
        </div>

        <Input
          label="Unit price (A$)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          error={errors.unit_price_aud?.message}
          {...register("unit_price_aud", { valueAsNumber: true })}
        />

        {/* Live total */}
        <div
          className="rounded-md bg-slate-50 px-4 py-3"
          aria-live="polite"
          aria-label={`Line total: ${formatAUD(lineTotal)}`}
        >
          <span className="text-sm text-slate-500">Line total: </span>
          <span className="text-lg font-bold text-slate-900">
            {formatAUD(lineTotal)}
          </span>
        </div>

        <Button
          type="submit"
          size="md"
          loading={isSubmitting}
          loadingText="Saving..."
          className="w-full"
        >
          Save changes
        </Button>

        <button
          type="button"
          onClick={onClose}
          className="text-sm text-slate-500 text-center hover:text-slate-700 py-2"
        >
          Cancel
        </button>
      </form>
    </BottomSheet>
  );
}
