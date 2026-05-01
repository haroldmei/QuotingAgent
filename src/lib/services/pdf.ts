/**
 * Quote PDF generation service
 * Stack contract: STACK_GAP-002 resolved: react-pdf
 * FR-016: Generate PDF with line items, totals, NSW licence, statutory warranty, GST
 * Stores PDF in GCS, returns a signed URL ≤ 30 days
 */

import { logger } from "@/lib/logger";
import { uploadBuffer, generatePdfSignedUrl } from "@/lib/gcs/client";

export interface QuotePdfData {
  quoteId: string;
  quoteRef: string; // Human-readable reference, e.g. "Q-2026-001"
  quoteDate: string; // ISO date
  businessName: string;
  abn: string | null;
  nswLicenceNumber: string;
  customerName: string;
  address: string;
  lineItems: Array<{
    description: string;
    qty: number;
    unit: string;
    unit_price_aud: number;
    kind: string;
  }>;
  subtotalAud: number;
  gstAud: number;
  totalAud: number;
  statutoryWarrantyText: string;
  notes?: string;
}

// NSW Home Building Act statutory warranty (FR-025, OI-001)
// TODO: Replace with legal-reviewed exact wording before first production quote (OI-001)
export const NSW_STATUTORY_WARRANTY_TEXT = `
STATUTORY WARRANTY — NSW HOME BUILDING ACT 1989

All residential building work carried out under this contract is covered by statutory warranties under the Home Building Act 1989 (NSW). These warranties provide that:
(a) the work will be done with due care and skill;
(b) all materials supplied will be good and suitable for the purpose for which they are used;
(c) the work will be done in accordance with all laws and legal requirements;
(d) the work will result in a dwelling that is reasonably fit for occupation (where the contract is to do work resulting in a dwelling).

These warranties run for 2 years for defects resulting in a structural defect and 6 months for other defects. Note: OI-001 — exact statutory wording requires legal review before first production use.
`.trim();

/**
 * Generate a PDF for a quote using @react-pdf/renderer.
 *
 * NOTE: react-pdf renders synchronously in Node. We import it dynamically
 * so it only loads in the worker (Cloud Run), not in the Vercel edge runtime.
 */
