# SwiftInvoice — Technical Blueprint

**Status:** Draft | **Versi:** 1.0 | **Tanggal:** 6 Maret 2026

---

## 1. Arsitektur Database (ERD)

### Prinsip Desain
- Semua nilai moneter disimpan sebagai **integer dalam satuan terkecil** (sen/cent). Contoh: Rp 150.000,50 → `15000050`. Ini menghilangkan floating-point error secara fundamental.
- Soft-delete (`deleted_at`) pada entitas utama untuk audit trail finansial.
- UUID v4 sebagai primary key untuk keamanan (tidak bisa di-enumerate) dan kesiapan multi-tenant.

---

### Tabel: `users`

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | `UUID` | PK, DEFAULT gen_random_uuid() | |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Login identifier |
| `password_hash` | `VARCHAR(255)` | NOT NULL | Argon2id hash |
| `full_name` | `VARCHAR(150)` | NOT NULL | |
| `business_name` | `VARCHAR(200)` | | Nama usaha |
| `business_address` | `TEXT` | | Alamat lengkap |
| `phone` | `VARCHAR(30)` | | |
| `logo_url` | `VARCHAR(500)` | | Path ke object storage |
| `default_tax_rate` | `INTEGER` | DEFAULT 0 | Basis poin: 1100 = 11.00% |
| `default_currency` | `VARCHAR(3)` | DEFAULT 'IDR' | ISO 4217 |
| `invoice_prefix` | `VARCHAR(10)` | DEFAULT 'INV' | Prefix nomor invoice |
| `invoice_counter` | `INTEGER` | DEFAULT 0 | Auto-increment per user |
| `theme_color` | `VARCHAR(7)` | DEFAULT '#2563EB' | Hex color |
| `created_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `deleted_at` | `TIMESTAMPTZ` | | Soft delete |

---

### Tabel: `clients`

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users.id, NOT NULL | Pemilik data |
| `name` | `VARCHAR(200)` | NOT NULL | Nama klien / perusahaan |
| `email` | `VARCHAR(255)` | | Untuk pengiriman invoice |
| `phone` | `VARCHAR(30)` | | |
| `address` | `TEXT` | | |
| `city` | `VARCHAR(100)` | | |
| `country` | `VARCHAR(2)` | DEFAULT 'ID' | ISO 3166-1 alpha-2 |
| `notes` | `TEXT` | | Catatan internal |
| `created_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `deleted_at` | `TIMESTAMPTZ` | | |

---

### Tabel: `products`

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users.id, NOT NULL | |
| `name` | `VARCHAR(200)` | NOT NULL | Nama produk/jasa |
| `description` | `TEXT` | | |
| `unit_price` | `BIGINT` | NOT NULL | Harga satuan (sen) |
| `unit` | `VARCHAR(30)` | DEFAULT 'unit' | jam, unit, proyek, dsb. |
| `created_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `deleted_at` | `TIMESTAMPTZ` | | |

---

### Tabel: `invoices`

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `user_id` | `UUID` | FK → users.id, NOT NULL | Pembuat invoice |
| `client_id` | `UUID` | FK → clients.id, NOT NULL | Penerima invoice |
| `invoice_number` | `VARCHAR(50)` | UNIQUE, NOT NULL | e.g. INV-2026-0042 |
| `status` | `ENUM` | NOT NULL, DEFAULT 'DRAFT' | DRAFT, SENT, PAID, OVERDUE, CANCELLED |
| `issue_date` | `DATE` | NOT NULL | Tanggal terbit |
| `due_date` | `DATE` | NOT NULL | Tanggal jatuh tempo |
| `currency` | `VARCHAR(3)` | DEFAULT 'IDR' | |
| `subtotal` | `BIGINT` | NOT NULL DEFAULT 0 | Σ line_items (sen) |
| `discount_type` | `ENUM` | DEFAULT 'FLAT' | FLAT atau PERCENTAGE |
| `discount_value` | `BIGINT` | DEFAULT 0 | Flat=sen, Pct=basis poin |
| `discount_total` | `BIGINT` | DEFAULT 0 | Nilai diskon akhir (sen) |
| `tax_rate` | `INTEGER` | DEFAULT 0 | Basis poin: 1100 = 11% |
| `tax_total` | `BIGINT` | DEFAULT 0 | Nilai pajak (sen) |
| `grand_total` | `BIGINT` | NOT NULL DEFAULT 0 | subtotal - discount + tax |
| `amount_paid` | `BIGINT` | DEFAULT 0 | Total yang sudah dibayar |
| `notes` | `TEXT` | | Catatan untuk klien |
| `terms` | `TEXT` | | Syarat & ketentuan |
| `public_token` | `VARCHAR(64)` | UNIQUE | Token untuk public link |
| `sent_at` | `TIMESTAMPTZ` | | Waktu invoice dikirim |
| `paid_at` | `TIMESTAMPTZ` | | Waktu lunas |
| `pdf_url` | `VARCHAR(500)` | | Generated PDF path |
| `created_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `updated_at` | `TIMESTAMPTZ` | DEFAULT now() | |
| `deleted_at` | `TIMESTAMPTZ` | | |

