import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const profiles = await prisma.senderProfile.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(profiles);
}

export async function POST(req: Request) {
  const body = await req.json();
  const profile = await prisma.senderProfile.create({
    data: {
      name: String(body.name || ""),
      business: String(body.business || ""),
      senderName: String(body.senderName || ""),
      address: String(body.address || ""),
      email: String(body.email || ""),
      phone: String(body.phone || ""),
      logo: String(body.logo || ""),
      bankName: String(body.bankName || ""),
      bankAccount: String(body.bankAccount || ""),
      accountHolder: String(body.accountHolder || ""),
    },
  });
  return NextResponse.json(profile, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.senderProfile.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
