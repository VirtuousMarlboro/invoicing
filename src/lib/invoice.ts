export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceData {
  // Pengirim
  senderName: string;
  senderAddress: string;
  senderEmail: string;
  senderPhone: string;
  senderLogo: string;

  // Penerima
  clientName: string;
  clientAddress: string;
  clientEmail: string;

  // Invoice
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;

  // Items
  items: LineItem[];

  // Totals
  notes: string;
  taxRate: number; // persen, misal 11
  discountPercent: number; // persen, misal 5
}

export function calcLineAmount(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export function calcSubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function calcDiscount(subtotal: number, discountPercent: number): number {
  return Math.round(subtotal * discountPercent) / 100;
}

export function calcTax(afterDiscount: number, taxRate: number): number {
  return Math.round(afterDiscount * taxRate) / 100;
}

export function calcTotals(items: LineItem[], taxRate: number, discountPercent: number) {
  const subtotal = calcSubtotal(items);
  const discount = calcDiscount(subtotal, discountPercent);
  const afterDiscount = subtotal - discount;
  const tax = calcTax(afterDiscount, taxRate);
  const grandTotal = afterDiscount + tax;

  return { subtotal, discount, afterDiscount, tax, grandTotal };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function defaultInvoice(): InvoiceData {
  return {
    senderName: "",
    senderAddress: "",
    senderEmail: "",
    senderPhone: "",
    senderLogo: "",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    invoiceNumber: `INV-${new Date().getFullYear()}-001`,
    invoiceDate: todayString(),
    dueDate: "",
    items: [{ id: generateId(), description: "", quantity: 1, unitPrice: 0, amount: 0 }],
    notes: "",
    taxRate: 11,
    discountPercent: 0,
  };
}
