"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

interface InvoiceSummary {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  status: string;
  grandTotal: number;
  createdAt: string;
}

export default function HistoryPage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setInvoices)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Yakin hapus invoice ini?")) return;
    await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <main className="min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-600">Riwayat Invoice</h1>
            <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
              Buat Invoice
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
              Dashboard
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
            <table className="w-full text-sm">
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
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          inv.status === "sent"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {inv.status === "sent" ? "Terkirim" : "Draft"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/?id=${inv.id}`}
                        className="text-blue-500 hover:text-blue-700 text-xs mr-3"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(inv.id)}
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
        )}
      </div>
    </main>
  );
}