**Index:** `(user_id, status)`, `(client_id)`, `(due_date)`, `(public_token)`

---

### Tabel: `line_items`

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `invoice_id` | `UUID` | FK → invoices.id, NOT NULL, ON DELETE CASCADE | |
| `product_id` | `UUID` | FK → products.id, NULLABLE | Referensi katalog (opsional) |
| `description` | `VARCHAR(500)` | NOT NULL | Deskripsi item |
| `quantity` | `DECIMAL(12,4)` | NOT NULL | Mendukung satuan desimal (2.5 jam) |
| `unit_price` | `BIGINT` | NOT NULL | Harga satuan (sen) |
| `amount` | `BIGINT` | NOT NULL | quantity × unit_price (sen, rounded) |
| `sort_order` | `INTEGER` | DEFAULT 0 | Urutan tampil |

---

### Tabel: `payments`

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | `UUID` | PK | |
| `invoice_id` | `UUID` | FK → invoices.id, NOT NULL | |
| `amount` | `BIGINT` | NOT NULL | Jumlah pembayaran (sen) |
| `method` | `ENUM` | NOT NULL | GATEWAY, BANK_TRANSFER, CASH, OTHER |
| `gateway_provider` | `VARCHAR(30)` | | midtrans, stripe, dsb. |
| `gateway_tx_id` | `VARCHAR(200)` | | ID transaksi dari gateway |
| `gateway_status` | `VARCHAR(50)` | | Status dari gateway |
| `gateway_raw` | `JSONB` | | Raw webhook payload (audit) |
| `notes` | `VARCHAR(500)` | | |
| `paid_at` | `TIMESTAMPTZ` | NOT NULL | Waktu pembayaran |
| `created_at` | `TIMESTAMPTZ` | DEFAULT now() | |

---

### Relasi Antar Tabel

```
users ──1:N──▶ clients        (satu user punya banyak klien)
users ──1:N──▶ products       (satu user punya banyak produk/jasa)
users ──1:N──▶ invoices       (satu user membuat banyak invoice)
clients ──1:N──▶ invoices     (satu klien menerima banyak invoice)
invoices ──1:N──▶ line_items  (satu invoice punya banyak baris item)
invoices ──1:N──▶ payments    (satu invoice bisa punya banyak pembayaran parsial)
products ──1:N──▶ line_items  (opsional: line_item bisa merujuk ke katalog produk)
```

**Diagram:**

```
┌──────────┐       ┌──────────┐       ┌─────────────┐
│  users   │──1:N─▶│ clients  │──1:N─▶│  invoices   │
│          │──1:N─▶│ products │       │             │──1:N─▶┌────────────┐
│          │──1:N──────────────────────▶             │       │ line_items │
└──────────┘                          │             │──1:N─▶├────────────┤
                                      └─────────────┘       │ payments   │
                                                            └────────────┘
```