export async function generateQuotePdf(data: QuotePdfData): Promise<Buffer> {
  // Dynamic import — react-pdf only works in Node (not edge runtime)
  const { renderToBuffer } = await import("@react-pdf/renderer").catch(() => {
    throw new Error("@react-pdf/renderer not available in this runtime");
  });
  const React = await import("react");
  const { Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");

  const styles = StyleSheet.create({
    page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
    header: { marginBottom: 20 },
    title: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
    subtitle: { fontSize: 11, color: "#666", marginBottom: 2 },
    section: { marginBottom: 16 },
    sectionTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 6, borderBottom: "1pt solid #e5e7eb", paddingBottom: 3 },
    row: { flexDirection: "row", marginBottom: 3 },
    col1: { width: "50%", paddingRight: 8 },
    col2: { width: "50%", paddingLeft: 8 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f3f4f6", padding: 5, fontWeight: "bold" },
    tableRow: { flexDirection: "row", padding: 5, borderBottom: "0.5pt solid #e5e7eb" },
    descCol: { width: "40%" },
    qtyCol: { width: "12%", textAlign: "right" },
    unitCol: { width: "12%", textAlign: "center" },
    priceCol: { width: "18%", textAlign: "right" },
    totalCol: { width: "18%", textAlign: "right" },
    totalsSection: { marginTop: 8, alignItems: "flex-end" },
    totalsRow: { flexDirection: "row", marginBottom: 3 },
    totalsLabel: { width: 120, textAlign: "right", paddingRight: 8 },
    totalsValue: { width: 80, textAlign: "right" },
    totalBold: { fontWeight: "bold", fontSize: 12 },
    warranty: { marginTop: 20, padding: 10, backgroundColor: "#f9fafb", fontSize: 8, color: "#4b5563", border: "0.5pt solid #d1d5db" },
    licenceLine: { marginTop: 8, fontSize: 9, color: "#6b7280" },
    footer: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#9ca3af", textAlign: "center" },
  });

  const formatAud = (n: number) => `A$${n.toFixed(2)}`;

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, data.businessName),
        data.abn
          ? React.createElement(Text, { style: styles.subtitle }, `ABN: ${data.abn}`)
          : null,
        React.createElement(Text, { style: styles.subtitle }, `NSW Contractor Licence: ${data.nswLicenceNumber}`),
        React.createElement(Text, { style: styles.subtitle }, `Quote #${data.quoteRef} — ${data.quoteDate}`)
      ),
      // Customer details
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Quote For"),
        React.createElement(Text, null, data.customerName),
        React.createElement(Text, null, data.address)
      ),
      // Line items table
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, "Itemised Quote"),
        // Table header
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.descCol }, "Description"),
          React.createElement(Text, { style: styles.qtyCol }, "Qty"),
          React.createElement(Text, { style: styles.unitCol }, "Unit"),
          React.createElement(Text, { style: styles.priceCol }, "Unit Price"),
          React.createElement(Text, { style: styles.totalCol }, "Total")
        ),
        // Table rows
        ...data.lineItems.map((item, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.descCol }, item.description),
            React.createElement(Text, { style: styles.qtyCol }, String(item.qty)),
            React.createElement(Text, { style: styles.unitCol }, item.unit),
            React.createElement(Text, { style: styles.priceCol }, formatAud(item.unit_price_aud)),
            React.createElement(Text, { style: styles.totalCol }, formatAud(item.qty * item.unit_price_aud))
          )
        )
      ),
      // Totals
      React.createElement(
        View,
        { style: styles.totalsSection },
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "Subtotal (ex GST):"),
          React.createElement(Text, { style: styles.totalsValue }, formatAud(data.subtotalAud))
        ),
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: styles.totalsLabel }, "GST (10%):"),
          React.createElement(Text, { style: styles.totalsValue }, formatAud(data.gstAud))
        ),
        React.createElement(
          View,
          { style: styles.totalsRow },
          React.createElement(Text, { style: [styles.totalsLabel, styles.totalBold] }, "Total (inc GST):"),
          React.createElement(Text, { style: [styles.totalsValue, styles.totalBold] }, formatAud(data.totalAud))
        )
      ),
      // Notes
      data.notes
        ? React.createElement(
            View,
            { style: { marginTop: 12 } },
            React.createElement(Text, { style: styles.sectionTitle }, "Notes"),
            React.createElement(Text, null, data.notes)
          )
        : null,
      // Statutory warranty
      React.createElement(
        View,
        { style: styles.warranty },
        React.createElement(Text, { style: { fontWeight: "bold", marginBottom: 4 } }, "STATUTORY WARRANTY — NSW HOME BUILDING ACT 1989"),
        React.createElement(Text, null, data.statutoryWarrantyText)
      ),
      React.createElement(
        Text,
        { style: styles.licenceLine },
        `NSW Contractor Licence No. ${data.nswLicenceNumber} | Quote generated by QuotingAgent`
      ),
      // Footer
      React.createElement(
        Text,
        { style: styles.footer },
        `${data.businessName} | ABN: ${data.abn ?? "N/A"} | NSW Licence: ${data.nswLicenceNumber} | QuotingAgent`
      )
    )
  );

  const pdfBuffer: Buffer = await renderToBuffer(doc);
  return pdfBuffer;
}

/**
 * Generate and store a quote PDF in GCS, returning a signed URL.
 */
export async function generateAndStorePdf(data: QuotePdfData): Promise<{
  gcsPath: string;
  signedUrl: string;
  expiresAt: string;
}> {
  const pdfBuffer = await generateQuotePdf(data);
  const gcsPath = `pdfs/${data.quoteId}/${data.quoteRef}.pdf`;

  await uploadBuffer(pdfBuffer, gcsPath, "application/pdf", {
    "quote-id": data.quoteId,
    "quote-ref": data.quoteRef,
  });

  const { signedUrl, expiresAt } = await generatePdfSignedUrl(gcsPath);

  logger.info({ gcsPath, quoteId: data.quoteId }, "pdf.generated");

  return { gcsPath, signedUrl, expiresAt };
}
