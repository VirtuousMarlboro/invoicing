"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import AppToast, { type ToastMessage } from "@/components/AppToast";

type Product = { id: number; name: string; price: number; createdAt: string };
type Client = { id: number; name: string; address: string; email: string; createdAt: string };
type Profile = {
  id: number;
  name: string;
  business: string;
  senderName: string;
  address: string;
  email: string;
  phone: string;
  logo: string;
  bankName: string;
  bankAccount: string;
  accountHolder: string;
  createdAt: string;
};

export default function ManagePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [productForm, setProductForm] = useState({ name: "", price: "0" });
  const [clientForm, setClientForm] = useState({ name: "", email: "", address: "" });
  const [profileForm, setProfileForm] = useState({
    name: "",
    business: "",
    senderName: "",
    address: "",
    email: "",
    phone: "",
    bankName: "",
    bankAccount: "",
    accountHolder: "",
  });

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

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, cRes, sRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/clients"),
        fetch("/api/profiles"),
      ]);
      const [pData, cData, sData] = await Promise.all([pRes.json(), cRes.json(), sRes.json()]);
      setProducts(Array.isArray(pData) ? pData : []);
      setClients(Array.isArray(cData) ? cData : []);
      setProfiles(Array.isArray(sData) ? sData : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function deduplicate() {
    setCleaning(true);
    try {
      const res = await fetch("/api/manage/deduplicate", { method: "POST" });
      const data = await res.json();
      await loadAll();
      const removed = data?.removed || {};
      pushToast({
        kind: "success",
        text: `Duplikat dihapus: Produk ${removed.products || 0}, Klien ${removed.clients || 0}, Profil ${removed.profiles || 0}`,
      });
    } catch {
      pushToast({ kind: "error", text: "Gagal membersihkan duplikat." });
    } finally {
      setCleaning(false);
    }
  }

  async function deleteProduct(id: number) {
    const existing = products.find((x) => x.id === id);
    if (!existing) return;
    setProducts((prev) => prev.filter((x) => x.id !== id));
    pushToast({
      kind: "info",
      text: `Item "${existing.name}" dihapus.`,
      actionLabel: "Undo",
      onAction: () => {
        void (async () => {
          const restoreRes = await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: existing.name, price: existing.price }),
          });
          if (!restoreRes.ok) {
            pushToast({ kind: "error", text: "Gagal restore item." });
            return;
          }
          await loadAll();
          pushToast({ kind: "success", text: "Item berhasil dipulihkan." });
        })();
      },
    });
    const res = await fetch(`/api/products?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setProducts((prev) => [existing, ...prev]);
      pushToast({ kind: "error", text: "Gagal menghapus item." });
    }
  }

  async function editProduct(item: Product) {
    setEditingProduct(item);
    setProductForm({ name: item.name, price: String(item.price) });
  }

  async function saveProductEdit() {
    if (!editingProduct) return;
    if (!productForm.name.trim()) {
      pushToast({ kind: "error", text: "Nama produk wajib diisi." });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProduct.id,
          name: productForm.name,
          price: Number(productForm.price) || 0,
        }),
      });
      if (!res.ok) {
        pushToast({ kind: "error", text: "Gagal edit item. Mungkin duplikat." });
        return;
      }
      const updated = await res.json();
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)));
      setEditingProduct(null);
      pushToast({ kind: "success", text: "Item berhasil diperbarui." });
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteClient(id: number) {
    const existing = clients.find((x) => x.id === id);
    if (!existing) return;
    setClients((prev) => prev.filter((x) => x.id !== id));
    pushToast({
      kind: "info",
      text: `Klien "${existing.name}" dihapus.`,
      actionLabel: "Undo",
      onAction: () => {
        void (async () => {
          const restoreRes = await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: existing.name,
              email: existing.email,
              address: existing.address,
            }),
          });
          if (!restoreRes.ok) {
            pushToast({ kind: "error", text: "Gagal restore klien." });
            return;
          }
          await loadAll();
          pushToast({ kind: "success", text: "Klien berhasil dipulihkan." });
        })();
      },
    });
    const res = await fetch(`/api/clients?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setClients((prev) => [existing, ...prev]);
      pushToast({ kind: "error", text: "Gagal menghapus klien." });
    }
  }

  async function editClient(item: Client) {
    setEditingClient(item);
    setClientForm({ name: item.name, email: item.email || "", address: item.address || "" });
  }

  async function saveClientEdit() {
    if (!editingClient) return;
    if (!clientForm.name.trim()) {
      pushToast({ kind: "error", text: "Nama klien wajib diisi." });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/clients", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingClient.id,
          name: clientForm.name,
          email: clientForm.email,
          address: clientForm.address,
        }),
      });
      if (!res.ok) {
        pushToast({ kind: "error", text: "Gagal edit klien. Mungkin duplikat." });
        return;
      }
      const updated = await res.json();
      setClients((prev) => prev.map((c) => (c.id === editingClient.id ? updated : c)));
      setEditingClient(null);
      pushToast({ kind: "success", text: "Klien berhasil diperbarui." });
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteProfile(id: number) {
    const existing = profiles.find((x) => x.id === id);
    if (!existing) return;
    setProfiles((prev) => prev.filter((x) => x.id !== id));
    pushToast({
      kind: "info",
      text: `Profil "${existing.name}" dihapus.`,
      actionLabel: "Undo",
      onAction: () => {
        void (async () => {
          const restoreRes = await fetch("/api/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: existing.name,
              business: existing.business,
              senderName: existing.senderName,
              address: existing.address,
              email: existing.email,
              phone: existing.phone,
              logo: existing.logo,
              bankName: existing.bankName,
              bankAccount: existing.bankAccount,
              accountHolder: existing.accountHolder,
            }),
          });
          if (!restoreRes.ok) {
            pushToast({ kind: "error", text: "Gagal restore profil." });
            return;
          }
          await loadAll();
          pushToast({ kind: "success", text: "Profil berhasil dipulihkan." });
        })();
      },
    });
    const res = await fetch(`/api/profiles?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setProfiles((prev) => [existing, ...prev]);
      pushToast({ kind: "error", text: "Gagal menghapus profil." });
    }
  }

  async function editProfile(item: Profile) {
    setEditingProfile(item);
    setProfileForm({
      name: item.name,
      business: item.business || "",
      senderName: item.senderName || "",
      address: item.address || "",
      email: item.email || "",
      phone: item.phone || "",
      bankName: item.bankName || "",
      bankAccount: item.bankAccount || "",
      accountHolder: item.accountHolder || "",
    });
  }

  async function saveProfileEdit() {
    if (!editingProfile) return;
    if (!profileForm.name.trim()) {
      pushToast({ kind: "error", text: "Nama profil wajib diisi." });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProfile.id,
          name: profileForm.name,
          business: profileForm.business,
          senderName: profileForm.senderName,
          address: profileForm.address,
          email: profileForm.email,
          phone: profileForm.phone,
          logo: editingProfile.logo,
          bankName: profileForm.bankName,
          bankAccount: profileForm.bankAccount,
          accountHolder: profileForm.accountHolder,
        }),
      });
      if (!res.ok) {
        pushToast({ kind: "error", text: "Gagal edit profil. Mungkin duplikat." });
        return;
      }
      const updated = await res.json();
      setProfiles((prev) => prev.map((p) => (p.id === editingProfile.id ? updated : p)));
      setEditingProfile(null);
      pushToast({ kind: "success", text: "Profil berhasil diperbarui." });
    } finally {
      setSavingEdit(false);
    }
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

  return (
    <main className="min-h-screen py-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h1 className="text-2xl font-bold text-blue-600">Manage Data</h1>
            <Link href="/" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">Invoice</Link>
            <Link href="/history" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">Riwayat</Link>
            <Link href="/dashboard" className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 transition-colors">Dashboard</Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={deduplicate}
              disabled={cleaning}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {cleaning ? "Membersihkan..." : "Hapus Duplikat"}
            </button>
            <ThemeToggle />
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-20">Memuat data...</div>
        ) : (
          <>
            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h2 className="font-semibold text-gray-800 dark:text-gray-200">Item / Produk ({products.length})</h2>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Nama</th>
                    <th className="px-6 py-3 text-right">Harga</th>
                    <th className="px-6 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">{p.name}</td>
                      <td className="px-6 py-4 text-right font-medium">{fmt(p.price)}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => editProduct(p)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer mr-3">Edit</button>
                        <button onClick={() => deleteProduct(p.id)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">Hapus</button>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr><td className="px-6 py-4 text-gray-400" colSpan={3}>Belum ada item.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h2 className="font-semibold text-gray-800 dark:text-gray-200">Klien ({clients.length})</h2>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Nama</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Alamat</th>
                    <th className="px-6 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {clients.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">{c.name}</td>
                      <td className="px-6 py-4">{c.email || "-"}</td>
                      <td className="px-6 py-4">{c.address || "-"}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => editClient(c)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer mr-3">Edit</button>
                        <button onClick={() => deleteClient(c.id)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">Hapus</button>
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td className="px-6 py-4 text-gray-400" colSpan={4}>Belum ada klien.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </section>

            <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
                <h2 className="font-semibold text-gray-800 dark:text-gray-200">Profil Pengirim ({profiles.length})</h2>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-slate-700 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Nama Profil</th>
                    <th className="px-6 py-3">Bisnis</th>
                    <th className="px-6 py-3">Pengirim</th>
                    <th className="px-6 py-3">Kontak</th>
                    <th className="px-6 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {profiles.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">{p.name}</td>
                      <td className="px-6 py-4">{p.business || "-"}</td>
                      <td className="px-6 py-4">{p.senderName || "-"}</td>
                      <td className="px-6 py-4">{p.email || p.phone || "-"}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => editProfile(p)} className="text-blue-500 hover:text-blue-700 text-xs cursor-pointer mr-3">Edit</button>
                        <button onClick={() => deleteProfile(p.id)} className="text-red-500 hover:text-red-700 text-xs cursor-pointer">Hapus</button>
                      </td>
                    </tr>
                  ))}
                  {profiles.length === 0 && (
                    <tr><td className="px-6 py-4 text-gray-400" colSpan={5}>Belum ada profil.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </section>
          </>
        )}
      </div>

      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditingProduct(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Edit Produk</h3>
            <FormField label="Nama">
              <input className="input" value={productForm.name} onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))} />
            </FormField>
            <FormField label="Harga">
              <input className="input" type="number" min={0} value={productForm.price} onChange={(e) => setProductForm((p) => ({ ...p, price: e.target.value }))} />
            </FormField>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingProduct(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600">Batal</button>
              <button type="button" disabled={savingEdit} onClick={saveProductEdit} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50">{savingEdit ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {editingClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditingClient(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Edit Klien</h3>
            <FormField label="Nama"><input className="input" value={clientForm.name} onChange={(e) => setClientForm((c) => ({ ...c, name: e.target.value }))} /></FormField>
            <FormField label="Email"><input className="input" value={clientForm.email} onChange={(e) => setClientForm((c) => ({ ...c, email: e.target.value }))} /></FormField>
            <FormField label="Alamat"><input className="input" value={clientForm.address} onChange={(e) => setClientForm((c) => ({ ...c, address: e.target.value }))} /></FormField>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingClient(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600">Batal</button>
              <button type="button" disabled={savingEdit} onClick={saveClientEdit} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50">{savingEdit ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {editingProfile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditingProfile(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Edit Profil Pengirim</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Nama Profil"><input className="input" value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} /></FormField>
              <FormField label="Nama Bisnis"><input className="input" value={profileForm.business} onChange={(e) => setProfileForm((p) => ({ ...p, business: e.target.value }))} /></FormField>
              <FormField label="Nama Pengirim"><input className="input" value={profileForm.senderName} onChange={(e) => setProfileForm((p) => ({ ...p, senderName: e.target.value }))} /></FormField>
              <FormField label="Telepon"><input className="input" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} /></FormField>
              <FormField label="Email"><input className="input" value={profileForm.email} onChange={(e) => setProfileForm((p) => ({ ...p, email: e.target.value }))} /></FormField>
              <FormField label="Alamat"><input className="input" value={profileForm.address} onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))} /></FormField>
              <FormField label="Bank"><input className="input" value={profileForm.bankName} onChange={(e) => setProfileForm((p) => ({ ...p, bankName: e.target.value }))} /></FormField>
              <FormField label="No. Rekening"><input className="input" value={profileForm.bankAccount} onChange={(e) => setProfileForm((p) => ({ ...p, bankAccount: e.target.value }))} /></FormField>
              <FormField label="Atas Nama"><input className="input" value={profileForm.accountHolder} onChange={(e) => setProfileForm((p) => ({ ...p, accountHolder: e.target.value }))} /></FormField>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingProfile(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-slate-600">Batal</button>
              <button type="button" disabled={savingEdit} onClick={saveProfileEdit} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50">{savingEdit ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}
      <AppToast toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}
