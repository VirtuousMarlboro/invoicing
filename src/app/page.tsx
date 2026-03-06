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
import ThemeToggle from "@/components/ThemeToggle";

const PDFDownloadButton = dynamic(() => import("@/components/PDFDownloadButton"), { ssr: false });
const PDFPreview = dynamic(() => import("@/components/PDFPreview"), { ssr: false });

/* ───── types for saved data ───── */

interface SenderProfile {
  id: number; name: string; business: string; senderName: string;
  address: string; email: string; phone: string; logo: string;
  bankName: string; bankAccount: string; accountHolder: string;
}
interface SavedClient { id: number; name: string; address: string; email: string; }
interface SavedProduct { id: number; name: string; price: number; }

/* ─────────────────────── helpers ─────────────────────── */

function updateItem(items: LineItem[], id: string, field: keyof LineItem, raw: string): LineItem[] {
  return items.map((it) => {
    if (it.id !== id) return it;
    const next = { ...it };
    if (field === "description") next.description = raw;
    else if (field === "quantity") next.quantity = Math.max(0, Number(raw) || 0);
    else if (field === "unitPrice") next.unitPrice = Math.max(0, Number(raw) || 0);
    else if (field === "discount") next.discount = Math.max(0, Math.min(100, Number(raw) || 0));
    next.amount = calcLineAmount(next.quantity, next.unitPrice, next.discount);
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

  // Saved data
  const [profiles, setProfiles] = useState<SenderProfile[]>([]);
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);

  // Load saved data + invoice
  useEffect(() => {
    fetch("/api/profiles").then((r) => r.json()).then(setProfiles).catch(() => {});
    fetch("/api/clients").then((r) => r.json()).then(setClients).catch(() => {});
    fetch("/api/products").then((r) => r.json()).then(setProducts).catch(() => {});

    if (editId) {
      fetch(`/api/invoices/${editId}`)
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((data) => {
          if (data.id) {
            // Backward compat: ensure items have discount field
            const items = (data.items || []).map((item: LineItem) => ({
              ...item,
              discount: item.discount ?? 0,
            }));
            setInv({ ...defaultInvoice(), ...data, items });
          }
        })
        .catch(() => {});
    } else {
      fetch("/api/invoices/next-number")
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(({ invoiceNumber }) => {
          setInv((prev) => ({ ...prev, invoiceNumber }));
        })
        .catch(() => {});
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
    const item: LineItem = { id: generateId(), description: "", quantity: 1, unitPrice: 0, discount: 0, amount: 0 };
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

  // ── Profile functions ──
  async function saveProfile() {
    const name = prompt("Nama profil:");
    if (!name?.trim()) return;
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        business: inv.senderBusiness, senderName: inv.senderName,
        address: inv.senderAddress, email: inv.senderEmail,
        phone: inv.senderPhone, logo: inv.senderLogo,
        bankName: inv.paymentBankName, bankAccount: inv.paymentBankAccount,
        accountHolder: inv.paymentAccountHolder,
      }),
    });
    const profile = await res.json();
    setProfiles((prev) => [profile, ...prev]);
  }

  function loadProfile(id: number) {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    setInv((prev) => ({
      ...prev,
      senderBusiness: p.business, senderName: p.senderName,
      senderAddress: p.address, senderEmail: p.email,
      senderPhone: p.phone, senderLogo: p.logo,
      paymentBankName: p.bankName, paymentBankAccount: p.bankAccount,
      paymentAccountHolder: p.accountHolder,
    }));
    setSaved(false);
  }

  // ── Client functions ──
  async function saveClientData() {
    if (!inv.clientName.trim()) return;
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inv.clientName, address: inv.clientAddress, email: inv.clientEmail }),
    });
    const client = await res.json();
    setClients((prev) => [client, ...prev]);
  }

  function loadClient(id: number) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setInv((prev) => ({ ...prev, clientName: c.name, clientAddress: c.address, clientEmail: c.email }));
    setSaved(false);
  }

  // ── Product functions ──
  function addFromProduct(id: number) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const item: LineItem = {
      id: generateId(), description: p.name, quantity: 1,
      unitPrice: p.price, discount: 0, amount: calcLineAmount(1, p.price, 0),
    };
    setInv((prev) => ({ ...prev, items: [...prev.items, item] }));
    setSaved(false);
  }

  async function saveAsProduct(item: LineItem) {
    if (!item.description.trim()) return;
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: item.description, price: item.unitPrice }),
    });
    const product = await res.json();
    setProducts((prev) => [product, ...prev]);
  }

  // Save to DB
  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inv),
      });
      if (!res.ok) throw new Error("Save failed");
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
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ invoiceNumber }) => {
        const fresh = defaultInvoice();
        fresh.invoiceNumber = invoiceNumber;
        setInv(fresh);
        window.history.replaceState(null, "", "/");
        setSaved(false);
      })
      .catch(() => {});
  }

  const totals = calcTotals(inv.items, inv.taxRate, inv.discountPercent);

  /* ─── render ─── */
  return (
    <main className="min-h-screen py-8 px-4 md:px-8">
      {/* Title bar */}
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-blue-600">SwiftInvoice</h1>
          <Link href="/history" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
            Riwayat
          </Link>
          <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
            Dashboard
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeToggle />
          <button
            type="button"
            onClick={handleNew}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer transition-colors"
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
            className="px-4 py-2 rounded-lg text-sm font-medium border border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 cursor-pointer transition-colors"
          >
            {showPreview ? "Tutup Preview" : "Preview PDF"}
          </button>
          <PDFDownloadButton data={inv} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex gap-6">
        {/* ── Form Column ── */}
        <div className={`${showPreview ? "w-1/2" : "w-full max-w-5xl mx-auto"} bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 md:p-10 space-y-10 transition-all`}>

          {/* ── Invoice Meta ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Nomor Invoice</label>
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
                className={`input ${autoNumber ? "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400" : ""}`}
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
              <div className="flex items-center justify-between mb-1">
                <legend className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Dari (Pengirim)</legend>
                <div className="flex items-center gap-2">
                  {profiles.length > 0 && (
                    <select className="text-xs border rounded-md px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 cursor-pointer" defaultValue="" onChange={(e) => { if (e.target.value) loadProfile(Number(e.target.value)); e.target.value = ""; }}>
                      <option value="" disabled>Pilih Profil…</option>
                      {profiles.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                  )}
                  <button type="button" onClick={saveProfile} className="text-[10px] text-blue-500 hover:underline cursor-pointer whitespace-nowrap">Simpan Profil</button>
                </div>
              </div>
              <LogoUpload value={inv.senderLogo} onChange={(v) => set("senderLogo", v)} />
              <Input label="Nama Bisnis" value={inv.senderBusiness} onChange={(v) => set("senderBusiness", v)} />
              <Input label="Nama Pengirim" value={inv.senderName} onChange={(v) => set("senderName", v)} />
              <Input label="Alamat" value={inv.senderAddress} onChange={(v) => set("senderAddress", v)} />
              <Input label="Email" type="email" value={inv.senderEmail} onChange={(v) => set("senderEmail", v)} />
              <Input label="Telepon" value={inv.senderPhone} onChange={(v) => set("senderPhone", v)} />
            </fieldset>
            <fieldset className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <legend className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Kepada (Klien)</legend>
                <div className="flex items-center gap-2">
                  {clients.length > 0 && (
                    <select className="text-xs border rounded-md px-2 py-1 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 cursor-pointer" defaultValue="" onChange={(e) => { if (e.target.value) loadClient(Number(e.target.value)); e.target.value = ""; }}>
                      <option value="" disabled>Pilih Klien…</option>
                      {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                    </select>
                  )}
                  <button type="button" onClick={saveClientData} className="text-[10px] text-blue-500 hover:underline cursor-pointer whitespace-nowrap">Simpan Klien</button>
                </div>
              </div>
              <Input label="Nama / Bisnis" value={inv.clientName} onChange={(v) => set("clientName", v)} />
              <Input label="Alamat" value={inv.clientAddress} onChange={(v) => set("clientAddress", v)} />
              <Input label="Email" type="email" value={inv.clientEmail} onChange={(v) => set("clientEmail", v)} />
            </fieldset>
          </div>

          {/* ── Line Items ── */}
          <section>
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Item</h2>

            <div className="hidden md:grid grid-cols-[1fr_70px_120px_80px_120px_36px] gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 px-1">
              <span>Deskripsi</span>
              <span className="text-center">Qty</span>
              <span className="text-right">Harga Satuan</span>
              <span className="text-center">Diskon %</span>
              <span className="text-right">Jumlah</span>
              <span />
            </div>

            <div className="space-y-2">
              {inv.items.map((item) => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_70px_120px_80px_120px_36px] gap-2 items-center bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
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
                  <input
                    className="input text-center"
                    type="number"
                    min={0}
                    max={100}
                    value={item.discount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setItemField(item.id, "discount", e.target.value)}
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

            <div className="mt-3 flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={addItem}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
              >
                + Tambah Item
              </button>
              {products.length > 0 && (
                <select
                  className="text-sm border rounded-md px-2 py-1 text-gray-600 dark:bg-slate-700 dark:border-slate-600 dark:text-gray-300 cursor-pointer"
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) addFromProduct(Number(e.target.value)); e.target.value = ""; }}
                >
                  <option value="" disabled>+ Dari Produk Tersimpan…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>
                  ))}
                </select>
              )}
            </div>
          </section>

          {/* ── Tax, Discount, Notes ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Input label="Diskon Global (%)" type="number" value={String(inv.discountPercent)} onChange={(v) => set("discountPercent", Math.max(0, Math.min(100, Number(v) || 0)))} />
              <Input label="Pajak (%)" type="number" value={String(inv.taxRate)} onChange={(v) => set("taxRate", Math.max(0, Number(v) || 0))} />
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catatan</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
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

          {/* ── Payment Info ── */}
          <section>
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Informasi Pembayaran</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Nama Bank" value={inv.paymentBankName} onChange={(v) => set("paymentBankName", v)} />
              <Input label="Nomor Rekening" value={inv.paymentBankAccount} onChange={(v) => set("paymentBankAccount", v)} />
              <Input label="Atas Nama" value={inv.paymentAccountHolder} onChange={(v) => set("paymentAccountHolder", v)} />
            </div>
          </section>

          {/* ── Signature ── */}
          <SignatureUpload value={inv.signature} onChange={(v) => set("signature", v)} />

          {/* ── Save Items as Products ── */}
          {inv.items.some((i) => i.description.trim()) && (
            <section>
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Simpan Item Sebagai Produk</h2>
              <div className="flex flex-wrap gap-2">
                {inv.items.filter((i) => i.description.trim()).map((item) => (
                  <button key={item.id} type="button" onClick={() => saveAsProduct(item)}
                    className="text-xs px-3 py-1 rounded-full border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    + {item.description}
                  </button>
                ))}
              </div>
            </section>
          )}
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Kirim Invoice via Email</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kepada</label>
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@klien.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subjek</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pesan</label>
            <textarea className="w-full rounded-lg border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>

        {result?.error && <p className="text-sm text-red-500">{result.error}</p>}
        {result?.ok && <p className="text-sm text-green-600">Email berhasil dikirim!</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
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
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        className={`input ${readOnly ? "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400" : ""}`}
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
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