---

## 2. Tech Stack Recommendation

| Layer | Teknologi | Alasan |
|---|---|---|
| **Framework** | **Next.js 15 (App Router)** | SSR untuk SEO landing page, RSC untuk dashboard, API Routes terintegrasi — satu deploy, satu repo. |
| **Language** | **TypeScript (strict mode)** | Type safety end-to-end mencegah bug kalkulasi. Shared types antara frontend & backend. |
| **Database** | **PostgreSQL 16 (via Supabase)** | ACID compliance wajib untuk data finansial. JSONB untuk gateway payload. Row Level Security (RLS) built-in di Supabase. |
| **ORM** | **Prisma 6** | Type-safe query, migrasi deklaratif, dan introspection. Menghindari raw SQL rawan injection. |
| **Auth** | **Supabase Auth** | JWT + refresh token, OAuth (Google), magic link. RLS policy otomatis berdasarkan `auth.uid()`. |
| **Object Storage** | **Supabase Storage** | Upload logo & generated PDF. Signed URL untuk akses PDF yang aman dan time-limited. |
| **Payment Gateway** | **Midtrans (ID) + Stripe (Intl)** | Midtrans dominan di Indonesia. Stripe untuk ekspansi global. Keduanya punya webhook untuk notifikasi status. |
| **PDF Generation** | **@react-pdf/renderer** | Komponen React untuk layout PDF — konsisten dengan UI. Server-side rendering di API route. |
| **Email** | **Resend** | API modern, React Email templates, deliverability tinggi, harga terjangkau untuk volume kecil. |
| **Job Queue** | **Trigger.dev** | Serverless cron untuk pengingat otomatis (overdue check) dan background PDF generation. Gratis tier cukup. |
| **Hosting** | **Vercel** | Zero-config deploy Next.js, edge network global, preview deploy per PR. |
| **Monitoring** | **Sentry + Vercel Analytics** | Error tracking + real user metrics. |
| **UI Library** | **shadcn/ui + Tailwind CSS 4** | Headless components, accessible, customizable tanpa vendor lock-in. |
| **Charting** | **Recharts** | Grafik pendapatan & piutang di dashboard. Ringan, React-native. |
| **Validation** | **Zod** | Runtime validation untuk API input. Schema reusable antara client & server. |

### Mengapa Bukan...?
- **Express/Nest.js terpisah?** → Over-engineering untuk MVP. Next.js API Routes cukup. Bisa di-extract nanti.
- **MongoDB?** → Data finansial membutuhkan ACID transaction dan relational integrity. NoSQL terlalu riskan.
- **Decimal.js di DB?** → PostgreSQL `BIGINT` + integer arithmetic lebih cepat dan deterministik daripada `DECIMAL` type di application layer.

---

## 3. Core Logic — Matematika Invoice

### Filosofi: Integer Arithmetic
Semua perhitungan moneter menggunakan **integer (sen/cent)**. Tidak ada floating point di jalur kalkulasi uang.

```typescript
// Contoh: Rp 150.000,50 disimpan sebagai 15000050 (integer)
// Tax rate 11% disimpan sebagai 1100 (basis poin, 2 desimal implisit)
// Discount 5.5% disimpan sebagai 550 (basis poin)
```

### Fungsi Kalkulasi (lihat file: src/lib/invoice-calculator.ts)

