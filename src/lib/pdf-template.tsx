import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceData } from "./invoice";
import { calcTotals, formatCurrency } from "./invoice";

Font.register({
  family: "Helvetica",
  src: undefined as unknown as string, // built-in font
});

const blue = "#2563eb";
const gray = "#6b7280";
const lightGray = "#f3f4f6";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },

  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  brandName: { fontSize: 22, fontWeight: "bold", color: blue },
  invoiceTitle: { fontSize: 12, fontWeight: "bold", color: blue, marginBottom: 4 },
  metaText: { fontSize: 9, color: gray },

  // Parties
  partiesRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  partyBlock: { width: "48%" },
  partyLabel: { fontSize: 8, fontWeight: "bold", color: blue, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: "bold", marginBottom: 2 },
  partyDetail: { fontSize: 9, color: gray, lineHeight: 1.5 },

  // Table
  tableHeader: { flexDirection: "row", backgroundColor: blue, color: "#fff", padding: 6, borderRadius: 2 },
  tableRow: { flexDirection: "row", padding: 6, borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb" },
  tableRowAlt: { backgroundColor: lightGray },
  colDesc: { width: "35%", fontSize: 9 },
  colQty: { width: "10%", fontSize: 9, textAlign: "center" },
  colPrice: { width: "20%", fontSize: 9, textAlign: "right" },
  colDisc: { width: "10%", fontSize: 9, textAlign: "center" },
  colAmount: { width: "25%", fontSize: 9, textAlign: "right" },
  colHeaderText: { fontSize: 9, fontWeight: "bold", color: "#fff" },

  // Totals
  totalsBlock: { marginTop: 16, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 220, justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: gray },
  totalsValue: { fontSize: 9, fontWeight: "bold" },
  grandTotalRow: { flexDirection: "row", width: 220, justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1.5, borderTopColor: blue, marginTop: 4 },
  grandTotalLabel: { fontSize: 12, fontWeight: "bold", color: blue },
  grandTotalValue: { fontSize: 12, fontWeight: "bold", color: blue },

  // Notes
  notesBlock: { marginTop: 30, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#e5e7eb" },
  notesTitle: { fontSize: 9, fontWeight: "bold", color: blue, marginBottom: 4 },
  notesText: { fontSize: 9, color: gray, lineHeight: 1.5 },

  // Footer
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: gray },

  // Logo
  logo: { width: 60, height: 60, objectFit: "contain" as const },

  // Signature
  signatureBlock: { marginTop: 30, alignItems: "flex-end" },
  signatureInner: { alignItems: "center" },
  signatureLabel: { fontSize: 8, color: gray, marginBottom: 4 },
  signatureImage: { width: 120, height: 50, objectFit: "contain" as const },
  signatureName: { fontSize: 9, fontWeight: "bold", marginTop: 4, borderTopWidth: 0.5, borderTopColor: gray, paddingTop: 4, minWidth: 120, textAlign: "center" as const },

  // Payment info
  paymentBlock: { marginTop: 24, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#e5e7eb" },
  paymentTitle: { fontSize: 9, fontWeight: "bold", color: blue, marginBottom: 4 },
  paymentText: { fontSize: 9, color: gray, lineHeight: 1.5 },

  // Receipt mode
  receiptCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
    backgroundColor: "#f8fbff",
  },
  receiptMetaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  receiptMetaItem: { width: "48%" },
  receiptLabel: { fontSize: 8, color: gray, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.6 },
  receiptValue: { fontSize: 10, fontWeight: "bold", color: "#1f2937" },
  receiptSection: { marginTop: 10 },
  receiptText: { fontSize: 9, color: "#374151", lineHeight: 1.5 },
  receiptAmountBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#eff6ff",
    alignItems: "center",
  },
  receiptAmountLabel: { fontSize: 8, color: gray, textTransform: "uppercase", letterSpacing: 1 },
  receiptAmountValue: { fontSize: 18, fontWeight: "bold", color: blue, marginTop: 2 },
  receiptDivider: { borderTopWidth: 0.5, borderTopColor: "#e5e7eb", marginTop: 12, paddingTop: 10 },

  // Watermark
  paidWatermarkText: {
    position: "absolute",
    top: "43%",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 56,
    fontWeight: "bold",
    color: "#16a34a",
    opacity: 0.18,
    transform: "rotate(-24deg)",
    letterSpacing: 2,
  },
  paidWatermarkCircleWrap: {
    position: "absolute",
    top: "36%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  paidWatermarkCircle: {
    width: 260,
    height: 260,
    borderWidth: 1,
    borderColor: "#16a34a",
    borderRadius: 130,
    opacity: 0.16,
    transform: "rotate(-24deg)",
  },
});

