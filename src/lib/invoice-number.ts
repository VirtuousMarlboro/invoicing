/**
 * SwiftInvoice — Invoice Number Generator
 *
 * Format: {PREFIX}-{YEAR}-{COUNTER:4}
 * Contoh: INV-2026-0042
 *
 * Counter di-increment secara atomik per user di database
 * untuk menghindari race condition pada concurrent requests.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Generate nomor invoice unik secara atomik.
 * Menggunakan SQL UPDATE ... RETURNING untuk atomic increment.
 */
export async function generateInvoiceNumber(userId: string): Promise<string> {
  const year = new Date().getFullYear();

  // Atomic increment + return dalam 1 query
  const [updated] = await prisma.$queryRawUnsafe<
    { invoice_prefix: string; invoice_counter: number }[]
  >(
    `UPDATE users
     SET invoice_counter = invoice_counter + 1, updated_at = NOW()
     WHERE id = $1::uuid
     RETURNING invoice_prefix, invoice_counter`,
    userId
  );

  if (!updated) {
    throw new Error(`User ${userId} not found`);
  }

  const counter = updated.invoice_counter.toString().padStart(4, "0");
  return `${updated.invoice_prefix}-${year}-${counter}`;
}

/**
 * Generate cryptographically random token untuk public invoice link.
 * 32 bytes → 64 karakter hex string.
 */
export function generatePublicToken(): string {
  const { randomBytes } = require("crypto");
  return randomBytes(32).toString("hex");
}
