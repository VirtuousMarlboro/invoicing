import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(clients);
}

export async function POST(req: Request) {
  const body = await req.json();
  const client = await prisma.client.create({
    data: {
      name: String(body.name || ""),
      address: String(body.address || ""),
      email: String(body.email || ""),
    },
  });
  return NextResponse.json(client, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.client.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
