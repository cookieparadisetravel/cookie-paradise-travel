type InvoicePaymentRequestWithDueDate = {
  due_date?: string;
};

export function getEarliestInvoiceDueDate(paymentRequests: InvoicePaymentRequestWithDueDate[]) {
  const dueDates = paymentRequests
    .map((request) => request.due_date)
    .filter((dueDate): dueDate is string => Boolean(dueDate))
    .sort();

  return dueDates[0] ?? null;
}
