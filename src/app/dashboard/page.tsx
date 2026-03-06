"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

interface DashboardData {
  totalInvoices: number;
  totalRevenue: number;
  draftCount: number;
  draftAmount: number;
  sentCount: number;
  sentAmount: number;
  monthly: { month: string; total: number; count: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <main className="min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-600">Dashboard</h1>
            <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
              Buat Invoice
            </Link>
            <Link href="/history" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">
              Riwayat
            </Link>
          </div>
          <ThemeToggle />
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Memuat…</div>
        ) : !data ? (
          <div className="text-center text-gray-400 py-20">Gagal memuat data</div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Invoice" value={String(data.totalInvoices)} sub="invoice" color="blue" />
              <StatCard label="Total Pendapatan" value={fmt(data.totalRevenue)} color="green" />
              <StatCard label="Belum Lunas" value={fmt(data.draftAmount)} sub={`${data.draftCount} invoice`} color="yellow" />
              <StatCard label="Lunas" value={fmt(data.sentAmount)} sub={`${data.sentCount} invoice`} color="emerald" />
            </div>

            {/* Monthly Table */}
            {data.monthly.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                  <h2 className="font-semibold text-gray-800 dark:text-gray-200">Ringkasan Bulanan</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <th className="px-6 py-3">Bulan</th>
                      <th className="px-6 py-3 text-center">Jumlah Invoice</th>
                      <th className="px-6 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {data.monthly.map((m) => (
                      <tr key={m.month} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 font-medium">{m.month}</td>
                        <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{m.count}</td>
                        <td className="px-6 py-4 text-right font-medium">{fmt(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.monthly.length === 0 && (
              <div className="text-center text-gray-400 py-12">
                <p>Belum ada data invoice</p>
                <Link href="/" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
                  Buat invoice pertama →
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  const colors: Record<string, string> = {
    blue: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
    green: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    yellow: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
    emerald: "bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800",
  };
  const textColors: Record<string, string> = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color] || colors.blue}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold ${textColors[color] || textColors.blue}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}
