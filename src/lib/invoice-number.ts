export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-5);
  return `INV-${year}-${timestamp}`;
}
