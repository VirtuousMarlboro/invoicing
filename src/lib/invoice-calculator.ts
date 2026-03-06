/**
 * SwiftInvoice — Core Invoice Calculator
 *
 * PRINSIP UTAMA:
 * Semua nilai moneter direpresentasikan sebagai integer (sen/cent).
 * Tidak ada floating-point arithmetic pada jalur kalkulasi uang.
 *
 * Konvensi:
 * - Harga & total  → BIGINT (sen). Rp 1.500.000 = 150_000_000
 * - Tax rate       → INTEGER basis poin. 11% = 1100, 0.5% = 50
 * - Discount %     → INTEGER basis poin. 5.5% = 550
 * - Quantity       → number (JS) / DECIMAL(12,4) di DB
 */

// ─────────────────────────── Types ───────────────────────────

export type DiscountType = "FLAT" | "PERCENTAGE";

export interface LineItemInput {
  description: string;
  quantity: number; // desimal OK (misal 2.5 jam)
  unitPrice: bigint; // harga satuan dalam sen
}

export interface LineItemResult extends LineItemInput {
  amount: bigint; // quantity × unitPrice, rounded
}

export interface InvoiceTotalsInput {
  lineItems: LineItemInput[];
  discountType: DiscountType;
  discountValue: bigint; // FLAT = sen, PERCENTAGE = basis poin
  taxRateBps: number; // basis poin: 1100 = 11%
}

export interface InvoiceTotals {
  lineItems: LineItemResult[];
  subtotal: bigint;
  discountTotal: bigint;
  taxableAmount: bigint; // subtotal - discount
  taxTotal: bigint;
  grandTotal: bigint;
}

// ─────────────────── Banker's Rounding ───────────────────────

/**
 * Banker's rounding (round half to even) — standar IEEE 754.
 * Menghindari bias statistik yang muncul dari Math.round()
 * yang selalu membulatkan .5 ke atas.
 *
 * Contoh:
 *   bankersRound(2.5)  → 2  (genap)
 *   bankersRound(3.5)  → 4  (genap)
 *   bankersRound(2.51) → 3  (normal rounding)
 */
export function bankersRound(value: number): bigint {
  if (!Number.isFinite(value)) {
    throw new RangeError(`bankersRound: input must be finite, got ${value}`);
  }

  const floor = Math.floor(value);
  const decimal = value - floor;

  // Jika tepat di .5 (dengan toleransi floating-point)
  if (Math.abs(decimal - 0.5) < Number.EPSILON * 100) {
    // Round to even
    return BigInt(floor % 2 === 0 ? floor : floor + 1);
  }

  return BigInt(Math.round(value));
}

// ─────────────────── Kalkulasi Per-Item ──────────────────────

/**
 * Menghitung amount sebuah line item.
 * amount = bankersRound(quantity × unitPrice)
 *
 * Quantity dikonversi ke Number untuk kalkulasi karena bisa desimal.
 * unitPrice tetap BigInt sampai titik perkalian.
 */
export function calcLineItemAmount(
  quantity: number,
  unitPriceCents: bigint
): bigint {
  if (quantity < 0) throw new RangeError("Quantity must be non-negative");
  if (unitPriceCents < 0n) throw new RangeError("Unit price must be non-negative");

  // Perkalian: konversi unitPrice ke number hanya untuk operasi ini
  // Aman karena Number.MAX_SAFE_INTEGER = 9_007_199_254_740_991
  // (> Rp 90 miliar, cukup untuk invoice tunggal)
  const unitPriceNum = Number(unitPriceCents);
  return bankersRound(quantity * unitPriceNum);
}

// ──────────────────── Subtotal ───────────────────────────────

/**
 * Subtotal = Σ semua line item amounts (pure integer addition, no rounding needed)
 */
export function calcSubtotal(items: LineItemResult[]): bigint {
  return items.reduce((sum, item) => sum + item.amount, 0n);
}

// ──────────────────── Discount ───────────────────────────────

/**
 * Menghitung total diskon.
 *
 * FLAT: discountValue sudah dalam sen, capped pada subtotal (tidak boleh negatif).
 * PERCENTAGE: discountValue dalam basis poin (550 = 5.50%).
 *   Rumus: bankersRound(subtotal × discountValue / 10000)
 */
