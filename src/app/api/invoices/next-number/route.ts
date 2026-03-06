import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/invoices/next-number — returns the next auto-increment invoice number
export async function GET() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Find the latest invoice number with this year's prefix
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });

  let seq = 1;
  if (latest) {
    const parts = latest.invoiceNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`;
  return NextResponse.json({ invoiceNumber });
}
