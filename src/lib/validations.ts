export interface InvoiceDateInput {
  issueDate: string;
  dueDate: string;
}

export function isDueDateValid(data: InvoiceDateInput): boolean {
  if (!data.issueDate || !data.dueDate) return true;
  return new Date(data.dueDate) >= new Date(data.issueDate);
}
