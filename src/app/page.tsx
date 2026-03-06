"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  type InvoiceData,
  type LineItem,
  defaultInvoice,
  calcLineAmount,
  calcTotals,
  formatCurrency,
  generateId,
} from "@/lib/invoice";

const PDFDownloadButton = dynamic(() => import("@/components/PDFDownloadButton"), { ssr: false });

/* ─────────────────────── helpers ─────────────────────── */

function updateItem(items: LineItem[], id: string, field: keyof LineItem, raw: string): LineItem[] {
  return items.map((it) => {
    if (it.id !== id) return it;
    const next = { ...it };
    if (field === "description") next.description = raw;
    else if (field === "quantity") next.quantity = Math.max(0, Number(raw) || 0);
    else if (field === "unitPrice") next.unitPrice = Math.max(0, Number(raw) || 0);
    next.amount = calcLineAmount(next.quantity, next.unitPrice);
    return next;
  });
}

/* ─────────────────────── component ─────────────────────── */

export default function HomePage() {
  const [inv, setInv] = useState<InvoiceData>(defaultInvoice);

  const set = useCallback(
    <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) =>
      setInv((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setItemField = useCallback(
    (id: string, field: keyof LineItem, raw: string) =>
      setInv((prev) => ({ ...prev, items: updateItem(prev.items, id, field, raw) })),
    [],
  );

  const addItem = useCallback(() => {
    const item: LineItem = { id: generateId(), description: "", quantity: 1, unitPrice: 0, amount: 0 };
    setInv((prev) => ({ ...prev, items: [...prev.items, item] }));
  }, []);

  const removeItem = useCallback(
    (id: string) => setInv((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) })),
    [],
  );

  const totals = calcTotals(inv.items, inv.taxRate, inv.discountPercent);

  /* ─── render ─── */
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 md:px-8">
      {/* Title bar */}
      <div className="max-w-5xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-blue-600">SwiftInvoice</h1>
        <PDFDownloadButton data={inv} />
      </div>

      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-10 space-y-10">

        {/* ── Invoice Meta ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Nomor Invoice" value={inv.invoiceNumber} onChange={(v) => set("invoiceNumber", v)} />
          <Input label="Tanggal" type="date" value={inv.invoiceDate} onChange={(v) => set("invoiceDate", v)} />
          <Input label="Jatuh Tempo" type="date" value={inv.dueDate} onChange={(v) => set("dueDate", v)} />
        </section>

        {/* ── Parties ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Dari (Pengirim)</legend>
            <Input label="Nama / Bisnis" value={inv.senderName} onChange={(v) => set("senderName", v)} />
            <Input label="Alamat" value={inv.senderAddress} onChange={(v) => set("senderAddress", v)} />
            <Input label="Email" type="email" value={inv.senderEmail} onChange={(v) => set("senderEmail", v)} />
            <Input label="Telepon" value={inv.senderPhone} onChange={(v) => set("senderPhone", v)} />
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Kepada (Klien)</legend>
            <Input label="Nama / Bisnis" value={inv.clientName} onChange={(v) => set("clientName", v)} />
            <Input label="Alamat" value={inv.clientAddress} onChange={(v) => set("clientAddress", v)} />
            <Input label="Email" type="email" value={inv.clientEmail} onChange={(v) => set("clientEmail", v)} />
          </fieldset>
        </div>

        {/* ── Line Items ── */}
        <section>
          <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Item</h2>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[1fr_80px_130px_130px_40px] gap-2 text-xs font-medium text-gray-500 mb-1 px-1">
            <span>Deskripsi</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Harga Satuan</span>
            <span className="text-right">Jumlah</span>
            <span />
          </div>

          <div className="space-y-2">
            {inv.items.map((item) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_80px_130px_130px_40px] gap-2 items-center bg-gray-50 rounded-lg p-2">
                <input
                  className="input"
                  placeholder="Deskripsi item…"
                  value={item.description}
                  onChange={(e) => setItemField(item.id, "description", e.target.value)}
                />
                <input
                  className="input text-center"
                  type="number"
                  min={0}
                  value={item.quantity}
                  onChange={(e) => setItemField(item.id, "quantity", e.target.value)}
                />
                <input
                  className="input text-right"
                  type="number"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) => setItemField(item.id, "unitPrice", e.target.value)}
                />
                <span className="text-right text-sm font-medium pr-1">{formatCurrency(item.amount)}</span>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none cursor-pointer"
                  aria-label="Hapus item"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
          >
            + Tambah Item
          </button>
        </section>

        {/* ── Tax, Discount, Notes ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Input label="Diskon (%)" type="number" value={String(inv.discountPercent)} onChange={(v) => set("discountPercent", Math.max(0, Math.min(100, Number(v) || 0)))} />
            <Input label="Pajak (%)" type="number" value={String(inv.taxRate)} onChange={(v) => set("taxRate", Math.max(0, Number(v) || 0))} />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={inv.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>

          {/* Totals summary */}
          <div className="flex flex-col items-end justify-end space-y-1 text-sm">
            <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
            {inv.discountPercent > 0 && <Row label={`Diskon (${inv.discountPercent}%)`} value={`-${formatCurrency(totals.discount)}`} />}
            {inv.taxRate > 0 && <Row label={`Pajak (${inv.taxRate}%)`} value={formatCurrency(totals.tax)} />}
            <div className="w-56 flex justify-between border-t-2 border-blue-600 pt-2 mt-2">
              <span className="font-bold text-blue-600 text-base">Total</span>
              <span className="font-bold text-blue-600 text-base">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─────────────────── tiny sub-components ─────────────────── */

function Input({ label, value, onChange, type = "text" }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-56 flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
