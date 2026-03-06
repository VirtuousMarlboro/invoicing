import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    select: { id: true, grandTotal: true, status: true, invoiceDate: true },
  });

  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  const draftCount = invoices.filter((i) => i.status === "draft").length;
  const draftAmount = invoices.filter((i) => i.status === "draft").reduce((sum, i) => sum + i.grandTotal, 0);
  const sentCount = invoices.filter((i) => i.status === "sent").length;
  const sentAmount = invoices.filter((i) => i.status === "sent").reduce((sum, i) => sum + i.grandTotal, 0);

  const monthlyMap = new Map<string, { total: number; count: number }>();
  for (const inv of invoices) {
    const month = inv.invoiceDate.substring(0, 7);
    const existing = monthlyMap.get(month) || { total: 0, count: 0 };
    existing.total += inv.grandTotal;
    existing.count += 1;
    monthlyMap.set(month, existing);
  }
  const monthly = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => b.month.localeCompare(a.month));

  return NextResponse.json({
    totalInvoices,
    totalRevenue,
    draftCount,
    draftAmount,
    sentCount,
    sentAmount,
    monthly,
  });
}