```typescript
/**
 * Banker's rounding (round half to even) — standar IEEE 754
 * Menghindari bias rounding ke atas pada .5
 */
function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const decimal = value - floor;
  if (Math.abs(decimal - 0.5) < Number.EPSILON) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

/** Hitung amount per line item */
function calcLineItemAmount(quantity: number, unitPriceCents: number): number {
  return bankersRound(quantity * unitPriceCents);
}

/** Hitung subtotal = Σ line item amounts */
function calcSubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** Hitung discount total */
function calcDiscountTotal(
  subtotal: number,
  discountType: 'FLAT' | 'PERCENTAGE',
  discountValue: number
): number {
  if (discountType === 'FLAT') return Math.min(discountValue, subtotal);
  // PERCENTAGE: discountValue dalam basis poin (550 = 5.50%)
  return bankersRound((subtotal * discountValue) / 10000);
}

/** Hitung tax total (pajak dihitung setelah diskon) */
function calcTaxTotal(subtotalAfterDiscount: number, taxRateBps: number): number {
  return bankersRound((subtotalAfterDiscount * taxRateBps) / 10000);
}

/** Hitung grand total */
function calcGrandTotal(subtotal: number, discountTotal: number, taxTotal: number): number {
  return subtotal - discountTotal + taxTotal;
}
```

### Aturan Presisi
| Konsep | Representasi | Contoh |
|---|---|---|
| Harga & total | BIGINT (sen) | Rp 1.500.000 → `150000000` |
| Tax rate | INTEGER (basis poin) | 11% → `1100`, 0.5% → `50` |
| Diskon persen | INTEGER (basis poin) | 5.5% → `550` |
| Quantity | DECIMAL(12,4) di DB | 2.5 jam → `2.5000` |

---

## 4. Security Checklist

### A. Authentication & Authorization
- [ ] Autentikasi via Supabase Auth (JWT RS256)
- [ ] Row Level Security (RLS) pada setiap tabel — user hanya akses data miliknya
- [ ] Rate limiting pada auth endpoints (5 req/menit per IP)
- [ ] Password policy: min 8 karakter, Argon2id hashing (handled by Supabase)
- [ ] Session expiry: access token 15 menit, refresh token 7 hari

### B. Data Finansial
- [ ] Semua data moneter disimpan sebagai integer (eliminasi floating-point error)
- [ ] Database transaction (ACID) untuk update invoice + line_items secara atomik
- [ ] Audit log: jangan delete record, gunakan soft-delete + `updated_at`
- [ ] Input validation server-side dengan Zod (jangan trust client)
- [ ] Sanitize semua input text (XSS prevention)

### C. Transport & Storage
- [ ] HTTPS only (enforced di Vercel + HSTS header)
- [ ] Database connection via SSL
- [ ] Enkripsi at-rest untuk Supabase Storage (AES-256, default)
- [ ] Environment variables untuk semua secrets (tidak hardcode)

### D. PDF & Public Link Security
- [ ] Public invoice link menggunakan **cryptographically random token** (32 bytes, hex-encoded = 64 chars)
- [ ] Token **BUKAN** UUID invoice — tidak bisa di-guess
- [ ] Signed URL untuk PDF download (expire 1 jam)
- [ ] Rate limiting pada public invoice endpoint (30 req/menit per IP)
- [ ] Public link hanya menampilkan data invoice — tidak expose data user lengkap
- [ ] Opsi untuk **revoke/regenerate** public token setelah invoice dibayar

### E. Payment Gateway
- [ ] Webhook signature verification (Midtrans: SHA-512, Stripe: HMAC SHA-256)
- [ ] Idempotency: cek `gateway_tx_id` sebelum create payment record
- [ ] Simpan raw webhook payload di `gateway_raw` (JSONB) untuk dispute resolution
- [ ] Jangan expose gateway credentials ke client-side

### F. Infrastructure
- [ ] Sentry untuk error monitoring (alert pada payment failures)
- [ ] Database backup otomatis (Supabase: daily point-in-time recovery)
- [ ] Dependency audit: `npm audit` di CI pipeline
- [ ] Content Security Policy (CSP) headers
- [ ] CORS whitelist hanya domain sendiri

---

## 5. API Endpoints

Base URL: `/api/v1`

### Authentication
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/auth/register` | Registrasi user baru |
| POST | `/auth/login` | Login, return JWT |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/forgot-password` | Kirim reset link via email |
| POST | `/auth/reset-password` | Reset password dengan token |