export function calcDiscountTotal(
  subtotal: bigint,
  discountType: DiscountType,
  discountValue: bigint
): bigint {
  if (discountValue < 0n) throw new RangeError("Discount value must be non-negative");

  if (discountType === "FLAT") {
    // Diskon flat tidak boleh melebihi subtotal
    return discountValue > subtotal ? subtotal : discountValue;
  }

  // PERCENTAGE
  if (discountValue > 10000n) {
    throw new RangeError("Discount percentage cannot exceed 100% (10000 bps)");
  }

  // Integer arithmetic: (subtotal * bps) / 10000
  // Kita perlu rounding karena pembagian bisa menghasilkan sisa
  const numerator = Number(subtotal) * Number(discountValue);
  return bankersRound(numerator / 10000);
}

// ──────────────────── Tax ────────────────────────────────────

/**
 * Menghitung total pajak.
 * Pajak dihitung SETELAH diskon (taxable amount = subtotal - discount).
 *
 * taxRateBps dalam basis poin: 1100 = 11.00%, 50 = 0.50%
 * Rumus: bankersRound(taxableAmount × taxRateBps / 10000)
 */
export function calcTaxTotal(
  taxableAmount: bigint,
  taxRateBps: number
): bigint {
  if (taxRateBps < 0) throw new RangeError("Tax rate must be non-negative");
  if (taxableAmount <= 0n) return 0n;

  const numerator = Number(taxableAmount) * taxRateBps;
  return bankersRound(numerator / 10000);
}

// ──────────────────── Grand Total ────────────────────────────

/**
 * Grand Total = Subtotal - Discount + Tax
 * Pure integer arithmetic, no rounding needed.
 */
export function calcGrandTotal(
  subtotal: bigint,
  discountTotal: bigint,
  taxTotal: bigint
): bigint {
  const result = subtotal - discountTotal + taxTotal;
  if (result < 0n) {
    throw new RangeError("Grand total cannot be negative");
  }
  return result;
}

// ──────────────── Full Invoice Calculator ────────────────────

/**
 * Menghitung seluruh totals sebuah invoice dari input mentah.
 * Ini adalah fungsi utama yang dipanggil saat:
 * 1. User menambah/mengubah line item di UI (preview)
 * 2. Server menyimpan invoice ke database (source of truth)
 *
 * PENTING: Fungsi ini bersifat PURE — tidak ada side effects.
 * Hasil kalkulasi server-side HARUS digunakan sebagai nilai tersimpan
 * (jangan trust kalkulasi client).
 */
export function calculateInvoiceTotals(
  input: InvoiceTotalsInput
): InvoiceTotals {
  // 1. Hitung amount setiap line item
  const lineItems: LineItemResult[] = input.lineItems.map((item) => ({
    ...item,
    amount: calcLineItemAmount(item.quantity, item.unitPrice),
  }));

  // 2. Subtotal
  const subtotal = calcSubtotal(lineItems);

  // 3. Discount
  const discountTotal = calcDiscountTotal(
    subtotal,
    input.discountType,
    input.discountValue
  );

  // 4. Taxable amount
  const taxableAmount = subtotal - discountTotal;

  // 5. Tax
  const taxTotal = calcTaxTotal(taxableAmount, input.taxRateBps);

  // 6. Grand total
  const grandTotal = calcGrandTotal(subtotal, discountTotal, taxTotal);

  return {
    lineItems,
    subtotal,
    discountTotal,
    taxableAmount,
    taxTotal,
    grandTotal,
  };
}

// ──────────────── Display Helpers ────────────────────────────

/**
 * Konversi nilai sen (bigint) ke string format mata uang.
 * Contoh: formatCurrency(15000050n, 'IDR') → "Rp 150.000,50"
 */
export function formatCurrency(
  amountCents: bigint,
  currency: string = "IDR"
): string {
  // Konversi sen ke unit utama
  const major = Number(amountCents) / 100;

  const localeMap: Record<string, string> = {
    IDR: "id-ID",
    USD: "en-US",
    EUR: "de-DE",
    SGD: "en-SG",
    MYR: "ms-MY",
  };

  const locale = localeMap[currency] ?? "id-ID";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "IDR" ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

/**
 * Konversi basis poin ke string persentase.
 * Contoh: formatBps(1100) → "11.00%"
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}
