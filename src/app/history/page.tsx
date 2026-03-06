"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import AppToast, { type ToastMessage } from "@/components/AppToast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  status: string;
  grandTotal: number;
  createdAt: string;
}

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "sent":
      return { label: "Terkirim", className: "bg-blue-100 text-blue-700" };
    case "paid":
      return { label: "Lunas", className: "bg-green-100 text-green-700" };
    case "overdue":
      return { label: "Jatuh Tempo", className: "bg-red-100 text-red-700" };
    default:
      return { label: "Draft", className: "bg-yellow-100 text-yellow-700" };
  }
}

export default function HistoryPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceSummary | null>(null);

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

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setInvoices)
      .catch(() => {
        pushToast({ kind: "error", text: "Gagal memuat riwayat invoice." });
      })
      .finally(() => setLoading(false));
  }, [pushToast]);

  async function handleDelete(id: number) {
    const existing = invoices.find((inv) => inv.id === id);
    if (!existing) return;
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setInvoices((prev) => [existing, ...prev]);
      pushToast({ kind: "error", text: "Gagal menghapus invoice." });
      return;
    }
    pushToast({ kind: "success", text: `Invoice ${existing.invoiceNumber} dihapus.` });
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <main className="min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-blue-600">Riwayat Invoice</h1>
            <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
              Buat Invoice
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/manage" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
              Manage
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Buat Baru
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Memuat…</div>
        ) : invoices.length === 0 ? (
          <div className="text-center text-gray-400 py-20">
            <p className="text-lg mb-2">Belum ada invoice</p>
            <Link href="/" className="text-blue-600 hover:underline text-sm">
              Buat invoice pertama →
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="px-6 py-3">No. Invoice</th>
                  <th className="px-6 py-3">Tanggal</th>
                  <th className="px-6 py-3">Klien</th>
                  <th className="px-6 py-3">Total</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 font-medium">
                      <Link href={`/?id=${inv.id}`} className="text-blue-600 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{inv.invoiceDate}</td>
                    <td className="px-6 py-4">{inv.clientName || <span className="text-gray-300">—</span>}</td>
                    <td className="px-6 py-4 font-medium">{fmt(inv.grandTotal)}</td>
                    <td className="px-6 py-4">
                      {(() => {
                        const badge = statusBadge(inv.status);
                        return (
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/?id=${inv.id}`}
                        className="text-blue-500 hover:text-blue-700 text-xs mr-3"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => setDeleteTarget(inv)}
                        className="text-red-400 hover:text-red-600 text-xs cursor-pointer"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
      <AppToast toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Invoice"
        message={deleteTarget ? `Invoice ${deleteTarget.invoiceNumber} akan dihapus permanen.` : ""}
        confirmLabel="Hapus"
        confirmVariant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          void handleDelete(id);
        }}
      />
    </main>
  );
}
