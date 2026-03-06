import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function normalize(text: string): string {
  return (text || "").trim().toLowerCase();
}

export async function POST() {
  // Products: duplicate key = normalized name + exact price.
  const products = await prisma.product.findMany({ orderBy: { createdAt: "asc" } });
  const productSeen = new Set<string>();
  const duplicateProductIds: number[] = [];
  for (const p of products) {
    const key = `${normalize(p.name)}|${Number(p.price)}`;
    if (productSeen.has(key)) duplicateProductIds.push(p.id);
    else productSeen.add(key);
  }

  // Clients: duplicate key = normalized name + address + email.
  const clients = await prisma.client.findMany({ orderBy: { createdAt: "asc" } });
  const clientSeen = new Set<string>();
  const duplicateClientIds: number[] = [];
  for (const c of clients) {
    const key = `${normalize(c.name)}|${normalize(c.address)}|${normalize(c.email)}`;
    if (clientSeen.has(key)) duplicateClientIds.push(c.id);
    else clientSeen.add(key);
  }

  // Profiles: duplicate key = normalized snapshot of identity fields.
  const profiles = await prisma.senderProfile.findMany({ orderBy: { createdAt: "asc" } });
  const profileSeen = new Set<string>();
  const duplicateProfileIds: number[] = [];
  for (const p of profiles) {
    const key = [
      normalize(p.name),
      normalize(p.business),
      normalize(p.senderName),
      normalize(p.address),
      normalize(p.email),
      normalize(p.phone),
      normalize(p.bankName),
      normalize(p.bankAccount),
      normalize(p.accountHolder),
    ].join("|");
    if (profileSeen.has(key)) duplicateProfileIds.push(p.id);
    else profileSeen.add(key);
  }

  const [productResult, clientResult, profileResult] = await Promise.all([
    duplicateProductIds.length
      ? prisma.product.deleteMany({ where: { id: { in: duplicateProductIds } } })
      : Promise.resolve({ count: 0 }),
    duplicateClientIds.length
      ? prisma.client.deleteMany({ where: { id: { in: duplicateClientIds } } })
      : Promise.resolve({ count: 0 }),
    duplicateProfileIds.length
      ? prisma.senderProfile.deleteMany({ where: { id: { in: duplicateProfileIds } } })
      : Promise.resolve({ count: 0 }),
  ]);

  return NextResponse.json({
    removed: {
      products: productResult.count,
      clients: clientResult.count,
      profiles: profileResult.count,
    },
  });
}
