import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const profiles = await prisma.senderProfile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  const body = await req.json();
  const payload = {
    name: String(body.name || "").trim(),
    business: String(body.business || "").trim(),
    senderName: String(body.senderName || "").trim(),
    address: String(body.address || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    logo: String(body.logo || ""),
    bankName: String(body.bankName || "").trim(),
    bankAccount: String(body.bankAccount || "").trim(),
    accountHolder: String(body.accountHolder || "").trim(),
  };

  if (!payload.name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const profiles = await prisma.senderProfile.findMany({
    where: { name: payload.name },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const existing = profiles.find(
    (p) =>
      p.name.trim().toLowerCase() === payload.name.toLowerCase() &&
      p.business.trim().toLowerCase() === payload.business.toLowerCase() &&
      p.senderName.trim().toLowerCase() === payload.senderName.toLowerCase() &&
      p.address.trim().toLowerCase() === payload.address.toLowerCase() &&
      p.email.trim().toLowerCase() === payload.email.toLowerCase() &&
      p.phone.trim().toLowerCase() === payload.phone.toLowerCase() &&
      p.bankName.trim().toLowerCase() === payload.bankName.toLowerCase() &&
      p.bankAccount.trim().toLowerCase() === payload.bankAccount.toLowerCase() &&
      p.accountHolder.trim().toLowerCase() === payload.accountHolder.toLowerCase(),
  );
  if (existing) {
    return NextResponse.json({ ...existing, created: false });
  }

  const profile = await prisma.senderProfile.create({
    data: payload,
  });
  return NextResponse.json({ ...profile, created: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.senderProfile.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const id = Number(body.id);
  const payload = {
    name: String(body.name || "").trim(),
    business: String(body.business || "").trim(),
    senderName: String(body.senderName || "").trim(),
    address: String(body.address || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    logo: String(body.logo || ""),
    bankName: String(body.bankName || "").trim(),
    bankAccount: String(body.bankAccount || "").trim(),
    accountHolder: String(body.accountHolder || "").trim(),
  };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!payload.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const candidates = await prisma.senderProfile.findMany({
    where: { name: payload.name },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const duplicate = candidates.find(
    (p) =>
      p.id !== id &&
      p.name.trim().toLowerCase() === payload.name.toLowerCase() &&
      p.business.trim().toLowerCase() === payload.business.toLowerCase() &&
      p.senderName.trim().toLowerCase() === payload.senderName.toLowerCase() &&
      p.address.trim().toLowerCase() === payload.address.toLowerCase() &&
      p.email.trim().toLowerCase() === payload.email.toLowerCase() &&
      p.phone.trim().toLowerCase() === payload.phone.toLowerCase() &&
      p.bankName.trim().toLowerCase() === payload.bankName.toLowerCase() &&
      p.bankAccount.trim().toLowerCase() === payload.bankAccount.toLowerCase() &&
      p.accountHolder.trim().toLowerCase() === payload.accountHolder.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json({ error: "duplicate profile" }, { status: 409 });
  }

  const updated = await prisma.senderProfile.update({
    where: { id },
    data: payload,
  });
  return NextResponse.json(updated);
}
