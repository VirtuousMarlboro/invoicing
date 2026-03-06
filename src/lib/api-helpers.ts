/**
 * SwiftInvoice — API Route Definitions
 *
 * Next.js 15 App Router: setiap file route.ts di folder sesuai
 * dengan endpoint REST. File ini adalah referensi peta routing.
 *
 * Struktur folder:
 * src/app/api/v1/
 * ├── auth/
 * │   ├── register/route.ts       POST
 * │   ├── login/route.ts          POST
 * │   ├── refresh/route.ts        POST
 * │   ├── forgot-password/route.ts POST
 * │   └── reset-password/route.ts POST
 * ├── users/
 * │   └── me/
 * │       ├── route.ts            GET, PATCH
 * │       └── logo/route.ts       POST
 * ├── clients/
 * │   ├── route.ts                GET, POST
 * │   └── [id]/route.ts           GET, PATCH, DELETE
 * ├── products/
 * │   ├── route.ts                GET, POST
 * │   └── [id]/route.ts           GET, PATCH, DELETE
 * ├── invoices/
 * │   ├── route.ts                GET, POST
 * │   └── [id]/
 * │       ├── route.ts            GET, PATCH, DELETE
 * │       ├── send/route.ts       POST
 * │       ├── mark-paid/route.ts  POST
 * │       ├── cancel/route.ts     POST
 * │       ├── pdf/route.ts        GET
 * │       ├── regenerate-link/route.ts   POST
 * │       ├── remind/route.ts     POST
 * │       ├── items/
 * │       │   ├── route.ts        POST
 * │       │   └── [itemId]/route.ts  PATCH, DELETE
 * │       └── payments/
 * │           └── route.ts        GET, POST
 * ├── webhooks/
 * │   ├── midtrans/route.ts       POST
 * │   └── stripe/route.ts         POST
 * ├── dashboard/
 * │   └── summary/route.ts        GET
 * ├── reports/
 * │   └── invoices/route.ts       GET
 * └── public/
 *     └── invoices/
 *         └── [token]/
 *             ├── route.ts        GET
 *             └── pay/route.ts    POST
 */

import { NextRequest, NextResponse } from "next/server";

// ──────────────── Helpers ────────────────

/**
 * Standard API response wrapper
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
) {
  return NextResponse.json(
    { error: { code, message, ...(details && { details }) } },
    { status }
  );
}

export function apiNotFound(resource = "Resource") {
  return apiError("NOT_FOUND", `${resource} not found`, 404);
}

export function apiForbidden() {
  return apiError("FORBIDDEN", "You do not have access to this resource", 403);
}

export function apiUnauthorized() {
  return apiError("UNAUTHORIZED", "Authentication required", 401);
}

/**
 * Validasi Zod schema dan return parsed data atau error response.
 */
export async function parseBody<T>(
  request: NextRequest,
  schema: { parseAsync: (data: unknown) => Promise<T> }
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  try {
    const body = await request.json();
    const data = await schema.parseAsync(body);
    return { data };
  } catch (err: any) {
    if (err.issues) {
      return {
        error: apiError("VALIDATION_ERROR", "Invalid input", 422, err.issues),
      };
    }
    return {
      error: apiError("BAD_REQUEST", "Invalid JSON body", 400),
    };
  }
}

// ──────────────── Contoh: Invoices CRUD ────────────────

/**
 * GET /api/v1/invoices — List invoices (paginated, filtered)
 *
 * Query params:
 *   ?status=SENT&clientId=xxx&dateFrom=2026-01-01&dateTo=2026-03-31
 *   &cursor=<uuid>&limit=20&search=keyword
 */
export async function listInvoicesHandler(request: NextRequest) {
  // 1. Auth: extract user from JWT
  // 2. Parse query params with invoiceFilterSchema
  // 3. Query database with RLS (user_id = auth.uid)
  // 4. Return paginated results

  // Placeholder — actual implementation in route file
  return apiSuccess({ invoices: [], nextCursor: null });
}

/**
 * POST /api/v1/invoices — Create invoice
 *
 * Body: CreateInvoiceInput (validated by Zod)
 * - Auto-generates invoice_number dari user prefix + counter
 * - Kalkulasi totals server-side (tidak trust client)
 * - Creates invoice + line_items dalam satu transaction
 */
export async function createInvoiceHandler(request: NextRequest) {
  // 1. Auth
  // 2. Validate body with createInvoiceSchema
  // 3. Generate invoice number: `${user.invoicePrefix}-${year}-${counter.toString().padStart(4, '0')}`
  // 4. Calculate totals with calculateInvoiceTotals()
  // 5. DB transaction: increment counter + insert invoice + insert line_items
  // 6. Return created invoice

  return apiSuccess({}, 201);
}

/**
 * POST /api/v1/invoices/:id/send — Send invoice
 *
 * Side effects:
 * - Generate PDF (background job)
 * - Generate public_token jika belum ada
 * - Kirim email ke client
 * - Update status: DRAFT → SENT
 * - Set sent_at timestamp
 */
export async function sendInvoiceHandler(request: NextRequest) {
  // 1. Auth + ownership check
  // 2. Verify status === DRAFT
  // 3. Generate crypto random public_token
  // 4. Queue PDF generation job
  // 5. Queue email send job
  // 6. Update invoice status + sent_at
  // 7. Return updated invoice

  return apiSuccess({ message: "Invoice sent" });
}

/**
 * POST /api/v1/webhooks/midtrans — Midtrans webhook handler
 *
 * Security:
 * - Verify signature (SHA-512)
 * - Idempotency check on gateway_tx_id
 * - Store raw payload for audit
 */
export async function midtransWebhookHandler(request: NextRequest) {
  // 1. Parse body
  // 2. Verify SHA-512 signature
  // 3. Check idempotency (gateway_tx_id exists?)
  // 4. Map Midtrans status → our payment status
  // 5. Create payment record
  // 6. Update invoice amount_paid
  // 7. If fully paid: status → PAID, set paid_at
  // 8. Return 200 OK

  return NextResponse.json({ status: "ok" });
}
