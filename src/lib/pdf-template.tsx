import React from "react";
import {
  Document,
  Page,
  Text,
  View,
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
  invoiceTitle: { fontSize: 12, fontWeight: "bold", textAlign: "right", color: blue, marginBottom: 4 },
  metaText: { fontSize: 9, color: gray, textAlign: "right" },

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
  colDesc: { width: "45%", fontSize: 9 },
  colQty: { width: "15%", fontSize: 9, textAlign: "center" },
  colPrice: { width: "20%", fontSize: 9, textAlign: "right" },
  colAmount: { width: "20%", fontSize: 9, textAlign: "right" },
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
});

export function InvoicePDF({ data }: { data: InvoiceData }) {
  const totals = calcTotals(data.items, data.taxRate, data.discountPercent);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.brandName}>{data.senderName || "Nama Bisnis"}</Text>
          </View>
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.metaText}>{data.invoiceNumber}</Text>
            <Text style={s.metaText}>Tanggal: {data.invoiceDate}</Text>
            {data.dueDate && <Text style={s.metaText}>Jatuh tempo: {data.dueDate}</Text>}
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
          <Text style={[s.colAmount, s.colHeaderText]}>Jumlah</Text>
        </View>

        {/* ── Table Rows ── */}
        {data.items.map((item, i) => (
          <View key={item.id} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
            <Text style={s.colDesc}>{item.description || "-"}</Text>
            <Text style={s.colQty}>{item.quantity}</Text>
            <Text style={s.colPrice}>{formatCurrency(item.unitPrice)}</Text>
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

        {/* ── Footer ── */}
        <Text style={s.footer}>
          Dibuat dengan SwiftInvoice • {data.invoiceNumber}
        </Text>
      </Page>
    </Document>
  );
}
