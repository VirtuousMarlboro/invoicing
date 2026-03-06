/**
 * SwiftInvoice — Invoice Calculator Unit Tests
 *
 * Memastikan presisi kalkulasi moneter tanpa floating-point error.
 * Jalankan: npx vitest run src/lib/__tests__/invoice-calculator.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  bankersRound,
  calcLineItemAmount,
  calcSubtotal,
  calcDiscountTotal,
  calcTaxTotal,
  calcGrandTotal,
  calculateInvoiceTotals,
  formatCurrency,
  formatBps,
  type LineItemResult,
} from "../invoice-calculator";

// ────────────────── bankersRound ──────────────────

describe("bankersRound", () => {
  it("rounds 2.5 to 2 (even)", () => {
    expect(bankersRound(2.5)).toBe(2n);
  });

  it("rounds 3.5 to 4 (even)", () => {
    expect(bankersRound(3.5)).toBe(4n);
  });

  it("rounds 2.51 to 3 (normal)", () => {
    expect(bankersRound(2.51)).toBe(3n);
  });

  it("rounds 2.49 to 2 (normal)", () => {
    expect(bankersRound(2.49)).toBe(2n);
  });

  it("handles negative values", () => {
    expect(bankersRound(-2.5)).toBe(-2n);
  });

  it("handles zero", () => {
    expect(bankersRound(0)).toBe(0n);
  });

  it("throws on NaN", () => {
    expect(() => bankersRound(NaN)).toThrow(RangeError);
  });

  it("throws on Infinity", () => {
    expect(() => bankersRound(Infinity)).toThrow(RangeError);
  });
});

// ────────────────── calcLineItemAmount ──────────────────

describe("calcLineItemAmount", () => {
  it("calculates integer quantity × price", () => {
    // 3 × Rp 50.000 (5_000_000 sen) = Rp 150.000 (15_000_000 sen)
    expect(calcLineItemAmount(3, 5_000_000n)).toBe(15_000_000n);
  });

  it("handles decimal quantity (2.5 hours)", () => {
    // 2.5 × Rp 200.000 (20_000_000 sen) = Rp 500.000 (50_000_000 sen)
    expect(calcLineItemAmount(2.5, 20_000_000n)).toBe(50_000_000n);
  });

  it("handles quantity with many decimals", () => {
    // 1.3333 × Rp 30.000 (3_000_000 sen) = Rp 39.999 (3_999_900 sen)
    expect(calcLineItemAmount(1.3333, 3_000_000n)).toBe(3_999_900n);
  });

  it("returns 0 for zero quantity", () => {
    expect(calcLineItemAmount(0, 5_000_000n)).toBe(0n);
  });

  it("throws on negative quantity", () => {
    expect(() => calcLineItemAmount(-1, 5_000_000n)).toThrow(RangeError);
  });

  it("throws on negative price", () => {
    expect(() => calcLineItemAmount(1, -5_000_000n)).toThrow(RangeError);
  });
});

// ────────────────── calcSubtotal ──────────────────

describe("calcSubtotal", () => {
  it("sums all line item amounts", () => {
    const items: LineItemResult[] = [
      { description: "Design", quantity: 1, unitPrice: 5_000_000n, amount: 5_000_000n },
      { description: "Dev", quantity: 2, unitPrice: 10_000_000n, amount: 20_000_000n },
      { description: "QA", quantity: 1, unitPrice: 3_000_000n, amount: 3_000_000n },
    ];
    expect(calcSubtotal(items)).toBe(28_000_000n);
  });

  it("returns 0 for empty list", () => {
    expect(calcSubtotal([])).toBe(0n);
  });
});

// ────────────────── calcDiscountTotal ──────────────────

describe("calcDiscountTotal", () => {
  const subtotal = 100_000_000n; // Rp 1.000.000

  it("FLAT discount: returns exact value", () => {
    expect(calcDiscountTotal(subtotal, "FLAT", 10_000_000n)).toBe(10_000_000n);
  });

  it("FLAT discount: capped at subtotal", () => {
    expect(calcDiscountTotal(subtotal, "FLAT", 200_000_000n)).toBe(100_000_000n);
  });

  it("PERCENTAGE discount: 10% (1000 bps)", () => {
    // 100_000_000 × 1000 / 10000 = 10_000_000
    expect(calcDiscountTotal(subtotal, "PERCENTAGE", 1000n)).toBe(10_000_000n);
  });

  it("PERCENTAGE discount: 5.5% (550 bps)", () => {
    // 100_000_000 × 550 / 10000 = 5_500_000
    expect(calcDiscountTotal(subtotal, "PERCENTAGE", 550n)).toBe(5_500_000n);
  });

  it("PERCENTAGE discount: throws if > 100%", () => {
    expect(() => calcDiscountTotal(subtotal, "PERCENTAGE", 10001n)).toThrow(RangeError);
  });

  it("throws on negative discount", () => {
    expect(() => calcDiscountTotal(subtotal, "FLAT", -1n)).toThrow(RangeError);
  });
});

// ────────────────── calcTaxTotal ──────────────────

describe("calcTaxTotal", () => {
  it("PPN 11% on Rp 1.000.000", () => {
    // 100_000_000 × 1100 / 10000 = 11_000_000
    expect(calcTaxTotal(100_000_000n, 1100)).toBe(11_000_000n);
  });

  it("PPN 11% on Rp 999.999", () => {
    // 99_999_900 × 1100 / 10000 = 10_999_989
    expect(calcTaxTotal(99_999_900n, 1100)).toBe(10_999_989n);
  });

  it("returns 0 for zero taxable amount", () => {
    expect(calcTaxTotal(0n, 1100)).toBe(0n);
  });

  it("returns 0 for zero tax rate", () => {
    expect(calcTaxTotal(100_000_000n, 0)).toBe(0n);
  });

  it("throws on negative tax rate", () => {
    expect(() => calcTaxTotal(100_000_000n, -100)).toThrow(RangeError);
  });
});

// ────────────────── calcGrandTotal ──────────────────

describe("calcGrandTotal", () => {
  it("subtotal - discount + tax", () => {
    expect(calcGrandTotal(100_000_000n, 10_000_000n, 9_900_000n)).toBe(99_900_000n);
  });

  it("throws if result would be negative", () => {
    expect(() => calcGrandTotal(10n, 100n, 0n)).toThrow(RangeError);
  });
});

// ────────────────── calculateInvoiceTotals (Integration) ──────────────────

describe("calculateInvoiceTotals", () => {
  it("full invoice: 3 items, 10% discount, 11% PPN", () => {
    const result = calculateInvoiceTotals({
      lineItems: [
        { description: "Web Design", quantity: 1, unitPrice: 50_000_000n },
        { description: "Frontend Dev", quantity: 40, unitPrice: 1_500_000n },
        { description: "Hosting Setup", quantity: 1, unitPrice: 5_000_000n },
      ],
      discountType: "PERCENTAGE",
      discountValue: 1000n, // 10%
      taxRateBps: 1100, // 11%
    });

    // Item amounts:
    // 1 × 50_000_000 = 50_000_000
    // 40 × 1_500_000 = 60_000_000
    // 1 × 5_000_000  = 5_000_000
    expect(result.lineItems[0].amount).toBe(50_000_000n);
    expect(result.lineItems[1].amount).toBe(60_000_000n);
    expect(result.lineItems[2].amount).toBe(5_000_000n);

    // Subtotal = 115_000_000
    expect(result.subtotal).toBe(115_000_000n);

    // Discount 10% of 115_000_000 = 11_500_000
    expect(result.discountTotal).toBe(11_500_000n);

    // Taxable = 115_000_000 - 11_500_000 = 103_500_000
    expect(result.taxableAmount).toBe(103_500_000n);

    // Tax 11% of 103_500_000 = 11_385_000
    expect(result.taxTotal).toBe(11_385_000n);

    // Grand = 103_500_000 + 11_385_000 = 114_885_000
    expect(result.grandTotal).toBe(114_885_000n);
  });

  it("invoice tanpa diskon dan tanpa pajak", () => {
    const result = calculateInvoiceTotals({
      lineItems: [
        { description: "Consulting", quantity: 5, unitPrice: 10_000_000n },
      ],
      discountType: "FLAT",
      discountValue: 0n,
      taxRateBps: 0,
    });

    expect(result.subtotal).toBe(50_000_000n);
    expect(result.discountTotal).toBe(0n);
    expect(result.taxTotal).toBe(0n);
    expect(result.grandTotal).toBe(50_000_000n);
  });

  it("invoice dengan diskon flat Rp 100.000", () => {
    const result = calculateInvoiceTotals({
      lineItems: [
        { description: "Service", quantity: 1, unitPrice: 100_000_000n },
      ],
      discountType: "FLAT",
      discountValue: 10_000_000n, // Rp 100.000
      taxRateBps: 1100,
    });

    // Subtotal = 100_000_000
    // Discount = 10_000_000
    // Taxable = 90_000_000
    // Tax = 90_000_000 × 1100 / 10000 = 9_900_000
    // Grand = 90_000_000 + 9_900_000 = 99_900_000
    expect(result.subtotal).toBe(100_000_000n);
    expect(result.discountTotal).toBe(10_000_000n);
    expect(result.taxableAmount).toBe(90_000_000n);
    expect(result.taxTotal).toBe(9_900_000n);
    expect(result.grandTotal).toBe(99_900_000n);
  });
});

// ────────────────── Display Helpers ──────────────────

describe("formatCurrency", () => {
  it("formats IDR correctly", () => {
    const result = formatCurrency(150_000_000n, "IDR");
    // Should contain "1.500.000" (IDR formatting)
    expect(result).toContain("1.500.000");
  });

  it("formats USD correctly", () => {
    const result = formatCurrency(15050n, "USD");
    // Should contain "$150.50"
    expect(result).toContain("150.50");
  });
});

describe("formatBps", () => {
  it("formats 1100 bps as 11.00%", () => {
    expect(formatBps(1100)).toBe("11.00%");
  });

  it("formats 550 bps as 5.50%", () => {
    expect(formatBps(550)).toBe("5.50%");
  });

  it("formats 0 bps as 0.00%", () => {
    expect(formatBps(0)).toBe("0.00%");
  });
});
