import { prisma } from "../../config/prisma";
import { createPdf, drawBankHeader, formatDocumentAmount, formatDocumentDateTime, GeneratedDocument, safeFilePart } from "../../services/document.service";
import { TransactionServiceError } from "./transaction.service";

function label(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function accountLabel(account: { account_number: string; account_type: string } | undefined, fallback: string) {
  return account ? `${label(account.account_type)} ********${account.account_number.slice(-4).padStart(4, "*")}` : fallback;
}

export async function generateTransactionReceipt(userId: bigint, transactionId: bigint): Promise<GeneratedDocument> {
  const customer = await prisma.customers.findUnique({
    where: { user_id: userId },
    select: { accounts: { select: { account_id: true } } },
  });
  if (!customer) throw new TransactionServiceError("CUSTOMER_NOT_FOUND");
  const ownedAccountIds = customer.accounts.map((account) => account.account_id);
  const transaction = await prisma.transactions.findFirst({
    where: {
      transaction_id: transactionId,
      OR: [{ source_account_id: { in: ownedAccountIds } }, { destination_account_id: { in: ownedAccountIds } }],
    },
    select: {
      reference_number: true,
      transaction_type: true,
      source_account_id: true,
      destination_account_id: true,
      amount: true,
      currency: true,
      status: true,
      initiated_at: true,
      completed_at: true,
      transaction_details: { orderBy: { created_at: "asc" }, take: 1, select: { description: true, merchant_payee: true, notes: true } },
    },
  });
  if (!transaction) throw new TransactionServiceError("TRANSACTION_NOT_FOUND");

  const accountIds = [transaction.source_account_id, transaction.destination_account_id].filter((value): value is bigint => value !== null);
  const accounts = await prisma.accounts.findMany({ where: { account_id: { in: accountIds } }, select: { account_id: true, account_number: true, account_type: true } });
  const accountMap = new Map(accounts.map((account) => [account.account_id.toString(), account]));
  const source = transaction.source_account_id ? accountMap.get(transaction.source_account_id.toString()) : undefined;
  const destination = transaction.destination_account_id ? accountMap.get(transaction.destination_account_id.toString()) : undefined;
  const detail = transaction.transaction_details[0];
  const description = detail?.merchant_payee ?? detail?.description ?? label(transaction.transaction_type);
  const remarks = detail?.notes ?? detail?.description ?? "No remarks provided";
  const from = accountLabel(source, transaction.transaction_type === "DEPOSIT" ? "External deposit" : "Not applicable");
  const to = accountLabel(destination, transaction.transaction_type === "WITHDRAWAL" ? "Cash withdrawal" : "Not applicable");

  const buffer = await createPdf((document) => {
    drawBankHeader(document, "Transaction Receipt");
    document.roundedRect(42, 112, 511, 74, 8).fill("#F6F8FB");
    document.font("Helvetica").fontSize(8).fillColor("#667085").text(description, 56, 128, { width: 483, align: "center" });
    document.font("Helvetica-Bold").fontSize(20).fillColor("#0B1F3A").text(formatDocumentAmount(transaction.amount.toString()), 56, 147, { width: 483, align: "center" });
    const rows = [
      ["Transaction ID", transaction.reference_number],
      ["Date / Time", formatDocumentDateTime(transaction.completed_at ?? transaction.initiated_at)],
      ["Transaction Type", label(transaction.transaction_type)],
      ["From", from],
      ["To", to],
      ["Amount", formatDocumentAmount(transaction.amount.toString())],
      ["Status", label(transaction.status)],
      ["Remarks", remarks],
    ];
    let y = 212;
    rows.forEach(([key, value], index) => {
      if (index % 2 === 0) document.rect(42, y - 6, 511, 34).fill("#FAFBFC");
      document.font("Helvetica").fontSize(8).fillColor("#667085").text(key!, 54, y + 4, { width: 120 });
      document.font("Helvetica-Bold").fontSize(9).fillColor("#172033").text(value!, 184, y + 4, { width: 355, align: "right" });
      y += 34;
    });
    document.font("Helvetica").fontSize(7).fillColor("#98A2B3").text("Generated securely by Pi Bank. This receipt contains no ledger or database identifiers.", 42, y + 24, { width: 511, align: "center" });
  });

  return {
    buffer,
    contentType: "application/pdf",
    fileName: `${safeFilePart(`pi-bank-transaction-${transaction.reference_number}`)}.pdf`,
  };
}
