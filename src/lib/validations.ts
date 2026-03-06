/**
 * SwiftInvoice — Zod Validation Schemas
 *
 * Digunakan untuk validasi input API (server-side)
 * dan form validation (client-side) — single source of truth.
 */

import { z } from "zod";

// ──────────────── Shared Primitives ────────────────

const uuid = z.string().uuid();
const positiveInt = z.number().int().nonneg();
const positiveBigInt = z.bigint().nonneg();
const basisPoints = z.number().int().min(0).max(10000); // 0% → 100%
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currency = z.string().length(3).toUpperCase().default("IDR");

// ──────────────── Line Item ────────────────

export const lineItemSchema = z.object({
  productId: uuid.optional().nullable(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive().max(999_999),
  unitPrice: positiveBigInt,
  sortOrder: positiveInt.optional().default(0),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;

// ──────────────── Invoice Create ────────────────

export const createInvoiceSchema = z.object({
  clientId: uuid,
  issueDate: isoDate,
  dueDate: isoDate,
  currency: currency,
  discountType: z.enum(["FLAT", "PERCENTAGE"]).default("FLAT"),
  discountValue: positiveBigInt.default(0n),
  taxRateBps: basisPoints.default(0),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
  lineItems: z.array(lineItemSchema).min(1, "Invoice harus memiliki minimal 1 item"),
}).refine(
  (data) => new Date(data.dueDate) >= new Date(data.issueDate),
  { message: "Due date harus sama atau setelah issue date", path: ["dueDate"] }
);

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// ──────────────── Invoice Update ────────────────

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  lineItems: z.array(lineItemSchema).min(1).optional(),
});

export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

// ──────────────── Client ────────────────

export const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(255).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  country: z.string().length(2).toUpperCase().default("ID"),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial();
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

// ──────────────── Product ────────────────

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  unitPrice: positiveBigInt,
  unit: z.string().max(30).default("unit"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ──────────────── Payment (Manual) ────────────────

export const createPaymentSchema = z.object({
  amount: z.bigint().positive("Jumlah pembayaran harus lebih dari 0"),
  method: z.enum(["GATEWAY", "BANK_TRANSFER", "CASH", "OTHER"]),
  notes: z.string().max(500).optional().nullable(),
  paidAt: z.string().datetime(), // ISO 8601
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ──────────────── Pagination & Filters ────────────────

export const paginationSchema = z.object({
  cursor: uuid.optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const invoiceFilterSchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  clientId: uuid.optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  search: z.string().max(100).optional(),
});

export type InvoiceFilter = z.infer<typeof invoiceFilterSchema>;

// ──────────────── User Profile Update ────────────────

export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(150).optional(),
  businessName: z.string().max(200).optional().nullable(),
  businessAddress: z.string().max(1000).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  defaultTaxRate: basisPoints.optional(),
  defaultCurrency: currency.optional(),
  invoicePrefix: z.string().max(10).optional(),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
