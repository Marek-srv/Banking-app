import { randomBytes } from "crypto";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { Prisma, RequestStatus } from "../../generated/prisma/client";
import { deriveIfscFromBranchCode } from "../../domain/account.rules";
import { configuredLoanRate, estimatedMonthlyEmi } from "../../domain/loan.rules";
import { paginationMetadata } from "../../schemas/pagination.schema";
import { AuditContext, createAuditLog } from "../../services/audit.service";
import { createCreditEntry, createDebitEntry } from "../transactions/ledger.service";
import { AdminLoanListInput, AdminLoanRequestListInput, ApproveLoanRequestInput, CreateLoanRequestInput, LoanListInput } from "./loan.schema";

const D = Prisma.Decimal;
const ref = (prefix: string) => `${prefix}${Date.now()}${randomBytes(5).toString("hex").toUpperCase()}`;
const accountNumber = () => `LN${randomBytes(9).toString("hex").toUpperCase()}`;
const round = (value: Prisma.Decimal) => new D(value.toFixed(4));

async function eligibleCustomer(userId: bigint) {
  const customer = await prisma.customers.findUnique({ where: { user_id: userId }, include: { branches: { select: { branch_code: true } } } });
  if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
  if (customer.customer_status !== "ACTIVE") throw new Error("CUSTOMER_NOT_ACTIVE");
  if (customer.kyc_status !== "VERIFIED") throw new Error("CUSTOMER_KYC_NOT_VERIFIED");
  return customer;
}

function emiAmount(principal: Prisma.Decimal, annualRate: Prisma.Decimal, months: number) {
  if (annualRate.isZero()) return round(principal.div(months));
  const r = annualRate.div(1200).toNumber();
  const factor = Math.pow(1 + r, months);
  return new D((principal.toNumber() * r * factor / (factor - 1)).toFixed(4));
}

function schedule(principal: Prisma.Decimal, annualRate: Prisma.Decimal, months: number, firstDue = new Date()) {
  const payment = emiAmount(principal, annualRate, months);
  const monthlyRate = annualRate.div(1200);
  let remaining = new D(principal);
  return Array.from({ length: months }, (_, index) => {
    const interest = round(remaining.mul(monthlyRate));
    const principalPart = index === months - 1 ? remaining : round(Prisma.Decimal.max(payment.minus(interest), 0));
    remaining = Prisma.Decimal.max(remaining.minus(principalPart), 0);
    const due = new Date(firstDue); due.setUTCMonth(due.getUTCMonth() + index + 1);
    return { installment_number: index + 1, due_date: due, principal_component: principalPart, interest_component: interest, total_emi: principalPart.plus(interest) };
  });
}

async function addHistory(tx: Prisma.TransactionClient, requestId: bigint, oldStatus: RequestStatus | null, newStatus: RequestStatus, userId: bigint, reason?: string) {
  await tx.request_status_history.create({ data: { request_type: "LOAN", request_id: requestId, previous_status: oldStatus, new_status: newStatus, changed_by: userId, ...(reason ? { reason } : {}) } });
}

export async function createLoanRequest(userId: bigint, input: CreateLoanRequestInput, context: AuditContext) {
  const customer = await eligibleCustomer(userId);
  return prisma.$transaction(async tx => {
    const request = await tx.loan_requests.create({ data: { customer_id: customer.customer_id, requested_amount: input.requestedAmount, requested_duration_months: input.durationMonths, loan_type: input.loanType, loan_subtype: input.loanSubtype, purpose: input.purpose, requested_interest_rate: configuredLoanRate(input.durationMonths), status: "PENDING" } });
    await addHistory(tx, request.loan_request_id, null, "PENDING", userId);
    await createAuditLog({ ...context, userId, action: "LOAN_REQUEST_CREATED", entity: "LOAN_REQUEST", entityId: request.loan_request_id }, tx);
    return request;
  });
}

export function previewLoan(requestedAmount: number, durationMonths: number) {
  const interestRate = configuredLoanRate(durationMonths);
  return { interestRate, estimatedEmi: Number(estimatedMonthlyEmi(requestedAmount, interestRate, durationMonths).toFixed(2)), durationMonths, requestedAmount };
}