### Users (Profile)
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/users/me` | Get profil & pengaturan bisnis |
| PATCH | `/users/me` | Update profil, logo, tema |
| POST | `/users/me/logo` | Upload logo (multipart/form-data) |

### Clients
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/clients` | List klien (paginated, search) |
| POST | `/clients` | Buat klien baru |
| GET | `/clients/:id` | Detail klien + riwayat invoice |
| PATCH | `/clients/:id` | Update klien |
| DELETE | `/clients/:id` | Soft-delete klien |

### Products
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/products` | List produk/jasa (paginated) |
| POST | `/products` | Buat produk baru |
| GET | `/products/:id` | Detail produk |
| PATCH | `/products/:id` | Update produk |
| DELETE | `/products/:id` | Soft-delete produk |

### Invoices (CRUD + Status)
| Method | Endpoint | Deskripsi | Status Transition |
|---|---|---|---|
| GET | `/invoices` | List invoice (filter: status, date range, client) | — |
| POST | `/invoices` | Buat invoice + line_items (atomic) | → DRAFT |
| GET | `/invoices/:id` | Detail invoice + items + payments | — |
| PATCH | `/invoices/:id` | Update invoice (hanya jika DRAFT) | — |
| DELETE | `/invoices/:id` | Soft-delete (hanya jika DRAFT) | — |
| POST | `/invoices/:id/send` | Kirim invoice via email, generate PDF | DRAFT → SENT |
| POST | `/invoices/:id/mark-paid` | Tandai lunas manual | SENT/OVERDUE → PAID |
| POST | `/invoices/:id/cancel` | Batalkan invoice | any → CANCELLED |
| GET | `/invoices/:id/pdf` | Download PDF (signed URL redirect) | — |
| POST | `/invoices/:id/regenerate-link` | Regenerate public token | — |
| POST | `/invoices/:id/remind` | Kirim email pengingat manual | — |

### Line Items (nested, biasanya via invoice endpoint)
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/invoices/:id/items` | Tambah line item |
| PATCH | `/invoices/:id/items/:itemId` | Update line item |
| DELETE | `/invoices/:id/items/:itemId` | Hapus line item |

### Payments
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/invoices/:id/payments` | List pembayaran untuk invoice |
| POST | `/invoices/:id/payments` | Catat pembayaran manual |

### Webhooks (dari Payment Gateway)
| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/webhooks/midtrans` | Webhook handler Midtrans |
| POST | `/webhooks/stripe` | Webhook handler Stripe |

### Public (No Auth Required)
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/public/invoices/:token` | View invoice via public link |
| POST | `/public/invoices/:token/pay` | Initiate payment (redirect to gateway) |

### Dashboard & Reports
| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/dashboard/summary` | Revenue, outstanding, overdue count |
| GET | `/reports/invoices` | Export rekap invoice (CSV/Excel) |

---

### Status Transition Diagram

```
                 ┌──────────┐
                 │  DRAFT   │
                 └────┬─────┘
                      │ POST /send
                      ▼
                 ┌──────────┐
          ┌──────│   SENT   │──────┐
          │      └────┬─────┘      │
          │           │            │ cron: past due_date
          │           │ payment    ▼
          │           │       ┌──────────┐
          │           │       │ OVERDUE  │
          │           │       └────┬─────┘
          │           │            │ payment
          │           ▼            ▼
          │      ┌──────────────────┐
          │      │      PAID        │
          │      └──────────────────┘
          │
          ▼
     ┌───────────┐
     │ CANCELLED │  (dari status manapun)
     └───────────┘
```

---

## Lampiran: Konvensi

- **Naming**: snake_case untuk DB columns, camelCase untuk TypeScript properties.
- **Pagination**: cursor-based (`?cursor=<uuid>&limit=20`) untuk performa.
- **Error format**: `{ error: { code: "INVOICE_NOT_DRAFT", message: "..." } }`
- **Versioning**: URL prefix `/api/v1` untuk backward compatibility.
- **Timestamps**: Selalu UTC (TIMESTAMPTZ), konversi timezone di client.
