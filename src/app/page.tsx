"use client";

import React, { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { pdf } from "@react-pdf/renderer";
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
import { InvoicePDF } from "@/lib/pdf-template";
import AppToast, { type ToastMessage } from "@/components/AppToast";
import ConfirmDialog from "@/components/ConfirmDialog";

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
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

const STATUS_OPTIONS: Array<{ value: InvoiceStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Terkirim" },
  { value: "paid", label: "Lunas" },
  { value: "overdue", label: "Jatuh Tempo" },
];

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
  const [savingProductItemIds, setSavingProductItemIds] = useState<string[]>([]);
  const [hiddenProductItemIds, setHiddenProductItemIds] = useState<string[]>([]);
  const [generatingNota, setGeneratingNota] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showSaveProfileModal, setShowSaveProfileModal] = useState(false);
  const [profileDraftName, setProfileDraftName] = useState("");
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Saved data
  const [profiles, setProfiles] = useState<SenderProfile[]>([]);
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [products, setProducts] = useState<SavedProduct[]>([]);

  const pushToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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
      setInv((prev) => {
        const idx = prev.items.findIndex((i) => i.id === id);
        if (idx === -1) return prev;
        if (prev.items.length <= 1) {
          pushToast({ kind: "info", text: "Minimal harus ada 1 item." });
          return prev;
        }
        const removed = prev.items[idx];
        pushToast({
          kind: "info",
          text: "Item dihapus.",
          actionLabel: "Undo",
          onAction: () => {
            setInv((current) => {
              const nextItems = [...current.items];
              nextItems.splice(idx, 0, removed);
              return { ...current, items: nextItems };
            });
          },
        });
        return { ...prev, items: prev.items.filter((i) => i.id !== id) };
      });
      setSaved(false);
    },
    [pushToast],
  );

  // ── Profile functions ──
  function openSaveProfileModal() {
    const fallbackName = inv.senderBusiness.trim() || inv.senderName.trim() || "Profil Pengirim";
    setProfileDraftName(fallbackName);
    setShowSaveProfileModal(true);
  }

  async function confirmSaveProfile() {
    try {
      const name = profileDraftName.trim();
      if (!name) {
        pushToast({ kind: "error", text: "Nama profil wajib diisi." });
        return;
      }

      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          business: inv.senderBusiness,
          senderName: inv.senderName,
          address: inv.senderAddress,
          email: inv.senderEmail,
          phone: inv.senderPhone,
          logo: inv.senderLogo,
          bankName: inv.paymentBankName,
          bankAccount: inv.paymentBankAccount,
          accountHolder: inv.paymentAccountHolder,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Gagal menyimpan profil");
      }

      const profile = await res.json();
      setProfiles((prev) => [profile, ...prev]);
      pushToast({ kind: "success", text: "Profil pengirim tersimpan." });
      setShowSaveProfileModal(false);
    } catch {
      pushToast({ kind: "error", text: "Gagal menyimpan profil pengirim." });
    }
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
    try {
      if (!inv.clientName.trim()) {
        pushToast({ kind: "error", text: "Nama klien wajib diisi." });
        return;
      }

      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inv.clientName,
          address: inv.clientAddress,
          email: inv.clientEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Gagal menyimpan klien");
      }

      const client = await res.json();
      setClients((prev) => [client, ...prev]);
      pushToast({ kind: "success", text: "Klien tersimpan." });
    } catch {
      pushToast({ kind: "error", text: "Gagal menyimpan klien." });
    }
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
    const name = item.description.trim();
    if (!name) return;

    const isHidden = hiddenProductItemIds.includes(item.id);
    const isSaving = savingProductItemIds.includes(item.id);
    if (isHidden || isSaving) return;

    const alreadyExists = products.some(
      (p) => p.name.trim().toLowerCase() === name.toLowerCase() && Number(p.price) === Number(item.unitPrice),
    );
    if (alreadyExists) {
      setHiddenProductItemIds((prev) => [...prev, item.id]);
      return;
    }

    setSavingProductItemIds((prev) => [...prev, item.id]);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price: item.unitPrice }),
      });
      if (!res.ok) throw new Error("Gagal simpan produk");

      const product = await res.json();
      setProducts((prev) => {
        const existsById = prev.some((p) => p.id === product.id);
        if (existsById) return prev;
        return [product, ...prev];
      });
      // Hide chip after successful click so it can't be saved repeatedly.
      setHiddenProductItemIds((prev) => [...prev, item.id]);
    } finally {
      setSavingProductItemIds((prev) => prev.filter((id) => id !== item.id));
    }
  }

  // Save to DB
  async function handleSave() {
    const dueDateInvalid = Boolean(
      inv.invoiceDate && inv.dueDate && new Date(inv.dueDate).getTime() < new Date(inv.invoiceDate).getTime(),
    );
    const hasValidClient = inv.clientName.trim().length > 0;
    const hasValidItem = inv.items.some((i) => i.description.trim().length > 0);
    if (!inv.invoiceNumber.trim()) {
      pushToast({ kind: "error", text: "Nomor invoice wajib diisi." });
      return;
    }
    if (!hasValidClient) {
      pushToast({ kind: "error", text: "Nama klien wajib diisi." });
      return;
    }
    if (!hasValidItem) {
      pushToast({ kind: "error", text: "Minimal satu item harus memiliki deskripsi." });
      return;
    }
    if (dueDateInvalid) {
      pushToast({ kind: "error", text: "Tanggal jatuh tempo tidak boleh lebih awal dari tanggal invoice." });
      return;
    }

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
      pushToast({ kind: "success", text: "Invoice berhasil disimpan." });
      setTimeout(() => setSaved(false), 2000);
    } catch {
      pushToast({ kind: "error", text: "Gagal menyimpan invoice." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAutoNotaAndDownload() {
    setGeneratingNota(true);
    try {
      const blob = await pdf(<InvoicePDF data={inv} mode="receipt" />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kwitansi-${inv.invoiceNumber || "nota"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setGeneratingNota(false);
    }
  }

  // Keyboard shortcuts: Ctrl+S save, Ctrl+Shift+P preview, Ctrl+Enter quick nota download.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === "p") {
        e.preventDefault();
        setShowPreview((p) => !p);
      }
      if ((e.ctrlKey || e.metaKey) && key === "enter") {
        e.preventDefault();
        handleAutoNotaAndDownload();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleAutoNotaAndDownload, handleSave]);

  // New invoice
  function startNewInvoice() {
    fetch("/api/invoices/next-number")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(({ invoiceNumber }) => {
        const fresh = defaultInvoice();
        fresh.invoiceNumber = invoiceNumber;
        setInv(fresh);
        setSavingProductItemIds([]);
        setHiddenProductItemIds([]);
        setShowPreview(false);
        window.history.replaceState(null, "", "/");
        setSaved(false);
      })
      .catch(() => {});
  }

  function handleNew() {
    if (hasUnsavedDraft) {
      setShowDiscardDialog(true);
      return;
    }
    startNewInvoice();
  }

  const hasUnsavedDraft =
    !saved &&
    (Boolean(inv.id) ||
      inv.clientName.trim().length > 0 ||
      inv.notes.trim().length > 0 ||
      inv.items.some((i) => i.description.trim().length > 0));

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!hasUnsavedDraft) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedDraft]);

  const totals = calcTotals(inv.items, inv.taxRate, inv.discountPercent, inv.roundingAmount);

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
          <Link href="/manage" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
            Manage
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ThemeToggle />
          <span className="text-[11px] text-gray-400 dark:text-gray-500 hidden md:inline">
            Shortcut: Ctrl+S Simpan • Ctrl+Shift+P Preview • Ctrl+Enter Nota
          </span>
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
          <button
            type="button"
            onClick={handleAutoNotaAndDownload}
            disabled={generatingNota}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {generatingNota ? "Membuat Nota..." : "Nota Otomatis + Download PDF"}
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

      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* ── Form Column ── */}
        <div className={`${showPreview ? "w-full lg:w-1/2" : "w-full max-w-5xl mx-auto"} bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 md:p-10 space-y-10 transition-all`}>

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
          {inv.invoiceDate && inv.dueDate && new Date(inv.dueDate).getTime() < new Date(inv.invoiceDate).getTime() && (
            <p className="text-xs text-red-500 -mt-7">Jatuh tempo tidak boleh lebih awal dari tanggal invoice.</p>
          )}

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
                  <button type="button" onClick={openSaveProfileModal} className="text-[10px] text-blue-500 hover:underline cursor-pointer whitespace-nowrap">Simpan Profil</button>
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
                  <span className="md:hidden text-[11px] text-gray-500 dark:text-gray-400">Deskripsi</span>
                  <input
                    className="input"
                    placeholder="Deskripsi item…"
                    value={item.description}
                    onChange={(e) => setItemField(item.id, "description", e.target.value)}
                  />
                  <span className="md:hidden text-[11px] text-gray-500 dark:text-gray-400">Qty</span>
                  <input
                    className="input text-center"
                    type="number"
                    min={0}
                    value={item.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setItemField(item.id, "quantity", e.target.value)}
                  />
                  <span className="md:hidden text-[11px] text-gray-500 dark:text-gray-400">Harga Satuan</span>
                  <input
                    className="input text-right"
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setItemField(item.id, "unitPrice", e.target.value)}
                  />
                  <span className="md:hidden text-[11px] text-gray-500 dark:text-gray-400">Diskon (%)</span>
                  <input
                    className="input text-center"
                    type="number"
                    min={0}
                    max={100}
                    value={item.discount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setItemField(item.id, "discount", e.target.value)}
                  />
                  <span className="md:hidden text-[11px] text-gray-500 dark:text-gray-400">Jumlah</span>
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

          {/* ── Status ── */}
          <section>
            <h2 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-3">Status Invoice</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => {
                const active = inv.status === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set("status", s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Tax, Discount, Notes ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Input label="Diskon Global (%)" type="number" value={String(inv.discountPercent)} onChange={(v) => set("discountPercent", Math.max(0, Math.min(100, Number(v) || 0)))} />
              <Input label="Pajak (%)" type="number" value={String(inv.taxRate)} onChange={(v) => set("taxRate", Math.max(0, Number(v) || 0))} />
              <Input label="Pembulatan (Rp)" type="number" value={String(inv.roundingAmount)} onChange={(v) => set("roundingAmount", Number(v) || 0)} />
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
              {inv.roundingAmount !== 0 && (
                <Row
                  label="Pembulatan"
                  value={`${inv.roundingAmount > 0 ? "+" : "-"}${formatCurrency(Math.abs(inv.roundingAmount))}`}
                />
              )}
              <div className="w-56 flex justify-between border-t-2 border-blue-600 pt-2 mt-2">
                <span className="font-bold text-blue-600 text-base">Total</span>
                <span className="font-bold text-blue-600 text-base">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
          </div>

          <details className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/30 p-4">
            <summary className="cursor-pointer text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Bagian Tambahan (Pembayaran, Tanda Tangan, Simpan Item)
            </summary>
            <div className="mt-4 space-y-6">
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
              {inv.items.some((i) => i.description.trim() && !hiddenProductItemIds.includes(i.id)) && (
                <section>
                  <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Simpan Item Sebagai Produk</h2>
                  <div className="flex flex-wrap gap-2">
                    {inv.items.filter((i) => i.description.trim() && !hiddenProductItemIds.includes(i.id)).map((item) => (
                      <button key={item.id} type="button" onClick={() => saveAsProduct(item)}
                        disabled={savingProductItemIds.includes(item.id)}
                        className="text-xs px-3 py-1 rounded-full border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                      >
                        {savingProductItemIds.includes(item.id) ? "Menyimpan..." : `+ ${item.description}`}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </details>
        </div>

        {/* ── PDF Preview Column ── */}
        {showPreview && (
          <div className="w-full lg:w-1/2 lg:sticky lg:top-8 h-[480px] lg:h-[calc(100vh-4rem)]">
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
      {showSaveProfileModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowSaveProfileModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Simpan Profil Pengirim</h2>
            <Input label="Nama Profil" value={profileDraftName} onChange={setProfileDraftName} />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSaveProfileModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmSaveProfile}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={showDiscardDialog}
        title="Buat Invoice Baru"
        message="Perubahan yang belum disimpan akan hilang. Lanjutkan?"
        confirmLabel="Lanjut"
        confirmVariant="primary"
        onCancel={() => setShowDiscardDialog(false)}
        onConfirm={() => {
          setShowDiscardDialog(false);
          startNewInvoice();
        }}
      />
      <AppToast toasts={toasts} onDismiss={dismissToast} />
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
