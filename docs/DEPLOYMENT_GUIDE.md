# SwiftInvoice — Deployment Guide

**Versi:** 1.0 | **Tanggal:** 6 Maret 2026

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Setup Lokal (Development)](#2-setup-lokal-development)
3. [Setup Supabase (Database & Auth)](#3-setup-supabase-database--auth)
4. [Setup Payment Gateway](#4-setup-payment-gateway)
5. [Setup Email Service](#5-setup-email-service)
6. [Setup Background Jobs](#6-setup-background-jobs)
7. [Deploy ke Vercel (Production)](#7-deploy-ke-vercel-production)
8. [Post-Deployment Checklist](#8-post-deployment-checklist)
9. [CI/CD Pipeline](#9-cicd-pipeline)
10. [Monitoring & Observability](#10-monitoring--observability)
11. [Scaling & Performance](#11-scaling--performance)
12. [Rollback & Disaster Recovery](#12-rollback--disaster-recovery)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prasyarat

### Tools Lokal

| Tool | Versi Minimum | Tujuan |
|---|---|---|
| Node.js | 20 LTS | Runtime |
| pnpm | 9.x | Package manager (lebih cepat dari npm) |
| Git | 2.40+ | Version control |
| PostgreSQL client | 16+ | `psql` untuk debug DB (opsional) |

### Akun Layanan

| Layanan | Tier | Keterangan |
|---|---|---|
| [Supabase](https://supabase.com) | Free / Pro | Database, Auth, Storage |
| [Vercel](https://vercel.com) | Hobby / Pro | Hosting Next.js |
| [Resend](https://resend.com) | Free (100 email/hari) | Transactional email |
| [Midtrans](https://midtrans.com) | Sandbox → Production | Payment gateway Indonesia |
| [Stripe](https://stripe.com) | Test → Live | Payment gateway internasional |
| [Trigger.dev](https://trigger.dev) | Free (10k runs/bulan) | Background jobs & cron |
| [Sentry](https://sentry.io) | Free (5k events/bulan) | Error monitoring |

---

## 2. Setup Lokal (Development)

### 2.1. Clone & Install

```bash
git clone https://github.com/your-org/swiftinvoice.git
cd swiftinvoice
pnpm install
```

### 2.2. Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` dan isi semua nilai. Lihat bagian 3–6 untuk mendapatkan credentials masing-masing service.

### 2.3. Database Setup

```bash
# Generate Prisma Client dari schema
pnpm db:generate

# Push schema ke Supabase (development — tanpa migration history)
pnpm db:push

# ATAU gunakan migration untuk tracking perubahan schema
pnpm db:migrate
```

### 2.4. Jalankan Development Server

```bash
pnpm dev
```

Aplikasi berjalan di `http://localhost:3000`.

### 2.5. Jalankan Tests

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
```

---

## 3. Setup Supabase (Database & Auth)

### 3.1. Buat Project Baru

1. Login ke [Supabase Dashboard](https://supabase.com/dashboard)
2. Klik **New Project**
3. Pilih region **Southeast Asia (Singapore)** — terdekat untuk user Indonesia
4. Set database password (simpan — dibutuhkan untuk `DATABASE_URL`)
5. Tunggu provisioning selesai (~2 menit)

### 3.2. Ambil Credentials

Dari **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL    = Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY = anon/public key
SUPABASE_SERVICE_ROLE_KEY   = service_role key (RAHASIA — hanya server-side)
```

Dari **Project Settings → Database → Connection string → URI**:

```
DATABASE_URL = postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
DIRECT_URL   = (sama, untuk Prisma migrate)
```

### 3.3. Konfigurasi Auth

Dari **Authentication → Providers**:

1. **Email**: Aktifkan, set `Confirm email` = ON
2. **Google OAuth** (opsional): Masukkan Client ID & Secret dari Google Cloud Console
3. **Site URL**: Set ke `http://localhost:3000` (development) atau domain production
4. **Redirect URLs**: Tambahkan `http://localhost:3000/auth/callback` dan URL production

### 3.4. Setup Row Level Security (RLS)

Setelah `pnpm db:push`, aktifkan RLS pada semua tabel via SQL Editor:

```sql
-- Aktifkan RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Policy: users hanya akses data miliknya
CREATE POLICY "Users access own data" ON users
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users access own clients" ON clients
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own products" ON products
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own invoices" ON invoices
  FOR ALL USING (auth.uid() = user_id);

-- line_items: akses melalui invoice ownership
CREATE POLICY "Users access own line_items" ON line_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = line_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );

-- payments: akses melalui invoice ownership
CREATE POLICY "Users access own payments" ON payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payments.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );

-- Public invoice access (untuk link publik, tanpa auth)
CREATE POLICY "Public invoice view by token" ON invoices
  FOR SELECT USING (
    public_token IS NOT NULL
    AND deleted_at IS NULL
    AND status IN ('SENT', 'PAID', 'OVERDUE')
  );
```

### 3.5. Setup Storage Bucket

Dari **Storage**:

1. Buat bucket `logos` — public read, auth write
2. Buat bucket `invoices-pdf` — private, signed URL only

```sql
-- Storage policies (via SQL Editor)
-- Logos: public read
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- PDF: private
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices-pdf', 'invoices-pdf', false);
```

---

## 4. Setup Payment Gateway

### 4.1. Midtrans (Indonesia)

1. Daftar di [Midtrans Dashboard](https://dashboard.midtrans.com)
2. Gunakan **Sandbox** environment untuk development
3. Dari **Settings → Access Keys**:

```
MIDTRANS_SERVER_KEY = Server Key
MIDTRANS_CLIENT_KEY = Client Key
MIDTRANS_IS_PRODUCTION = false   (ubah ke true saat go-live)
```

4. Set **Payment Notification URL** (webhook):
   - Sandbox: `https://<ngrok-url>/api/v1/webhooks/midtrans`
   - Production: `https://swiftinvoice.id/api/v1/webhooks/midtrans`

5. Aktifkan metode pembayaran yang diinginkan:
   - Bank Transfer (BCA, BNI, Mandiri, Permata)
   - E-Wallet (GoPay, ShopeePay, DANA)
   - QRIS
   - Credit Card

### 4.2. Stripe (Internasional)

1. Daftar di [Stripe Dashboard](https://dashboard.stripe.com)
2. Dari **Developers → API Keys**:

```
STRIPE_SECRET_KEY      = Secret key (sk_test_... → sk_live_...)
STRIPE_PUBLISHABLE_KEY = Publishable key (pk_test_... → pk_live_...)
```

3. Dari **Developers → Webhooks**, tambahkan endpoint:
   - URL: `https://swiftinvoice.id/api/v1/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Salin **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 4.3. Testing Webhooks Lokal

Gunakan tools untuk forward webhook ke localhost:

```bash
# Midtrans: gunakan ngrok
ngrok http 3000

# Stripe: gunakan Stripe CLI (lebih mudah)
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

---

## 5. Setup Email Service

### 5.1. Resend

1. Daftar di [Resend](https://resend.com)
2. Dari **API Keys**, buat key baru:

```
RESEND_API_KEY = re_...
```

3. **Verifikasi domain** (wajib untuk production):
   - Tambahkan domain `swiftinvoice.id` di Resend
   - Set DNS records (SPF, DKIM, DMARC) sesuai instruksi Resend
   - Tunggu propagasi DNS (~24 jam)

4. Set sender:

```
EMAIL_FROM = noreply@swiftinvoice.id
```

### 5.2. Email Templates

Aplikasi menggunakan [React Email](https://react.email) untuk template. Template ada di `src/emails/`:

| Template | Trigger |
|---|---|
| `invoice-sent.tsx` | Invoice dikirim ke klien |
| `payment-received.tsx` | Konfirmasi pembayaran |
| `payment-reminder.tsx` | Pengingat sebelum/sesudah jatuh tempo |
| `welcome.tsx` | User baru registrasi |

---

## 6. Setup Background Jobs

### 6.1. Trigger.dev

1. Daftar di [Trigger.dev](https://trigger.dev)
2. Buat project baru, pilih **Next.js** framework
3. Dari **Settings → API Keys**:

```
TRIGGER_API_KEY  = tr_dev_... (development) / tr_prod_... (production)
TRIGGER_API_URL  = https://api.trigger.dev
```

### 6.2. Jobs yang Diperlukan

| Job | Schedule / Trigger | Deskripsi |
|---|---|---|
| `check-overdue` | Cron: setiap hari 00:00 UTC | Update invoice SENT → OVERDUE jika past due_date |
| `send-reminders` | Cron: setiap hari 08:00 WIB | Kirim email pengingat X hari sebelum/setelah due_date |
| `generate-pdf` | Event: invoice.send | Generate PDF dan upload ke Storage |
| `send-invoice-email` | Event: invoice.send | Kirim email invoice ke klien |
| `cleanup-expired-tokens` | Cron: mingguan | Bersihkan public_token pada invoice PAID > 30 hari |

---

## 7. Deploy ke Vercel (Production)

### 7.1. Hubungkan Repository

1. Login ke [Vercel Dashboard](https://vercel.com/dashboard)
2. **Import Project** → pilih Git repository
3. Framework: **Next.js** (auto-detected)
4. Root directory: `.` (default)

### 7.2. Environment Variables

Di **Project Settings → Environment Variables**, tambahkan SEMUA variabel dari `.env.example` dengan nilai production:

```
# Tandai scope: Production (✓), Preview (✓), Development (✗)

DATABASE_URL                    = postgresql://...  [Production, Preview]
DIRECT_URL                      = postgresql://...  [Production, Preview]
NEXT_PUBLIC_SUPABASE_URL        = https://...       [Production, Preview]
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...            [Production, Preview]
SUPABASE_SERVICE_ROLE_KEY       = eyJ...            [Production only]
MIDTRANS_SERVER_KEY             = Mid-server-...    [Production only]
MIDTRANS_CLIENT_KEY             = Mid-client-...    [Production, Preview]
MIDTRANS_IS_PRODUCTION          = true              [Production only]
STRIPE_SECRET_KEY               = sk_live_...       [Production only]
STRIPE_PUBLISHABLE_KEY          = pk_live_...       [Production, Preview]
STRIPE_WEBHOOK_SECRET           = whsec_...         [Production only]
RESEND_API_KEY                  = re_...            [Production only]
EMAIL_FROM                      = noreply@...       [Production, Preview]
NEXT_PUBLIC_APP_URL             = https://swiftinvoice.id  [Production]
JWT_SECRET                      = <random-64-chars> [Production only]
TRIGGER_API_KEY                 = tr_prod_...       [Production only]
TRIGGER_API_URL                 = https://...       [Production, Preview]
```

> **PENTING:** Gunakan **Sensitive** flag untuk semua secret keys agar tidak terlihat di UI setelah disimpan.

### 7.3. Build Settings

| Setting | Value |
|---|---|
| Build Command | `prisma generate && next build` |
| Output Directory | `.next` (default) |
| Install Command | `pnpm install` |
| Node.js Version | 20.x |

### 7.4. Custom Domain

1. **Project Settings → Domains**
2. Tambahkan `swiftinvoice.id` dan `www.swiftinvoice.id`
3. Set DNS records di registrar domain:

```
Type   Name    Value
A      @       76.76.21.21          (Vercel)
CNAME  www     cname.vercel-dns.com
```

4. Vercel otomatis provision SSL certificate (Let's Encrypt)

### 7.5. Deploy

```bash
# Push ke main branch → auto deploy
git push origin main

# ATAU manual deploy via CLI
npx vercel --prod
```

### 7.6. Database Migration (Production)

```bash
# Jalankan migration di production (saat pertama kali atau ada perubahan schema)
DATABASE_URL="postgresql://...production..." npx prisma migrate deploy
```

> **JANGAN** gunakan `prisma db push` di production. Selalu gunakan `prisma migrate deploy` yang menjalankan migration files yang sudah di-review.

---

## 8. Post-Deployment Checklist

### First Deploy

- [ ] Aplikasi accessible di `https://swiftinvoice.id`
- [ ] SSL certificate aktif (padlock icon)
- [ ] Registrasi user baru berhasil
- [ ] Login/logout flow berjalan
- [ ] Database tabel terbuat dengan benar (`prisma studio` atau Supabase Dashboard)
- [ ] RLS policies aktif — coba akses data user lain (harus gagal)

### Payment Gateway

- [ ] Midtrans: test payment end-to-end di Sandbox
- [ ] Midtrans: webhook diterima dan payment tercatat
- [ ] Stripe: test payment dengan kartu `4242 4242 4242 4242`
- [ ] Stripe: webhook diterima dan status invoice berubah ke PAID
- [ ] Switch ke production keys setelah testing selesai

### Email

- [ ] Domain verified di Resend (SPF, DKIM, DMARC pass)
- [ ] Test kirim invoice email — diterima di inbox (bukan spam)
- [ ] Template render dengan benar di Gmail, Outlook, Apple Mail

### PDF

- [ ] Invoice PDF ter-generate dan tersimpan di Storage
- [ ] PDF download via signed URL berfungsi
- [ ] Signed URL expire setelah 1 jam

### Background Jobs

- [ ] Cron `check-overdue` berjalan — invoice overdue ter-update
- [ ] Cron `send-reminders` — email pengingat terkirim
- [ ] Event-based PDF generation berjalan

### Security

- [ ] Semua environment variables ter-set (tidak ada placeholder)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` TIDAK ter-expose di client bundle
- [ ] Response headers: HSTS, CSP, X-Frame-Options ter-set
- [ ] Rate limiting aktif di auth & public endpoints
- [ ] `npm audit` tidak menunjukkan critical vulnerabilities

---

## 9. CI/CD Pipeline

### GitHub Actions Workflow

Buat file `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint
        name: Lint

      - run: pnpm test
        name: Unit Tests

      - run: pnpm build
        name: Build Check
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=high
        name: Security Audit
```

### Branch Strategy

```
main        → production (auto-deploy ke Vercel)
develop     → staging/preview (auto-deploy preview URL)
feature/*   → PR ke develop (preview URL per PR)
hotfix/*    → PR ke main (emergency fix)
```

### Database Migration di CI

```yaml
  migrate:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    needs: lint-test
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: npx prisma migrate deploy
        name: Run Database Migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PRODUCTION }}
```

---

## 10. Monitoring & Observability

### 10.1. Sentry (Error Tracking)

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Konfigurasi minimal di `sentry.client.config.ts`:

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,        // 10% sampling di production
  replaysSessionSampleRate: 0,   // disable replay (hemat kuota)
  environment: process.env.NODE_ENV,
});
```

**Alert Rules** (buat di Sentry Dashboard):
- Payment webhook failure → Slack/Email alert (immediate)
- Unhandled exception rate > 1% → alert
- PDF generation failure → alert

### 10.2. Vercel Analytics

Otomatis tersedia di Vercel Dashboard:
- **Web Vitals**: LCP, FID, CLS
- **Real User Monitoring**: latency per route
- **Serverless Function**: cold start, duration, errors

### 10.3. Supabase Monitoring

- **Database → Reports**: query performance, connections, storage
- **Logs → API**: request logs, auth events
- Set alert jika database usage > 80% capacity

### 10.4. Uptime Monitoring

Gunakan [BetterStack](https://betterstack.com) atau [UptimeRobot](https://uptimerobot.com) (gratis):

| Monitor | URL | Interval | Alert |
|---|---|---|---|
| Homepage | `https://swiftinvoice.id` | 1 menit | Email + Slack |
| API Health | `https://swiftinvoice.id/api/v1/health` | 1 menit | Email + Slack |
| Public Invoice | `https://swiftinvoice.id/api/v1/public/invoices/test` | 5 menit | Email |

---

## 11. Scaling & Performance

### 11.1. Database

| Fase | Supabase Tier | Kapasitas | Trigger Upgrade |
|---|---|---|---|
| MVP (0–500 users) | Free | 500 MB, 2 connections | — |
| Growth (500–5k users) | Pro ($25/bulan) | 8 GB, 60 connections | DB usage > 80% |
| Scale (5k–50k users) | Pro + Read Replica | 100 GB, pooler | Query latency > 200ms |
| Enterprise (50k+) | Enterprise | Custom | Dedicated support needed |

**Connection Pooling**: Aktifkan Supabase connection pooler (PgBouncer) di production:

```
# Gunakan pooler URL untuk application queries
DATABASE_URL = postgresql://...supabase.co:6543/postgres?pgbouncer=true

# Gunakan direct URL untuk migrations
DIRECT_URL = postgresql://...supabase.co:5432/postgres
```

### 11.2. Vercel

| Optimasi | Cara |
|---|---|
| Edge caching | `Cache-Control` header pada static assets & public invoice |
| ISR | Incremental Static Regeneration untuk landing page |
| Edge Functions | Pindahkan public invoice view ke Edge Runtime |
| Function bundling | Barrel file optimization, tree-shaking |

### 11.3. Caching Strategy

```
Static assets (CSS/JS/images)  → CDN, immutable, 1 year
Landing page                   → ISR, revalidate: 3600
Dashboard data                 → no-store, fresh on every request
Public invoice                 → private, max-age=300 (5 min)
PDF download (signed URL)      → no-cache (URL itself expires)
```

### 11.4. Database Index Review

Jika query melambat, tambahkan index berdasarkan query pattern:

```sql
-- Jika sering filter by date range
CREATE INDEX idx_invoices_issue_date ON invoices (user_id, issue_date DESC);

-- Jika sering search invoice number
CREATE INDEX idx_invoices_number_trgm ON invoices
  USING gin (invoice_number gin_trgm_ops);

-- Jika client list sering di-search
CREATE INDEX idx_clients_name_trgm ON clients
  USING gin (name gin_trgm_ops);
```

---

## 12. Rollback & Disaster Recovery

### 12.1. Application Rollback

```bash
# Vercel: rollback ke deployment sebelumnya (instant)
# Via Dashboard: Deployments → pilih deployment → Promote to Production

# Via CLI:
npx vercel rollback
```

### 12.2. Database Rollback

**Prisma Migration Rollback:**

```bash
# Rollback 1 migration terakhir
npx prisma migrate resolve --rolled-back <migration_name>

# Manual SQL rollback
psql $DATABASE_URL -f prisma/migrations/<timestamp>/rollback.sql
```

**Supabase Point-in-Time Recovery (PITR):**

- Tersedia di Pro plan
- Bisa restore ke titik waktu manapun dalam 7 hari terakhir
- Proses via Supabase Dashboard → Database → Backups

### 12.3. Disaster Recovery Plan

| Skenario | RTO | RPO | Aksi |
|---|---|---|---|
| Vercel down | 0 menit | 0 | Failover otomatis (Vercel multi-region) |
| Supabase region down | 30 menit | 5 menit | PITR restore ke region baru |
| Data corruption | 1 jam | 1 menit | PITR restore ke pre-corruption timestamp |
| Credential leak | 15 menit | 0 | Rotate semua keys, revoke sessions |
| DNS hijack | 1 jam | 0 | Kontak registrar, update NS records |

### 12.4. Backup Strategy

| Data | Metode | Frekuensi | Retensi |
|---|---|---|---|
| Database | Supabase automatic backup | Continuous (PITR) | 7 hari (Pro) |
| PDF files | Supabase Storage (replicated) | Real-time | Indefinite |
| Source code | Git (GitHub) | Every push | Indefinite |
| Environment vars | Vercel encrypted storage | On change | Current version |
| Migration files | Git (committed) | Every schema change | Indefinite |

---

## 13. Troubleshooting

### Build Errors

**`prisma generate` fails on Vercel:**

```
# Pastikan Build Command sudah benar:
prisma generate && next build
```

**`@prisma/client` not found:**

```bash
# Tambahkan postinstall script di package.json
"scripts": {
  "postinstall": "prisma generate"
}
```

### Database

**Connection refused:**

```bash
# Cek apakah IP di-whitelist (Supabase → Database → Network)
# Vercel: otomatis, development: pastikan pakai SSL

# Test koneksi
psql "postgresql://postgres:PASSWORD@db.REF.supabase.co:5432/postgres"
```

**"Max connections reached":**

```bash
# Gunakan connection pooler (port 6543, bukan 5432)
# Kurangi Prisma connection pool:
DATABASE_URL="postgresql://...?connection_limit=5"
```

### Payment Webhook

**Webhook tidak diterima:**

1. Cek URL webhook di dashboard gateway (typo?)
2. Cek Vercel Function Logs — apakah request masuk?
3. Cek apakah response 200 dikembalikan (gateway retry jika non-2xx)
4. Development: pastikan ngrok/Stripe CLI running

**Payment tercatat duplikat:**

```
Cek idempotency: query payments WHERE gateway_tx_id = ?
Jika sudah ada, return 200 OK tanpa create baru
```

### Email

**Email masuk spam:**

1. Verifikasi domain DNS: SPF ✓, DKIM ✓, DMARC ✓
2. Gunakan `noreply@yourdomain.com` (bukan freemail)
3. Cek Resend Dashboard → Logs untuk bounce/complaint

### Performance

**Dashboard lambat:**

```sql
-- Cek slow queries di Supabase → Logs → Database
-- Tambahkan index sesuai bagian 11.4
-- Pertimbangkan materialized view untuk aggregasi
```

**PDF generation timeout (> 10s):**

```
Pindahkan ke background job (Trigger.dev) alih-alih
generate di API handler. Return URL setelah job selesai.
```

---

## Quick Reference — Perintah Penting

```bash
# ──── Development ────
pnpm dev                          # Start dev server
pnpm test                         # Run tests
pnpm lint                         # Lint check
pnpm db:studio                    # Open Prisma Studio (DB GUI)

# ──── Database ────
pnpm db:generate                  # Generate Prisma Client
pnpm db:push                      # Push schema (dev only)
pnpm db:migrate                   # Create + apply migration (dev)
npx prisma migrate deploy         # Apply migrations (production)

# ──── Deployment ────
git push origin main              # Auto deploy ke production
npx vercel --prod                 # Manual deploy
npx vercel rollback               # Rollback ke deployment sebelumnya

# ──── Debug ────
npx vercel logs                   # Lihat function logs
npx vercel env pull               # Pull env vars ke .env.local
stripe listen --forward-to ...    # Forward Stripe webhook ke local
```