export function InvoicePDF({ data, mode = "invoice" }: { data: InvoiceData; mode?: "invoice" | "receipt" }) {
  const isReceipt = mode === "receipt";
  const totals = calcTotals(data.items, data.taxRate, data.discountPercent);
  const paidStamp = data.status === "paid";

  if (isReceipt) {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          {paidStamp ? (
            <>
              <View style={s.paidWatermarkCircleWrap}>
                <View style={s.paidWatermarkCircle} />
              </View>
              <Text style={s.paidWatermarkText}>LUNAS</Text>
            </>
          ) : null}

          {/* Receipt header */}
          <View style={s.headerRow}>
            <View>
              <Text style={s.invoiceTitle}>KWITANSI</Text>
              <Text style={s.metaText}>No. Nota: {data.invoiceNumber}</Text>
              <Text style={s.metaText}>Tanggal Nota: {data.invoiceDate}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              {data.senderLogo ? <Image src={data.senderLogo} style={s.logo} /> : null}
              {data.senderBusiness ? <Text style={s.brandName}>{data.senderBusiness}</Text> : null}
            </View>
          </View>

          {/* Receipt body */}
          <View style={s.receiptCard}>
            <View style={s.receiptMetaRow}>
              <View style={s.receiptMetaItem}>
                <Text style={s.receiptLabel}>Penerbit</Text>
                <Text style={s.receiptValue}>{data.senderName || "-"}</Text>
                {data.senderAddress ? <Text style={s.receiptText}>{data.senderAddress}</Text> : null}
              </View>
              <View style={s.receiptMetaItem}>
                <Text style={s.receiptLabel}>Diterima Dari</Text>
                <Text style={s.receiptValue}>{data.clientName || "-"}</Text>
                {data.clientAddress ? <Text style={s.receiptText}>{data.clientAddress}</Text> : null}
              </View>
            </View>

            <View style={s.receiptSection}>
              <Text style={s.receiptLabel}>Untuk Pembayaran</Text>
              {data.items.length === 0 ? (
                <Text style={s.receiptText}>-</Text>
              ) : (
                data.items.map((item) => (
                  <Text key={item.id} style={s.receiptText}>
                    - {item.description || "Item"} ({item.quantity} x {formatCurrency(item.unitPrice)})
                  </Text>
                ))
              )}
            </View>

            <View style={s.receiptAmountBox}>
              <Text style={s.receiptAmountLabel}>Jumlah Diterima</Text>
              <Text style={s.receiptAmountValue}>{formatCurrency(totals.grandTotal)}</Text>
            </View>

            <View style={s.receiptDivider}>
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Subtotal</Text>
                <Text style={s.totalsValue}>{formatCurrency(totals.subtotal)}</Text>
              </View>
              {data.discountPercent > 0 && (
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>Diskon ({data.discountPercent}%)</Text>
                  <Text style={s.totalsValue}>-{formatCurrency(totals.discount)}</Text>
                </View>
              )}
              {data.taxRate > 0 && (
                <View style={s.totalsRow}>
                  <Text style={s.totalsLabel}>Pajak ({data.taxRate}%)</Text>
                  <Text style={s.totalsValue}>{formatCurrency(totals.tax)}</Text>
                </View>
              )}
            </View>

            {(data.paymentBankName || data.paymentBankAccount) ? (
              <View style={s.receiptDivider}>
                <Text style={s.paymentTitle}>Detail Pembayaran</Text>
                {data.paymentBankName ? <Text style={s.paymentText}>Bank: {data.paymentBankName}</Text> : null}
                {data.paymentBankAccount ? <Text style={s.paymentText}>No. Rekening: {data.paymentBankAccount}</Text> : null}
                {data.paymentAccountHolder ? <Text style={s.paymentText}>Atas Nama: {data.paymentAccountHolder}</Text> : null}
              </View>
            ) : null}

            {data.notes ? (
              <View style={s.receiptDivider}>
                <Text style={s.notesTitle}>Catatan</Text>
                <Text style={s.notesText}>{data.notes}</Text>
              </View>
            ) : null}
          </View>

          {data.signature ? (
            <View style={s.signatureBlock}>
              <View style={s.signatureInner}>
                <Text style={s.signatureLabel}>Tanda Tangan Penerbit</Text>
                <Image src={data.signature} style={s.signatureImage} />
                {data.senderName ? <Text style={s.signatureName}>{data.senderName}</Text> : null}
              </View>
            </View>
          ) : null}

          <Text style={s.footer}>Kwitansi dibuat dengan SwiftInvoice • {data.invoiceNumber}</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {paidStamp ? (
          <>
            <View style={s.paidWatermarkCircleWrap}>
              <View style={s.paidWatermarkCircle} />
            </View>
            <Text style={s.paidWatermarkText}>LUNAS</Text>
          </>
        ) : null}

        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.metaText}>No. Invoice: {data.invoiceNumber}</Text>
            <Text style={s.metaText}>Tanggal: {data.invoiceDate}</Text>
            {data.dueDate && <Text style={s.metaText}>Jatuh tempo: {data.dueDate}</Text>}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
            {data.senderLogo ? (
              <Image src={data.senderLogo} style={s.logo} />
            ) : null}
            {data.senderBusiness ? <Text style={s.brandName}>{data.senderBusiness}</Text> : null}
          </View>
        </View>

        {/* ── Parties ── */}
        <View style={s.partiesRow}>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>Dari</Text>
            <Text style={s.partyName}>{data.senderName}</Text>
            <Text style={s.partyDetail}>{data.senderAddress}</Text>
            {data.senderEmail && <Text style={s.partyDetail}>{data.senderEmail}</Text>}
            {data.senderPhone && <Text style={s.partyDetail}>{data.senderPhone}</Text>}
          </View>
          <View style={s.partyBlock}>
            <Text style={s.partyLabel}>Kepada</Text>
            <Text style={s.partyName}>{data.clientName}</Text>
            <Text style={s.partyDetail}>{data.clientAddress}</Text>
            {data.clientEmail && <Text style={s.partyDetail}>{data.clientEmail}</Text>}
          </View>
        </View>

        {/* ── Table Header ── */}
        <View style={s.tableHeader}>
          <Text style={[s.colDesc, s.colHeaderText]}>Deskripsi</Text>
          <Text style={[s.colQty, s.colHeaderText]}>Qty</Text>
          <Text style={[s.colPrice, s.colHeaderText]}>Harga Satuan</Text>
          <Text style={[s.colDisc, s.colHeaderText]}>Diskon</Text>
          <Text style={[s.colAmount, s.colHeaderText]}>Jumlah</Text>
        </View>

        {/* ── Table Rows ── */}
        {data.items.map((item, i) => (
          <View key={item.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
            <Text style={s.colDesc}>{item.description || "-"}</Text>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colPrice}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={s.colDisc}>{(item.discount || 0) > 0 ? `${item.discount}%` : "-"}</Text>
            <Text style={s.colAmount}>{formatCurrency(item.amount)}</Text>
          </View>
        ))}

        {/* ── Totals ── */}
        <View style={s.totalsBlock}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text style={s.totalsValue}>{formatCurrency(totals.subtotal)}</Text>
          </View>
          {data.discountPercent > 0 && (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Diskon ({data.discountPercent}%)</Text>
              <Text style={s.totalsValue}>-{formatCurrency(totals.discount)}</Text>
            </View>
          )}
          {data.taxRate > 0 && (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Pajak ({data.taxRate}%)</Text>
              <Text style={s.totalsValue}>{formatCurrency(totals.tax)}</Text>
            </View>
          )}
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>Total</Text>
            <Text style={s.grandTotalValue}>{formatCurrency(totals.grandTotal)}</Text>
          </View>
        </View>

        {/* ── Notes ── */}
        {data.notes && (
          <View style={s.notesBlock}>
            <Text style={s.notesTitle}>Catatan</Text>
            <Text style={s.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* ── Payment Info ── */}
        {(data.paymentBankName || data.paymentBankAccount) ? (
          <View style={s.paymentBlock}>
            <Text style={s.paymentTitle}>Informasi Pembayaran</Text>
            {data.paymentBankName ? <Text style={s.paymentText}>Bank: {data.paymentBankName}</Text> : null}
            {data.paymentBankAccount ? <Text style={s.paymentText}>No. Rekening: {data.paymentBankAccount}</Text> : null}
            {data.paymentAccountHolder ? <Text style={s.paymentText}>Atas Nama: {data.paymentAccountHolder}</Text> : null}
          </View>
        ) : null}

        {/* ── Signature ── */}
        {data.signature ? (
          <View style={s.signatureBlock}>
            <View style={s.signatureInner}>
              <Text style={s.signatureLabel}>Tanda Tangan</Text>
              <Image src={data.signature} style={s.signatureImage} />
              {data.senderName ? <Text style={s.signatureName}>{data.senderName}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* ── Footer ── */}
        <Text style={s.footer}>
          Invoice dibuat dengan SwiftInvoice • {data.invoiceNumber}
        </Text>
      </Page>
    </Document>
  );
}