export async function listLoanRequests(userId: bigint, query: LoanListInput) {
  const customer = await eligibleCustomer(userId); const where = { customer_id: customer.customer_id };
  const [total, items] = await prisma.$transaction([prisma.loan_requests.count({ where }), prisma.loan_requests.findMany({ where, select: { loan_request_id: true, requested_amount: true, requested_duration_months: true, loan_type: true, loan_subtype: true, purpose: true, status: true, approved_amount: true, approved_duration_months: true, approved_interest_rate: true, rejection_reason: true, created_at: true, updated_at: true }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit })]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function cancelLoanRequest(userId: bigint, requestId: bigint, context: AuditContext) {
  const customer = await eligibleCustomer(userId);
  return prisma.$transaction(async tx => {
    const request = await tx.loan_requests.findFirst({ where: { loan_request_id: requestId, customer_id: customer.customer_id } });
    if (!request) throw new Error("LOAN_REQUEST_NOT_FOUND");
    if (request.status !== "PENDING") throw new Error("LOAN_REQUEST_NOT_CANCELLABLE");
    const updated = await tx.loan_requests.update({ where: { loan_request_id: requestId }, data: { status: "CANCELLED" } });
    await addHistory(tx, requestId, request.status, "CANCELLED", userId);
    await createAuditLog({ ...context, userId, action: "LOAN_REQUEST_CANCELLED", entity: "LOAN_REQUEST", entityId: requestId }, tx); return updated;
  });
}

export async function listAdminLoanRequests(query: AdminLoanRequestListInput) {
  const where = { ...(query.status ? { status: query.status } : {}), ...(query.customerId ? { customer_id: query.customerId } : {}) };
  const [total, items] = await prisma.$transaction([prisma.loan_requests.count({ where }), prisma.loan_requests.findMany({ where, include: { customers: { select: { customer_number: true, first_name: true, last_name: true, customer_status: true, kyc_status: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit })]);
  return { items, pagination: paginationMetadata(query, total) };
}

export async function reviewLoanRequest(adminId: bigint, requestId: bigint, context: AuditContext) {
  return prisma.$transaction(async tx => {
    const request = await tx.loan_requests.findUnique({ where: { loan_request_id: requestId } });
    if (!request) throw new Error("LOAN_REQUEST_NOT_FOUND"); if (request.status !== "PENDING") throw new Error("LOAN_REQUEST_NOT_REVIEWABLE");
    const updated = await tx.loan_requests.update({ where: { loan_request_id: requestId }, data: { status: "UNDER_REVIEW", reviewed_by: adminId, reviewed_at: new Date() } });
    await addHistory(tx, requestId, request.status, "UNDER_REVIEW", adminId); await createAuditLog({ ...context, userId: adminId, action: "LOAN_REQUEST_REVIEW_STARTED", entity: "LOAN_REQUEST", entityId: requestId }, tx); return updated;
  });
}

export async function approveLoanRequest(adminId: bigint, requestId: bigint, input: ApproveLoanRequestInput, context: AuditContext) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT loan_request_id FROM loan_requests WHERE loan_request_id=${requestId} FOR UPDATE`;
    const request = await tx.loan_requests.findUnique({ where: { loan_request_id: requestId }, include: { customers: { include: { branches: { select: { branch_code: true, status: true } } } } } });
    if (!request) throw new Error("LOAN_REQUEST_NOT_FOUND"); if (request.status !== "UNDER_REVIEW") throw new Error("LOAN_REQUEST_NOT_APPROVABLE");
    if (request.customers.customer_status !== "ACTIVE") throw new Error("CUSTOMER_NOT_ACTIVE"); if (request.customers.kyc_status !== "VERIFIED") throw new Error("CUSTOMER_KYC_NOT_VERIFIED"); if (request.customers.branches.status !== "ACTIVE") throw new Error("BRANCH_NOT_ACTIVE");
    const principal = new D(input.approvedAmount); const rate = new D(configuredLoanRate(input.approvedDurationMonths)); const emi = emiAmount(principal, rate, input.approvedDurationMonths);
    const loanAccount = await tx.accounts.create({ data: { account_number: accountNumber(), customer_id: request.customer_id, branch_id: request.customers.branch_id, account_type: "LOAN", account_subtype: request.loan_subtype, ifsc_code: deriveIfscFromBranchCode(request.customers.branches.branch_code), currency: "INR", current_balance: 0, available_balance: 0, account_status: "LOAN", opened_at: new Date() } });
    const loan = await tx.loans.create({ data: { customer_id: request.customer_id, account_id: loanAccount.account_id, loan_request_id: requestId, principal_amount: principal, outstanding_principal: principal, interest_rate: rate, duration_months: input.approvedDurationMonths, emi_amount: emi, loan_type: request.loan_type, loan_subtype: request.loan_subtype, status: "APPROVED", approved_at: new Date(), approved_by: adminId } });
    await tx.loan_requests.update({ where: { loan_request_id: requestId }, data: { status: "APPROVED", reviewed_by: adminId, reviewed_at: new Date(), approved_amount: principal, approved_duration_months: input.approvedDurationMonths, approved_interest_rate: rate, ...(input.adminNote === undefined ? {} : { admin_note: input.adminNote }) } });
    await addHistory(tx, requestId, request.status, "APPROVED", adminId); await createAuditLog({ ...context, userId: adminId, action: "LOAN_APPROVED", entity: "LOAN", entityId: loan.loan_id, metadata: { requestId: requestId.toString(), loanAccountId: loanAccount.account_id.toString() } }, tx); return { loan, loanAccount };
  });
}

export async function rejectLoanRequest(adminId: bigint, requestId: bigint, reason: string, context: AuditContext) {
  return prisma.$transaction(async tx => {
    const request = await tx.loan_requests.findUnique({ where: { loan_request_id: requestId } }); if (!request) throw new Error("LOAN_REQUEST_NOT_FOUND"); if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) throw new Error("LOAN_REQUEST_NOT_REJECTABLE");
    const updated = await tx.loan_requests.update({ where: { loan_request_id: requestId }, data: { status: "REJECTED", rejection_reason: reason, reviewed_by: adminId, reviewed_at: new Date() } });
    await addHistory(tx, requestId, request.status, "REJECTED", adminId, reason); await createAuditLog({ ...context, userId: adminId, action: "LOAN_REQUEST_REJECTED", entity: "LOAN_REQUEST", entityId: requestId, reason }, tx); return updated;
  });
}

type LockedAccount = { account_id: bigint; customer_id: bigint; account_type: string; account_status: string; currency: string; current_balance: Prisma.Decimal; available_balance: Prisma.Decimal };
async function lockedOperatingAccount(tx: Prisma.TransactionClient, accountId: bigint, customerId: bigint) {
  const rows = await tx.$queryRaw<LockedAccount[]>`SELECT account_id,customer_id,account_type::text,account_status,currency,current_balance,available_balance FROM accounts WHERE account_id=${accountId} FOR UPDATE`;
  const account = rows[0]; if (!account) throw new Error("ACCOUNT_NOT_FOUND"); if (account.customer_id !== customerId) throw new Error("UNAUTHORIZED_ACCOUNT"); if (account.account_status !== "ACTIVE" || !["SAVINGS", "CURRENT"].includes(account.account_type)) throw new Error("ACCOUNT_NOT_ACTIVE"); return account;
}

async function movement(tx: Prisma.TransactionClient, account: LockedAccount, amount: Prisma.Decimal, type: string, direction: "DEBIT" | "CREDIT", description: string) {
  if (!amount.isPositive()) throw new Error("INVALID_LOAN_PAYMENT_AMOUNT");
  const before = new D(account.current_balance); const available = new D(account.available_balance);
  if (direction === "DEBIT" && (before.lessThan(amount) || available.lessThan(amount))) throw new Error("INSUFFICIENT_FUNDS");
  const banking = await tx.transactions.create({ data: { reference_number: ref("LN"), transaction_type: type, source_account_id: direction === "DEBIT" ? account.account_id : null, destination_account_id: direction === "CREDIT" ? account.account_id : null, amount, currency: account.currency, status: "PROCESSING" } });
  await tx.transaction_status_history.create({ data: { transaction_id: banking.transaction_id, status: "PROCESSING", description: `${description} processing` } });
  if (direction === "DEBIT") await createDebitEntry({ transactionId: banking.transaction_id, accountId: account.account_id, amount, balanceBefore: before }, tx); else await createCreditEntry({ transactionId: banking.transaction_id, accountId: account.account_id, amount, balanceBefore: before }, tx);
  const delta = direction === "DEBIT" ? amount.negated() : amount;
  await tx.accounts.update({ where: { account_id: account.account_id }, data: { current_balance: before.plus(delta), available_balance: available.plus(delta) } });
  await tx.transaction_details.create({ data: { transaction_id: banking.transaction_id, description } });
  const completed = await tx.transactions.update({ where: { transaction_id: banking.transaction_id }, data: { status: "COMPLETED", completed_at: new Date() } }); await tx.transaction_status_history.create({ data: { transaction_id: banking.transaction_id, status: "COMPLETED", description: `${description} completed` } }); return completed;
}

async function reduceLoanLiability(tx: Prisma.TransactionClient, loanAccountId: bigint, transactionId: bigint, principalReduction: Prisma.Decimal) {
  const rows = await tx.$queryRaw<LockedAccount[]>`SELECT account_id,customer_id,account_type::text,account_status,currency,current_balance,available_balance FROM accounts WHERE account_id=${loanAccountId} FOR UPDATE`;
  const account = rows[0];
  if (!account || account.account_type !== "LOAN") throw new Error("LOAN_ACCOUNT_NOT_FOUND");
  const reduction = Prisma.Decimal.min(principalReduction, account.current_balance);
  if (reduction.isPositive()) await createDebitEntry({ transactionId, accountId: account.account_id, amount: reduction, balanceBefore: account.current_balance }, tx);
  const balanceAfter = Prisma.Decimal.max(account.current_balance.minus(reduction), 0);
  await tx.accounts.update({ where: { account_id: account.account_id }, data: { current_balance: balanceAfter, available_balance: 0 } });
  return balanceAfter;
}

export async function disburseLoan(adminId: bigint, loanId: bigint, context: AuditContext) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT loan_id FROM loans WHERE loan_id=${loanId} FOR UPDATE`;
    const loan = await tx.loans.findUnique({ where: { loan_id: loanId } }); if (!loan) throw new Error("LOAN_NOT_FOUND"); if (loan.status !== "APPROVED" || loan.disbursement_transaction_id) throw new Error("LOAN_NOT_DISBURSABLE");
    const liabilityRows = await tx.$queryRaw<LockedAccount[]>`SELECT account_id,customer_id,account_type::text,account_status,currency,current_balance,available_balance FROM accounts WHERE account_id=${loan.account_id} FOR UPDATE`;
    const liability = liabilityRows[0]; if (!liability || liability.account_type !== "LOAN") throw new Error("LOAN_ACCOUNT_NOT_FOUND");
    const banking = await tx.transactions.create({ data: { reference_number: ref("LN"), transaction_type: "LOAN_DISBURSEMENT", destination_account_id: liability.account_id, amount: loan.principal_amount, currency: liability.currency, status: "PROCESSING" } });
    await tx.transaction_status_history.create({ data: { transaction_id: banking.transaction_id, status: "PROCESSING", description: `Loan ${loanId} disbursement processing` } });
    await createCreditEntry({ transactionId: banking.transaction_id, accountId: liability.account_id, amount: loan.principal_amount, balanceBefore: liability.current_balance }, tx);
    await tx.accounts.update({ where: { account_id: liability.account_id }, data: { current_balance: loan.principal_amount, available_balance: 0, account_status: "ACTIVE" } });
    await tx.transaction_details.create({ data: { transaction_id: banking.transaction_id, description: `Loan ${loanId} disbursed to loan liability account` } });
    const completedBanking = await tx.transactions.update({ where: { transaction_id: banking.transaction_id }, data: { status: "COMPLETED", completed_at: new Date() } });
    await tx.transaction_status_history.create({ data: { transaction_id: banking.transaction_id, status: "COMPLETED", description: `Loan ${loanId} disbursement completed` } });
    const rows = schedule(loan.principal_amount, loan.interest_rate, loan.duration_months); await tx.loan_emi_schedules.createMany({ data: rows.map(row => ({ loan_id: loanId, ...row })) });
    const updated = await tx.loans.update({ where: { loan_id: loanId }, data: { status: "ACTIVE", disbursed_at: new Date(), disbursed_by: adminId, disbursement_transaction_id: completedBanking.transaction_id } });
    await createAuditLog({ ...context, userId: adminId, action: "LOAN_DISBURSED", entity: "LOAN", entityId: loanId, metadata: { transactionId: completedBanking.transaction_id.toString(), loanAccountId: liability.account_id.toString() } }, tx); return { loan: updated, transaction: completedBanking };
  });
}

async function ownedLoan(userId: bigint, loanId: bigint) {
  const customer = await eligibleCustomer(userId); const loan = await prisma.loans.findFirst({ where: { loan_id: loanId, customer_id: customer.customer_id } }); if (!loan) throw new Error("LOAN_NOT_FOUND"); return { customer, loan };
}

export async function listLoans(userId: bigint, query: LoanListInput) {
  const customer = await eligibleCustomer(userId); const where = { customer_id: customer.customer_id }; const [total, items] = await prisma.$transaction([prisma.loans.count({ where }), prisma.loans.findMany({ where, select: { loan_id: true, principal_amount: true, outstanding_principal: true, interest_rate: true, duration_months: true, emi_amount: true, loan_type: true, loan_subtype: true, status: true, approved_at: true, disbursed_at: true, auto_debit_enabled: true, emi_schedules: { where: { status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID"] } }, orderBy: { due_date: "asc" }, take: 1, select: { due_date: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit })]); return { items, pagination: paginationMetadata(query, total) };
}
export async function getLoan(userId: bigint, loanId: bigint) {
  const { customer } = await ownedLoan(userId, loanId);
  const loan = await prisma.loans.findFirst({ where: { loan_id: loanId, customer_id: customer.customer_id }, select: { loan_id: true, principal_amount: true, outstanding_principal: true, interest_rate: true, duration_months: true, emi_amount: true, loan_type: true, loan_subtype: true, status: true, approved_at: true, disbursed_at: true, closed_at: true, auto_debit_enabled: true, auto_debit_account_id: true, auto_debit_account: { select: { account_number: true, account_type: true } } } });
  if (!loan) throw new Error("LOAN_NOT_FOUND");
  return { ...loan, autoDebitAccount: loan.auto_debit_account ? { accountType: loan.auto_debit_account.account_type, maskedAccountNumber: `****${loan.auto_debit_account.account_number.slice(-4)}` } : null, auto_debit_account: undefined };
}
export async function listEmis(userId: bigint, loanId: bigint) { await ownedLoan(userId, loanId); return prisma.loan_emi_schedules.findMany({ where: { loan_id: loanId }, select: { emi_schedule_id: true, installment_number: true, due_date: true, principal_component: true, interest_component: true, total_emi: true, amount_paid: true, late_fee: true, status: true, paid_at: true }, orderBy: { installment_number: "asc" } }); }

async function payEmiCore(userId: bigint, loanId: bigint, emiId: bigint, sourceId: bigint, context: AuditContext) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT loan_id FROM loans WHERE loan_id=${loanId} FOR UPDATE`; const customer = await tx.customers.findUnique({ where: { user_id: userId } }); if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
    const loan = await tx.loans.findFirst({ where: { loan_id: loanId, customer_id: customer.customer_id } }); if (!loan) throw new Error("LOAN_NOT_FOUND"); if (!["ACTIVE", "OVERDUE"].includes(loan.status)) throw new Error("LOAN_NOT_PAYABLE");
    const emi = await tx.loan_emi_schedules.findFirst({ where: { emi_schedule_id: emiId, loan_id: loanId } }); if (!emi) throw new Error("EMI_NOT_FOUND"); if (!["PENDING", "OVERDUE", "PARTIALLY_PAID"].includes(emi.status)) throw new Error("EMI_NOT_PAYABLE");
    const source = await lockedOperatingAccount(tx, sourceId, customer.customer_id); const due = emi.total_emi.plus(emi.late_fee).minus(emi.amount_paid); const banking = await movement(tx, source, due, "LOAN_EMI_PAYMENT", "DEBIT", `Loan ${loanId} EMI ${emi.installment_number}`);
    const principalPaid = Prisma.Decimal.min(emi.principal_component, loan.outstanding_principal); await tx.loan_emi_schedules.update({ where: { emi_schedule_id: emiId }, data: { amount_paid: emi.total_emi.plus(emi.late_fee), status: "PAID", paid_at: new Date(), transaction_id: banking.transaction_id } });
    const outstanding = Prisma.Decimal.max(loan.outstanding_principal.minus(principalPaid), 0); await reduceLoanLiability(tx, loan.account_id, banking.transaction_id, principalPaid); const overdue = await tx.loan_emi_schedules.count({ where: { loan_id: loanId, status: "OVERDUE", emi_schedule_id: { not: emiId } } }); const remaining = await tx.loan_emi_schedules.count({ where: { loan_id: loanId, emi_schedule_id: { not: emiId }, status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID"] } } }); const closed = outstanding.isZero() && remaining === 0; await tx.loans.update({ where: { loan_id: loanId }, data: { outstanding_principal: outstanding, ...(closed ? { status: "CLOSED", closed_at: new Date(), auto_debit_enabled: false, auto_debit_account_id: null } : loan.status === "OVERDUE" && overdue === 0 ? { status: "ACTIVE" } : {}) } }); if (closed) await tx.accounts.update({ where: { account_id: loan.account_id }, data: { account_status: "CLOSED", closed_at: new Date(), close_reason: "Loan fully repaid" } });
    await createAuditLog({ ...context, userId, action: "LOAN_EMI_PAID", entity: "LOAN", entityId: loanId, metadata: { emiId: emiId.toString(), transactionId: banking.transaction_id.toString() } }, tx); return banking;
  });
}
export const payEmi = payEmiCore;

export async function configureAutoDebit(userId: bigint, loanId: bigint, enabled: boolean, accountId: bigint | undefined, context: AuditContext) {
  const { customer, loan } = await ownedLoan(userId, loanId);
  return prisma.$transaction(async tx => {
    if (enabled) await lockedOperatingAccount(tx, accountId!, customer.customer_id);
    const updated = await tx.loans.update({ where: { loan_id: loan.loan_id }, data: { auto_debit_enabled: enabled, auto_debit_account: enabled ? { connect: { account_id: accountId! } } : { disconnect: true } } });
    await createAuditLog({ ...context, userId, action: "LOAN_AUTO_DEBIT_UPDATED", entity: "LOAN", entityId: loanId }, tx); return updated;
  });
}

export async function processDueEmi(loanId: bigint, emiId: bigint, context: AuditContext) {
  const loan = await prisma.loans.findUnique({ where: { loan_id: loanId }, include: { customers: { select: { user_id: true } } } }); if (!loan?.auto_debit_enabled || !loan.auto_debit_account_id) throw new Error("LOAN_AUTO_DEBIT_NOT_ENABLED"); return payEmiCore(loan.customers.user_id, loanId, emiId, loan.auto_debit_account_id, context);
}

export async function markOverdueEmis(loanId?: bigint) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  return prisma.$transaction(async tx => { const due = await tx.loan_emi_schedules.findMany({ where: { status: "PENDING", due_date: { lt: today }, ...(loanId ? { loan_id: loanId } : {}) }, select: { emi_schedule_id: true, loan_id: true } }); if (!due.length) return { markedOverdue: 0 };
    await tx.loan_emi_schedules.updateMany({ where: { emi_schedule_id: { in: due.map(x => x.emi_schedule_id) } }, data: { status: "OVERDUE", late_fee: env.LOAN_LATE_FEE } }); await tx.loans.updateMany({ where: { loan_id: { in: [...new Set(due.map(x => x.loan_id))] }, status: "ACTIVE" }, data: { status: "OVERDUE" } }); return { markedOverdue: due.length };
  });
}

async function recalculateFuture(tx: Prisma.TransactionClient, loanId: bigint, outstanding: Prisma.Decimal, annualRate: Prisma.Decimal) {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0); const future = await tx.loan_emi_schedules.findMany({ where: { loan_id: loanId, status: "PENDING", due_date: { gt: today } }, orderBy: { installment_number: "asc" } }); if (!future.length) return null;
  const reserved = await tx.loan_emi_schedules.aggregate({ where: { loan_id: loanId, status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID"] }, due_date: { lte: today } }, _sum: { principal_component: true } });
  const recalculable = Prisma.Decimal.max(outstanding.minus(reserved._sum.principal_component ?? 0), 0);
  if (recalculable.isZero()) {
    await tx.loan_emi_schedules.updateMany({ where: { emi_schedule_id: { in: future.map(item => item.emi_schedule_id) } }, data: { status: "CANCELLED" } });
    return null;
  }
  const rows = schedule(recalculable, annualRate, future.length, new Date(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  for (let i = 0; i < future.length; i++) await tx.loan_emi_schedules.update({ where: { emi_schedule_id: future[i]!.emi_schedule_id }, data: { principal_component: rows[i]!.principal_component, interest_component: rows[i]!.interest_component, total_emi: rows[i]!.total_emi } });
  return rows[0]!.total_emi;
}

export async function prepayLoan(userId: bigint, loanId: bigint, sourceId: bigint, amountValue: number, context: AuditContext) {
  return prisma.$transaction(async tx => { await tx.$queryRaw`SELECT loan_id FROM loans WHERE loan_id=${loanId} FOR UPDATE`; const customer = await tx.customers.findUnique({ where: { user_id: userId } }); if (!customer) throw new Error("CUSTOMER_NOT_FOUND"); const loan = await tx.loans.findFirst({ where: { loan_id: loanId, customer_id: customer.customer_id } }); if (!loan) throw new Error("LOAN_NOT_FOUND"); if (!["ACTIVE", "OVERDUE"].includes(loan.status)) throw new Error("LOAN_NOT_PAYABLE"); const amount = new D(amountValue); if (amount.greaterThanOrEqualTo(loan.outstanding_principal)) throw new Error("PREPAYMENT_MUST_BE_LESS_THAN_FORECLOSURE_AMOUNT");
    const source = await lockedOperatingAccount(tx, sourceId, customer.customer_id); const banking = await movement(tx, source, amount, "LOAN_PREPAYMENT", "DEBIT", `Loan ${loanId} partial prepayment`); const outstanding = loan.outstanding_principal.minus(amount); await reduceLoanLiability(tx, loan.account_id, banking.transaction_id, amount); const revisedEmi = await recalculateFuture(tx, loanId, outstanding, loan.interest_rate); await tx.loans.update({ where: { loan_id: loanId }, data: { outstanding_principal: outstanding, ...(revisedEmi ? { emi_amount: revisedEmi } : {}) } }); await createAuditLog({ ...context, userId, action: "LOAN_PREPAID", entity: "LOAN", entityId: loanId, metadata: { transactionId: banking.transaction_id.toString(), amount: amount.toString() } }, tx); return banking;
  });
}

export async function forecloseLoan(userId: bigint, loanId: bigint, sourceId: bigint, context: AuditContext) {
  return prisma.$transaction(async tx => { await tx.$queryRaw`SELECT loan_id FROM loans WHERE loan_id=${loanId} FOR UPDATE`; const customer = await tx.customers.findUnique({ where: { user_id: userId } }); if (!customer) throw new Error("CUSTOMER_NOT_FOUND"); const loan = await tx.loans.findFirst({ where: { loan_id: loanId, customer_id: customer.customer_id } }); if (!loan) throw new Error("LOAN_NOT_FOUND"); if (!["ACTIVE", "OVERDUE"].includes(loan.status)) throw new Error("LOAN_NOT_PAYABLE"); const today = new Date(); const payable = await tx.loan_emi_schedules.aggregate({ where: { loan_id: loanId, status: { in: ["OVERDUE", "PARTIALLY_PAID"] }, due_date: { lte: today } }, _sum: { interest_component: true, late_fee: true, amount_paid: true } }); const charges = (payable._sum.interest_component ?? new D(0)).plus(payable._sum.late_fee ?? 0).minus(payable._sum.amount_paid ?? 0); const total = loan.outstanding_principal.plus(Prisma.Decimal.max(charges, 0)); const source = await lockedOperatingAccount(tx, sourceId, customer.customer_id); const banking = await movement(tx, source, total, "LOAN_FORECLOSURE", "DEBIT", `Loan ${loanId} foreclosure`);
    await reduceLoanLiability(tx, loan.account_id, banking.transaction_id, loan.outstanding_principal); await tx.loans.update({ where: { loan_id: loanId }, data: { outstanding_principal: 0, status: "FORECLOSED", closed_at: new Date(), auto_debit_enabled: false, auto_debit_account_id: null } }); await tx.accounts.update({ where: { account_id: loan.account_id }, data: { current_balance: 0, available_balance: 0, account_status: "CLOSED", closed_at: new Date(), close_reason: "Loan foreclosed" } }); await tx.loan_emi_schedules.updateMany({ where: { loan_id: loanId, status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID"] } }, data: { status: "CANCELLED" } }); await createAuditLog({ ...context, userId, action: "LOAN_FORECLOSED", entity: "LOAN", entityId: loanId, metadata: { transactionId: banking.transaction_id.toString(), settlementAmount: total.toString() } }, tx); return banking;
  });
}

export async function getForeclosureQuote(userId: bigint, loanId: bigint) {
  const { loan } = await ownedLoan(userId, loanId); if (!["ACTIVE", "OVERDUE"].includes(loan.status)) throw new Error("LOAN_NOT_PAYABLE");
  const today = new Date(); const payable = await prisma.loan_emi_schedules.aggregate({ where: { loan_id: loanId, status: { in: ["OVERDUE", "PARTIALLY_PAID"] }, due_date: { lte: today } }, _sum: { interest_component: true, late_fee: true, amount_paid: true } });
  const charges = (payable._sum.interest_component ?? new D(0)).plus(payable._sum.late_fee ?? 0).minus(payable._sum.amount_paid ?? 0); const accrued = Prisma.Decimal.max(charges, 0); return { outstandingPrincipal: loan.outstanding_principal.toString(), accruedCharges: accrued.toString(), totalPayable: loan.outstanding_principal.plus(accrued).toString() };
}

export async function listAdminLoans(query: AdminLoanListInput) { const where = { ...(query.status ? { status: query.status } : {}), ...(query.customerId ? { customer_id: query.customerId } : {}), ...(query.customer ? { customers: { OR: [{ customer_number: { contains: query.customer, mode: "insensitive" as const } }, { first_name: { contains: query.customer, mode: "insensitive" as const } }, { last_name: { contains: query.customer, mode: "insensitive" as const } }] } } : {}), ...(query.overdue ? { OR: [{ status: "OVERDUE" as const }, { emi_schedules: { some: { status: "OVERDUE" as const } } }] } : {}) }; const [total, items] = await prisma.$transaction([prisma.loans.count({ where }), prisma.loans.findMany({ where, include: { customers: { select: { customer_number: true, first_name: true, last_name: true } }, accounts: { select: { account_number: true, account_status: true } }, _count: { select: { emi_schedules: true } } }, orderBy: { created_at: "desc" }, skip: (query.page - 1) * query.limit, take: query.limit })]); return { items, pagination: paginationMetadata(query, total) }; }
export async function getAdminLoan(loanId: bigint) { const loan = await prisma.loans.findUnique({ where: { loan_id: loanId }, include: { customers: { select: { customer_number: true, first_name: true, last_name: true, customer_status: true, kyc_status: true } }, accounts: { select: { account_number: true, account_status: true } }, emi_schedules: { orderBy: { installment_number: "asc" } } } }); if (!loan) throw new Error("LOAN_NOT_FOUND"); return loan; }
