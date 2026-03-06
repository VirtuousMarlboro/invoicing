import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/invoices/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(id) } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...invoice,
    items: JSON.parse(invoice.items),
  });
}

// DELETE /api/invoices/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.invoice.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
