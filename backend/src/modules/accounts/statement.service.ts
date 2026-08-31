import { prisma } from "../../config/prisma";
import { createPdf, drawBankHeader, formatDocumentAmount, formatDocumentDate, GeneratedDocument, safeFilePart } from "../../services/document.service";
import type { StatementQuery } from "./account.schema";
import { AccountServiceError } from "./account.service";

type StatementRow = {
  date: Date;
  reference: string;
  description: string;
  type: string;
  debit: string;
  credit: string;
  balance: string;
};

function maskAccountNumber(value: string) {
  return `********${value.slice(-4).padStart(4, "*")}`;
}

function csvCell(value: string) {
  const protectedValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${protectedValue.replace(/"/g, '""')}"`;
}

function label(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function statementFilePeriod(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  if (fromDate.getUTCFullYear() === toDate.getUTCFullYear() && fromDate.getUTCMonth() === toDate.getUTCMonth()) {
    return `${fromDate.toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toLowerCase()}-${fromDate.getUTCFullYear()}`;
  }
  return `${from}-${to}`;
}

async function statementData(userId: bigint, accountId: bigint, query: StatementQuery) {
  const account = await prisma.accounts.findFirst({
    where: { account_id: accountId, customers: { user_id: userId } },
    select: {
      account_number: true,
      account_type: true,
      customers: { select: { customer_number: true, first_name: true, last_name: true } },
    },
  });
  if (!account) throw new AccountServiceError("ACCOUNT_NOT_FOUND");

  const from = new Date(`${query.from}T00:00:00.000Z`);
  const exclusiveTo = new Date(`${query.to}T00:00:00.000Z`);
  exclusiveTo.setUTCDate(exclusiveTo.getUTCDate() + 1);
  const [openingEntry, entries] = await prisma.$transaction([
    prisma.ledger_entries.findFirst({
      where: { account_id: accountId, created_at: { lt: from }, transactions: { status: "COMPLETED" } },
      orderBy: [{ created_at: "desc" }, { ledger_entry_id: "desc" }],
      select: { balance_after: true },
    }),
    prisma.ledger_entries.findMany({
      where: { account_id: accountId, created_at: { gte: from, lt: exclusiveTo }, transactions: { status: "COMPLETED" } },
      orderBy: [{ created_at: "asc" }, { ledger_entry_id: "asc" }],
      select: {
        entry_type: true,
        amount: true,
        balance_after: true,
        created_at: true,
        transactions: {
          select: {
            reference_number: true,
            transaction_type: true,
            transaction_details: { orderBy: { created_at: "asc" }, take: 1, select: { description: true, merchant_payee: true } },
          },
        },
      },
    }),
  ]);

  const rows: StatementRow[] = entries.map((entry) => {
    const detail = entry.transactions.transaction_details[0];
    return {
      date: entry.created_at,
      reference: entry.transactions.reference_number,
      description: detail?.merchant_payee ?? detail?.description ?? label(entry.transactions.transaction_type),
      type: label(entry.transactions.transaction_type),
      debit: entry.entry_type === "DEBIT" ? entry.amount.toString() : "",
      credit: entry.entry_type === "CREDIT" ? entry.amount.toString() : "",
      balance: entry.balance_after.toString(),
    };
  });
  const openingBalance = openingEntry?.balance_after.toString() ?? "0";
  const closingBalance = rows.at(-1)?.balance ?? openingBalance;
  return {
    customerName: `${account.customers.first_name} ${account.customers.last_name}`.trim(),
    customerId: account.customers.customer_number,
    maskedAccountNumber: maskAccountNumber(account.account_number),
    lastFour: account.account_number.slice(-4),
    accountType: label(account.account_type),
    from,
    to: new Date(`${query.to}T00:00:00.000Z`),
    openingBalance,
    closingBalance,
    rows,
  };
}

function statementCsv(data: Awaited<ReturnType<typeof statementData>>) {
  const lines = [
    ["π Bank Account Statement"],
    ["Customer Name", data.customerName],
    ["Customer ID", data.customerId],
    ["Account Number", data.maskedAccountNumber],
    ["Account Type", data.accountType],
    ["Statement Period", `${formatDocumentDate(data.from)} to ${formatDocumentDate(data.to)}`],
    ["Opening Balance", formatDocumentAmount(data.openingBalance)],
    ["Closing Balance", formatDocumentAmount(data.closingBalance)],
    [],
    ["Date", "Reference", "Description", "Type", "Debit", "Credit", "Balance"],
    ...data.rows.map((row) => [formatDocumentDate(row.date), row.reference, row.description, row.type, row.debit ? Number(row.debit).toFixed(2) : "", row.credit ? Number(row.credit).toFixed(2) : "", Number(row.balance).toFixed(2)]),
  ];
  return Buffer.from(`\uFEFF${lines.map((row) => row.map((value) => csvCell(value ?? "")).join(",")).join("\r\n")}`, "utf8");
}

async function statementPdf(data: Awaited<ReturnType<typeof statementData>>) {
  return createPdf((document) => {
    drawBankHeader(document, "Account Statement");
    const meta = [
      ["Customer Name", data.customerName], ["Customer ID", data.customerId],
      ["Account", `${data.accountType} ${data.maskedAccountNumber}`], ["Statement Period", `${formatDocumentDate(data.from)} to ${formatDocumentDate(data.to)}`],
      ["Opening Balance", formatDocumentAmount(data.openingBalance)], ["Closing Balance", formatDocumentAmount(data.closingBalance)],
    ];
    meta.forEach(([key, value], index) => {
      const x = index % 2 === 0 ? 42 : 305;
      const y = 105 + Math.floor(index / 2) * 34;
      document.font("Helvetica").fontSize(8).fillColor("#667085").text(key!, x, y);
      document.font("Helvetica-Bold").fontSize(9).fillColor("#172033").text(value!, x, y + 11, { width: 238 });
    });
    let y = 220;
    const widths = [54, 88, 112, 64, 58, 58, 75];
    const headers = ["Date", "Reference", "Description", "Type", "Debit", "Credit", "Balance"];
    const drawHeader = () => {
      document.rect(42, y, 511, 20).fill("#0B1F3A");
      let x = 44;
      headers.forEach((header, index) => { document.font("Helvetica-Bold").fontSize(6.7).fillColor("#FFFFFF").text(header, x, y + 7, { width: widths[index]! - 4 }); x += widths[index]!; });
      y += 20;
    };
    drawHeader();
    if (data.rows.length === 0) document.font("Helvetica").fontSize(9).fillColor("#667085").text("No completed transactions in this period.", 42, y + 18, { width: 511, align: "center" });
    data.rows.forEach((row, rowIndex) => {
      if (y > 752) { document.addPage(); y = 42; drawHeader(); }
      if (rowIndex % 2 === 0) document.rect(42, y, 511, 25).fill("#F6F8FB");
      const values = [formatDocumentDate(row.date), row.reference, row.description, row.type, row.debit ? formatDocumentAmount(row.debit).replace("INR ", "") : "-", row.credit ? formatDocumentAmount(row.credit).replace("INR ", "") : "-", formatDocumentAmount(row.balance).replace("INR ", "")];
      let x = 44;
      values.forEach((value, index) => { document.font("Helvetica").fontSize(6.4).fillColor("#172033").text(value, x, y + 8, { width: widths[index]! - 5, ellipsis: true }); x += widths[index]!; });
      y += 25;
    });
    document.font("Helvetica").fontSize(7).fillColor("#98A2B3").text("Generated securely by Pi Bank. This statement contains no ledger identifiers.", 42, 790, { width: 511, align: "center" });
  });
}

export async function generateAccountStatement(userId: bigint, accountId: bigint, query: StatementQuery): Promise<GeneratedDocument> {
  const data = await statementData(userId, accountId, query);
  const extension = query.format;
  const fileName = safeFilePart(`pi-bank-statement-${data.lastFour}-${statementFilePeriod(query.from, query.to)}`) + `.${extension}`;
  return query.format === "csv"
    ? { buffer: statementCsv(data), contentType: "text/csv; charset=utf-8", fileName }
    : { buffer: await statementPdf(data), contentType: "application/pdf", fileName };
}
