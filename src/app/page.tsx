"use client";

import React, { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  type InvoiceData,
  type LineItem,
  defaultInvoice,
  calcLineAmount,
  calcTotals,
  formatCurrency,
  generateId,
} from "@/lib/invoice";
import LogoUpload from "@/components/LogoUpload";
import SignatureUpload from "@/components/SignatureUpload";

const PDFDownloadButton = dynamic(() => import("@/components/PDFDownloadButton"), { ssr: false });
const PDFPreview = dynamic(() => import("@/components/PDFPreview"), { ssr: false });

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

/* ─────────────────── page wrapper with Suspense ────────────────── */

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Memuat…</div>}>
      <HomePage />
    </Suspense>
  );
}

/* ─────────────────────── component ─────────────────────── */

function HomePage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [inv, setInv] = useState<InvoiceData>(defaultInvoice);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [autoNumber, setAutoNumber] = useState(true);

  // Load invoice from DB if editing, or fetch next number for new
  useEffect(() => {
    if (editId) {
      fetch(`/api/invoices/${editId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.id) setInv(data);
        });
    } else {
      fetch("/api/invoices/next-number")
        .then((r) => r.json())
        .then(({ invoiceNumber }) => {
          setInv((prev) => ({ ...prev, invoiceNumber }));
        });
    }
  }, [editId]);

  const set = useCallback(
    <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
      setInv((prev) => ({ ...prev, [key]: value }));
      setSaved(false);
    },
    [],
  );

  const setItemField = useCallback(
    (id: string, field: keyof LineItem, raw: string) => {
      setInv((prev) => ({ ...prev, items: updateItem(prev.items, id, field, raw) }));
      setSaved(false);
    },
    [],
  );

  const addItem = useCallback(() => {
    const item: LineItem = { id: generateId(), description: "", quantity: 1, unitPrice: 0, amount: 0 };
    setInv((prev) => ({ ...prev, items: [...prev.items, item] }));
    setSaved(false);
  }, []);

  const removeItem = useCallback(
    (id: string) => {
      setInv((prev) => ({ ...prev, items: prev.items.filter((i) => i.id !== id) }));
      setSaved(false);
    },
    [],
  );

  // Save to DB
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inv),
      });
      const data = await res.json();
      if (data.id && !inv.id) {
        setInv((prev) => ({ ...prev, id: data.id }));
        window.history.replaceState(null, "", `/?id=${data.id}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  // New invoice
  function handleNew() {
    fetch("/api/invoices/next-number")
      .then((r) => r.json())
      .then(({ invoiceNumber }) => {
        const fresh = defaultInvoice();
        fresh.invoiceNumber = invoiceNumber;
        setInv(fresh);
        window.history.replaceState(null, "", "/");
        setSaved(false);
      });
  }

  const totals = calcTotals(inv.items, inv.taxRate, inv.discountPercent);

  /* ─── render ─── */
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4 md:px-8">
      {/* Title bar */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-blue-600">SwiftInvoice</h1>
          <Link href="/history" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
            Riwayat
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleNew}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors"
          >
            + Baru
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {saving ? "Menyimpan…" : saved ? "✓ Tersimpan" : "Simpan"}
          </button>
          {inv.id && (
            <button
              type="button"
              onClick={() => setShowEmailModal(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 cursor-pointer transition-colors"
            >
              Kirim Email
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-blue-300 text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
          >
            {showPreview ? "Tutup Preview" : "Preview PDF"}
          </button>
          <PDFDownloadButton data={inv} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex gap-6">
        {/* ── Form Column ── */}
        <div className={`${showPreview ? "w-1/2" : "w-full max-w-5xl mx-auto"} bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-10 space-y-10 transition-all`}>

          {/* ── Invoice Meta ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-600">Nomor Invoice</label>
                <button
                  type="button"
                  onClick={() => {
                    setAutoNumber((prev) => {
                      if (!prev) {
                        // switching to auto → fetch next number
                        fetch("/api/invoices/next-number")
                          .then((r) => r.json())
                          .then(({ invoiceNumber }) => set("invoiceNumber", invoiceNumber));
                      }
                      return !prev;
                    });
                  }}
                  className="text-[10px] text-blue-500 hover:underline cursor-pointer"
                >
                  {autoNumber ? "Input manual" : "Otomatis"}
                </button>
              </div>
              <input
                className={`input ${autoNumber ? "bg-gray-100 text-gray-500" : ""}`}
                value={inv.invoiceNumber}
                readOnly={autoNumber}
                onChange={(e) => set("invoiceNumber", e.target.value)}
                placeholder={autoNumber ? "" : "Masukkan nomor invoice…"}
              />
            </div>
            <Input label="Tanggal" type="date" value={inv.invoiceDate} onChange={(v) => set("invoiceDate", v)} />
            <Input label="Jatuh Tempo" type="date" value={inv.dueDate} onChange={(v) => set("dueDate", v)} />
          </section>

          {/* ── Parties ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Dari (Pengirim)</legend>
              <LogoUpload value={inv.senderLogo} onChange={(v) => set("senderLogo", v)} />
              <Input label="Nama Bisnis" value={inv.senderBusiness} onChange={(v) => set("senderBusiness", v)} />
              <Input label="Nama Pengirim" value={inv.senderName} onChange={(v) => set("senderName", v)} />
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
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setItemField(item.id, "quantity", e.target.value)}
                  />
                  <input
                    className="input text-right"
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onFocus={(e) => e.target.select()}
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

          {/* ── Signature ── */}
          <SignatureUpload value={inv.signature} onChange={(v) => set("signature", v)} />
        </div>

        {/* ── PDF Preview Column ── */}
        {showPreview && (
          <div className="w-1/2 sticky top-8 h-[calc(100vh-4rem)]">
            <PDFPreview data={inv} />
          </div>
        )}
      </div>

      {/* ── Email Modal ── */}
      {showEmailModal && (
        <EmailModal
          invoiceId={inv.id!}
          invoiceNumber={inv.invoiceNumber}
          clientEmail={inv.clientEmail}
          onClose={() => setShowEmailModal(false)}
        />
      )}
    </main>
  );
}

/* ─────────────────── Email Modal ─────────────────── */

function EmailModal({
  invoiceId,
  invoiceNumber,
  clientEmail,
  onClose,
}: {
  invoiceId: number;
  invoiceNumber: string;
  clientEmail: string;
  onClose: () => void;
}) {
  const [to, setTo] = useState(clientEmail);
  const [subject, setSubject] = useState(`Invoice ${invoiceNumber}`);
  const [message, setMessage] = useState(`Berikut terlampir invoice ${invoiceNumber}.\n\nTerima kasih.`);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, to, subject, message }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true });
        setTimeout(onClose, 1500);
      } else {
        setResult({ error: data.error || "Gagal mengirim email" });
      }
    } catch {
      setResult({ error: "Network error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800">Kirim Invoice via Email</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kepada</label>
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@klien.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subjek</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Pesan</label>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        {result?.error && <p className="text-sm text-red-500">{result.error}</p>}
        {result?.ok && <p className="text-sm text-green-600">Email berhasil dikirim!</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
            Batal
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !to}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {sending ? "Mengirim…" : "Kirim"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── tiny sub-components ─────────────────── */

function Input({ label, value, onChange, type = "text", readOnly = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        className={`input ${readOnly ? "bg-gray-100 text-gray-500" : ""}`}
        value={value}
        readOnly={readOnly}
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
