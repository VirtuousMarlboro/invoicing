import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  const address = String(body.address || "").trim();
  const email = String(body.email || "").trim();

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const clients = await prisma.client.findMany({
    where: { name },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const existing = clients.find(
    (c) =>
      c.name.trim().toLowerCase() === name.toLowerCase() &&
      c.address.trim().toLowerCase() === address.toLowerCase() &&
      c.email.trim().toLowerCase() === email.toLowerCase(),
  );
  if (existing) {
    return NextResponse.json({ ...existing, created: false });
  }

  const client = await prisma.client.create({
    data: { name, address, email },
  });
  return NextResponse.json({ ...client, created: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.client.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const id = Number(body.id);
  const name = String(body.name || "").trim();
  const address = String(body.address || "").trim();
  const email = String(body.email || "").trim();

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const candidates = await prisma.client.findMany({
    where: { name },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const duplicate = candidates.find(
    (c) =>
      c.id !== id &&
      c.name.trim().toLowerCase() === name.toLowerCase() &&
      c.address.trim().toLowerCase() === address.toLowerCase() &&
      c.email.trim().toLowerCase() === email.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json({ error: "duplicate client" }, { status: 409 });
  }

  const updated = await prisma.client.update({
    where: { id },
    data: { name, address, email },
  });
  return NextResponse.json(updated);
}
