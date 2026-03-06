import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(products);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  const price = Number(body.price) || 0;

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  // Avoid duplicate products with the same normalized name and same price.
  const sameNameCandidates = await prisma.product.findMany({
    where: { name },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const existing = sameNameCandidates.find(
    (p) => p.name.trim().toLowerCase() === name.toLowerCase() && Number(p.price) === price,
  );
  if (existing) {
    return NextResponse.json({ ...existing, created: false });
  }

  const product = await prisma.product.create({
    data: { name, price },
  });
  return NextResponse.json({ ...product, created: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.product.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const id = Number(body.id);
  const name = String(body.name || "").trim();
  const price = Number(body.price) || 0;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const candidates = await prisma.product.findMany({
    where: { name },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const duplicate = candidates.find(
    (p) => p.id !== id && p.name.trim().toLowerCase() === name.toLowerCase() && Number(p.price) === price,
  );
  if (duplicate) {
    return NextResponse.json({ error: "duplicate product" }, { status: 409 });
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { name, price },
  });
  return NextResponse.json(updated);
}
