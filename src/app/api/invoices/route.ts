import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcTotals } from "@/lib/invoice";
import type { LineItem } from "@/lib/invoice";

// GET /api/invoices — list all invoices (newest first)
export async function GET() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      clientName: true,
      status: true,
      grandTotal: true,
      createdAt: true,
    },
  });
  return NextResponse.json(invoices);
}

// POST /api/invoices — create or update an invoice
export async function POST(req: Request) {
  const body = await req.json();

  const items: LineItem[] = Array.isArray(body.items) ? body.items : [];
  const totals = calcTotals(
    items,
    Number(body.taxRate) || 0,
    Number(body.discountPercent) || 0,
    Number(body.roundingAmount) || 0,
  );

  const data = {
    invoiceNumber: String(body.invoiceNumber || ""),
    invoiceDate: String(body.invoiceDate || ""),
    dueDate: String(body.dueDate || ""),
    senderBusiness: String(body.senderBusiness || ""),
    senderName: String(body.senderName || ""),
    senderAddress: String(body.senderAddress || ""),
    senderEmail: String(body.senderEmail || ""),
    senderPhone: String(body.senderPhone || ""),
    senderLogo: String(body.senderLogo || ""),
    clientName: String(body.clientName || ""),
    clientAddress: String(body.clientAddress || ""),
    clientEmail: String(body.clientEmail || ""),
    items: JSON.stringify(items),
    notes: String(body.notes || ""),
    taxRate: Number(body.taxRate) || 0,
    discountPercent: Number(body.discountPercent) || 0,
    roundingAmount: Number(body.roundingAmount) || 0,
    signature: String(body.signature || ""),
    status: String(body.status || "draft"),
    grandTotal: totals.grandTotal,
    paymentBankName: String(body.paymentBankName || ""),
    paymentBankAccount: String(body.paymentBankAccount || ""),
    paymentAccountHolder: String(body.paymentAccountHolder || ""),
  };

  if (body.id) {
    // Update existing
    const invoice = await prisma.invoice.update({
      where: { id: Number(body.id) },
      data,
    });
    return NextResponse.json(invoice);
  }

  // Create new
  const invoice = await prisma.invoice.create({ data });
  return NextResponse.json(invoice, { status: 201 });
}
