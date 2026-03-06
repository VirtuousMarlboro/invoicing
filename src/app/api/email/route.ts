import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const { invoiceId, to, subject, message } = await req.json();

  if (!to || !invoiceId) {
    return NextResponse.json({ error: "Field 'to' dan 'invoiceId' wajib diisi" }, { status: 400 });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass) {
    return NextResponse.json(
      { error: "SMTP belum dikonfigurasi. Atur SMTP_HOST, SMTP_USER, SMTP_PASS di file .env" },
      { status: 500 },
    );
  }

  // Fetch invoice from DB
  const invoice = await prisma.invoice.findUnique({ where: { id: Number(invoiceId) } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice tidak ditemukan. Simpan invoice terlebih dahulu." }, { status: 404 });
  }

  // Generate PDF server-side via dynamic import
  const ReactPDF = await import("@react-pdf/renderer");
  const React = await import("react");
  const { InvoicePDF } = await import("@/lib/pdf-template");

  const data = {
    ...invoice,
    items: JSON.parse(invoice.items),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(InvoicePDF as any, { data });
  const pdfStream = await ReactPDF.renderToBuffer(element as any);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject: subject || `Invoice ${invoice.invoiceNumber}`,
    text: message || `Berikut terlampir invoice ${invoice.invoiceNumber}.`,
    attachments: [
      {
        filename: `${invoice.invoiceNumber}.pdf`,
        content: Buffer.from(pdfStream),
        contentType: "application/pdf",
      },
    ],
  });

  // Update status to "sent"
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "sent" },
  });

  return NextResponse.json({ ok: true });
}
