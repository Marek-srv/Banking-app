import { prisma } from "../../config/prisma";
import {
  Prisma,
  type AccountType,
  type CustomerStatus,
} from "../../generated/prisma/client";
import {
  PaginationInput,
  paginationMetadata,
} from "../../schemas/pagination.schema";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import {
  AdminListInput,
  CreateAtmInput,
  CreateBranchInput,
  CreateEmployeeInput,
  UpdateAtmInput,
  UpdateBranchInput,
  UpdateEmployeeInput,
} from "./admin.schema";

type AdminWriteErrorCode =
  | "BRANCH_NOT_FOUND"
  | "EMPLOYEE_NOT_FOUND"
  | "CUSTOMER_NOT_FOUND"
  | "ACCOUNT_NOT_FOUND"
  | "ATM_NOT_FOUND"
  | "MANAGER_MUST_BELONG_TO_BRANCH"
  | "ACCOUNT_CANNOT_CLOSE_WITH_BALANCE"
  | "ACCOUNT_ALREADY_CLOSED"
  | "ACCOUNT_ALREADY_FROZEN"
  | "ACCOUNT_NOT_FROZEN"
  | "INVALID_KYC_STATUS_TRANSITION"
  | "CUSTOMER_APPROVAL_INVALID_STATE"
  | "CUSTOMER_KYC_NOT_VERIFIED"
  | "CUSTOMER_PROFILE_INCOMPLETE"
  | "DUPLICATE_ACTIVE_CUSTOMER"
  | "CUSTOMER_REJECTION_INVALID_STATE"
  | "CUSTOMER_BLOCK_INVALID_STATE"
  | "CUSTOMER_UNBLOCK_INVALID_STATE"
  | "BLOCK_REASON_REQUIRED";

export class AdminWriteServiceError extends Error {
  constructor(public readonly code: AdminWriteErrorCode) {
    super(code);
  }
}

const customerSelect = {
  customer_id: true,
  customer_number: true,
  first_name: true,
  last_name: true,
  email: true,
  phone: true,
  kyc_status: true,
  customer_status: true,
  created_at: true,
  users: {
    select: {
      user_id: true,
      email: true,
      role: true,
      status: true,
    },
  },
  branches: {
    select: {
      branch_id: true,
      branch_code: true,
      branch_name: true,
    },
  },
} satisfies Prisma.customersSelect;

export async function getAdminDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [customers, activeCustomers, accounts, frozenAccounts, balance, transactionsToday, activeCards, branches, employees, atms, activeLoans, pendingCustomers, pendingAccounts, pendingLoans, pendingClosures] = await prisma.$transaction([
    prisma.customers.count(),
    prisma.customers.count({ where: { customer_status: "ACTIVE" } }),
    prisma.accounts.count(),
    prisma.accounts.count({ where: { account_status: "FROZEN" } }),
    prisma.accounts.aggregate({ _sum: { current_balance: true } }),
    prisma.transactions.count({ where: { initiated_at: { gte: today } } }),
    prisma.cards.count({ where: { card_status: "ACTIVE" } }),
    prisma.branches.count(),
    prisma.employees.count(),
    prisma.atms.count(),
    prisma.loans.count({ where: { status: { in: ["ACTIVE", "OVERDUE"] } } }),
    prisma.customers.count({ where: { customer_status: "PENDING_ADMIN_APPROVAL" } }),
    prisma.account_requests.count({ where: { status: "PENDING" } }),
    prisma.loan_requests.count({ where: { status: "PENDING" } }),
    prisma.account_closure_requests.count({ where: { status: "PENDING" } }),
  ]);
  return {
    totalCustomers: customers,
    activeCustomers,
    totalAccounts: accounts,
    frozenAccounts,
    totalBalance: balance._sum.current_balance?.toString() ?? "0",
    transactionsToday,
    activeCards,
    branches,
    employees,
    atms,
    activeLoans,
    pendingCustomerApprovals: pendingCustomers,
    pendingAccountRequests: pendingAccounts,
    pendingLoanRequests: pendingLoans,
    pendingClosureRequests: pendingClosures,
  };
}

export async function listAdminCustomers(input: AdminListInput) {
  const skip = (input.page - 1) * input.limit;
  const where: Prisma.customersWhereInput = {
    ...(input.status ? { customer_status: input.status as CustomerStatus } : {}),
    ...(input.kycStatus ? { kyc_status: input.kycStatus } : {}),
    ...(input.search ? { OR: [
      { customer_number: { contains: input.search, mode: "insensitive" } },
      { first_name: { contains: input.search, mode: "insensitive" } },
      { last_name: { contains: input.search, mode: "insensitive" } },
      { email: { contains: input.search, mode: "insensitive" } },
      { phone: { contains: input.search, mode: "insensitive" } },
    ] } : {}),
  };
  const [total, customers] = await prisma.$transaction([
    prisma.customers.count({ where }),
    prisma.customers.findMany({
      where,
      select: customerSelect,
      orderBy: { customer_id: "asc" },
      skip,
      take: input.limit,
    }),
  ]);

  return {
    items: customers.map((customer) => ({
      customerId: customer.customer_id.toString(),
      customerNumber: customer.customer_number,
      firstName: customer.first_name,
      lastName: customer.last_name,
      email: customer.email ?? customer.users.email,
      phone: customer.phone,
      kycStatus: customer.kyc_status,
      customerStatus: customer.customer_status,
      createdAt: customer.created_at,
      user: {
        userId: customer.users.user_id.toString(),
        role: customer.users.role,
        status: customer.users.status,
      },
      branch: {
        branchId: customer.branches.branch_id.toString(),
        branchCode: customer.branches.branch_code,
        branchName: customer.branches.branch_name,
      },
    })),
    pagination: paginationMetadata(input, total),
  };
}

export async function getAdminCustomer(customerId: bigint) {
  const customer = await prisma.customers.findUnique({
    where: { customer_id: customerId },
    select: {
      ...customerSelect,
      phone: true,
      date_of_birth: true,
      address: true,
      city: true,
      state: true,
      postal_code: true,
      country: true,
      created_at: true,
      approved_at: true,
      approved_by: true,
      rejected_at: true,
      rejected_by: true,
      rejection_reason: true,
      blocked_at: true,
      blocked_by: true,
      block_reason: true,
      kyc_verified_at: true,
      kyc_verified_by: true,
      kyc_rejected_at: true,
      kyc_rejected_by: true,
      kyc_rejection_reason: true,
      accounts: {
        select: { account_id: true, account_number: true, account_type: true, current_balance: true, account_status: true, currency: true },
        orderBy: { created_at: "desc" },
      },
    },
  });
  if (!customer) throw new AdminWriteServiceError("CUSTOMER_NOT_FOUND");
  const accountIds = customer.accounts.map((account) => account.account_id);
  const [cards, transactions, accountRequests, loanRequests, loans] = await prisma.$transaction([
    prisma.cards.findMany({
      where: { account_id: { in: accountIds } },
      select: { card_id: true, card_reference: true, masked_card_number: true, card_type: true, card_status: true, account_id: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.transactions.findMany({
      where: { OR: [{ source_account_id: { in: accountIds } }, { destination_account_id: { in: accountIds } }] },
      select: { transaction_id: true, reference_number: true, transaction_type: true, amount: true, currency: true, status: true, initiated_at: true },
      orderBy: { initiated_at: "desc" }, take: 20,
    }),
    prisma.account_requests.findMany({ where: { customer_id: customerId }, select: { account_request_id: true, account_type: true, account_subtype: true, status: true, created_at: true }, orderBy: { created_at: "desc" }, take: 10 }),
    prisma.loan_requests.findMany({ where: { customer_id: customerId }, select: { loan_request_id: true, requested_amount: true, loan_type: true, status: true, created_at: true }, orderBy: { created_at: "desc" }, take: 10 }),
    prisma.loans.findMany({ where: { customer_id: customerId }, select: { loan_id: true, principal_amount: true, outstanding_principal: true, loan_type: true, status: true }, orderBy: { created_at: "desc" }, take: 10 }),
  ]);
  return {
    customerId: customer.customer_id.toString(), customerNumber: customer.customer_number,
    firstName: customer.first_name, lastName: customer.last_name, email: customer.email ?? customer.users.email,
    phone: customer.phone, dateOfBirth: customer.date_of_birth, address: customer.address,
    city: customer.city, state: customer.state, postalCode: customer.postal_code, country: customer.country,
    createdAt: customer.created_at,
    kycStatus: customer.kyc_status, customerStatus: customer.customer_status,
    approval: { approvedAt: customer.approved_at, approvedBy: customer.approved_by?.toString() ?? null },
    rejection: { rejectedAt: customer.rejected_at, rejectedBy: customer.rejected_by?.toString() ?? null, reason: customer.rejection_reason },
    blocking: { blockedAt: customer.blocked_at, blockedBy: customer.blocked_by?.toString() ?? null, reason: customer.block_reason },
    kycReview: {
      verifiedAt: customer.kyc_verified_at, verifiedBy: customer.kyc_verified_by?.toString() ?? null,
      rejectedAt: customer.kyc_rejected_at, rejectedBy: customer.kyc_rejected_by?.toString() ?? null,
      rejectionReason: customer.kyc_rejection_reason,
    },
    branch: { branchId: customer.branches.branch_id.toString(), branchCode: customer.branches.branch_code, branchName: customer.branches.branch_name },
    accounts: customer.accounts.map((account) => ({
      accountId: account.account_id.toString(), maskedAccountNumber: maskAccountNumber(account.account_number),
      accountType: account.account_type, currentBalance: account.current_balance.toString(), currency: account.currency, accountStatus: account.account_status,
    })),
    cards: cards.map((card) => ({ cardId: card.card_id.toString(), cardReference: card.card_reference, maskedCardNumber: card.masked_card_number, cardType: card.card_type, cardStatus: card.card_status, accountId: card.account_id.toString() })),
    transactions: transactions.map((item) => ({ transactionId: item.transaction_id.toString(), referenceNumber: item.reference_number, transactionType: item.transaction_type, amount: item.amount.toString(), currency: item.currency, status: item.status, initiatedAt: item.initiated_at })),
    accountRequests,
    loanRequests,
    loans,
  };
}

function maskAccountNumber(accountNumber: string): string {
  return `****${accountNumber.slice(-4)}`;
}

export async function listAdminAccounts(input: AdminListInput) {
  const skip = (input.page - 1) * input.limit;
  const where: Prisma.accountsWhereInput = {
    ...(input.status ? { account_status: input.status } : {}),
    ...(input.type ? { account_type: input.type as AccountType } : {}),
    ...(input.branchId ? { branch_id: input.branchId } : {}),
    ...(input.customer ? { customers: { OR: [
      { customer_number: { contains: input.customer, mode: "insensitive" } },
      { first_name: { contains: input.customer, mode: "insensitive" } },
      { last_name: { contains: input.customer, mode: "insensitive" } },
    ] } } : {}),
    ...(input.search ? { OR: [
      { account_number: { contains: input.search, mode: "insensitive" } },
      { customers: { customer_number: { contains: input.search, mode: "insensitive" } } },
      { customers: { first_name: { contains: input.search, mode: "insensitive" } } },
      { customers: { last_name: { contains: input.search, mode: "insensitive" } } },
    ] } : {}),
  };
  const [total, accounts] = await prisma.$transaction([
    prisma.accounts.count({ where }),
    prisma.accounts.findMany({
      where,
      select: {
        account_id: true,
        account_number: true,
        account_type: true,
        account_subtype: true,
        ifsc_code: true,
        per_transaction_limit: true,
        daily_transfer_limit: true,
        currency: true,
        current_balance: true,
        available_balance: true,
        account_status: true,
        opened_at: true,
        customers: {
          select: {
            customer_id: true,
            customer_number: true,
            first_name: true,
            last_name: true,
          },
        },
        branches: {
          select: {
            branch_id: true,
            branch_code: true,
            branch_name: true,
          },
        },
      },
      orderBy: { account_id: "asc" },
      skip,
      take: input.limit,
    }),
  ]);

  return {
    items: accounts.map((account) => ({
      accountId: account.account_id.toString(),
      maskedAccountNumber: maskAccountNumber(account.account_number),
      accountType: account.account_type,
      accountSubtype: account.account_subtype,
      ifscCode: account.ifsc_code,
      perTransactionLimit: account.per_transaction_limit?.toString() ?? null,
      dailyTransferLimit: account.daily_transfer_limit?.toString() ?? null,
      currency: account.currency,
      currentBalance: account.current_balance.toString(),
      availableBalance: account.available_balance.toString(),
      accountStatus: account.account_status,
      openedAt: account.opened_at,
      customer: {
        customerId: account.customers.customer_id.toString(),
        customerNumber: account.customers.customer_number,
        firstName: account.customers.first_name,
        lastName: account.customers.last_name,
      },
      branch: {
        branchId: account.branches.branch_id.toString(),
        branchCode: account.branches.branch_code,
        branchName: account.branches.branch_name,
      },
    })),
    pagination: paginationMetadata(input, total),
  };
}

export async function listAdminTransactions(input: AdminListInput) {
  const skip = (input.page - 1) * input.limit;
  const where: Prisma.transactionsWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.type ? { transaction_type: input.type } : {}),
    ...(input.from || input.to ? { initiated_at: { ...(input.from ? { gte: new Date(`${input.from}T00:00:00.000Z`) } : {}), ...(input.to ? { lte: new Date(`${input.to}T23:59:59.999Z`) } : {}) } } : {}),
    AND: [
      ...(input.customer ? [{ OR: [
        { accounts_transactions_source_account_idToaccounts: { customers: { OR: [{ customer_number: { contains: input.customer, mode: "insensitive" as const } }, { first_name: { contains: input.customer, mode: "insensitive" as const } }, { last_name: { contains: input.customer, mode: "insensitive" as const } }] } } },
        { accounts_transactions_destination_account_idToaccounts: { customers: { OR: [{ customer_number: { contains: input.customer, mode: "insensitive" as const } }, { first_name: { contains: input.customer, mode: "insensitive" as const } }, { last_name: { contains: input.customer, mode: "insensitive" as const } }] } } },
      ] }] : []),
      ...(input.search ? [{ OR: [
        { reference_number: { contains: input.search, mode: "insensitive" as const } },
        { accounts_transactions_source_account_idToaccounts: { account_number: { contains: input.search, mode: "insensitive" as const } } },
        { accounts_transactions_destination_account_idToaccounts: { account_number: { contains: input.search, mode: "insensitive" as const } } },
      ] }] : []),
    ],
  };
  const [total, transactions] = await prisma.$transaction([
    prisma.transactions.count({ where }),
    prisma.transactions.findMany({
      where,
      select: {
        transaction_id: true,
        reference_number: true,
        transaction_type: true,
        source_account_id: true,
        destination_account_id: true,
        amount: true,
        currency: true,
        status: true,
        initiated_at: true,
        completed_at: true,
        accounts_transactions_source_account_idToaccounts: { select: { account_number: true, customers: { select: { customer_number: true, first_name: true, last_name: true } } } },
        accounts_transactions_destination_account_idToaccounts: { select: { account_number: true, customers: { select: { customer_number: true, first_name: true, last_name: true } } } },
        transaction_details: { select: { description: true, merchant_payee: true, notes: true }, orderBy: { created_at: "asc" }, take: 1 },
      },
      orderBy: { initiated_at: "desc" },
      skip,
      take: input.limit,
    }),
  ]);

  return {
    items: transactions.map((transaction) => ({
      transactionId: transaction.transaction_id.toString(),
      referenceNumber: transaction.reference_number,
      transactionType: transaction.transaction_type,
      sourceAccount: transaction.accounts_transactions_source_account_idToaccounts ? maskAccountNumber(transaction.accounts_transactions_source_account_idToaccounts.account_number) : null,
      destinationAccount: transaction.accounts_transactions_destination_account_idToaccounts ? maskAccountNumber(transaction.accounts_transactions_destination_account_idToaccounts.account_number) : null,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      status: transaction.status,
      initiatedAt: transaction.initiated_at,
      completedAt: transaction.completed_at,
      source: transaction.accounts_transactions_source_account_idToaccounts ? { customerNumber: transaction.accounts_transactions_source_account_idToaccounts.customers.customer_number, customerName: `${transaction.accounts_transactions_source_account_idToaccounts.customers.first_name} ${transaction.accounts_transactions_source_account_idToaccounts.customers.last_name}` } : null,
      destination: transaction.accounts_transactions_destination_account_idToaccounts ? { customerNumber: transaction.accounts_transactions_destination_account_idToaccounts.customers.customer_number, customerName: `${transaction.accounts_transactions_destination_account_idToaccounts.customers.first_name} ${transaction.accounts_transactions_destination_account_idToaccounts.customers.last_name}` } : null,
      description: transaction.transaction_details[0]?.description ?? transaction.transaction_details[0]?.merchant_payee ?? transaction.transaction_details[0]?.notes ?? null,
    })),
    pagination: paginationMetadata(input, total),
  };
}

export async function getAdminTransaction(transactionId: bigint) {
  const item = await prisma.transactions.findUnique({
    where: { transaction_id: transactionId },
    select: {
      transaction_id: true, reference_number: true, transaction_type: true, amount: true, currency: true,
      status: true, initiated_at: true, completed_at: true,
      accounts_transactions_source_account_idToaccounts: { select: { account_number: true, customers: { select: { customer_number: true, first_name: true, last_name: true } } } },
      accounts_transactions_destination_account_idToaccounts: { select: { account_number: true, customers: { select: { customer_number: true, first_name: true, last_name: true } } } },
      transaction_details: { select: { description: true, merchant_payee: true, transaction_category: true, notes: true }, orderBy: { created_at: "asc" } },
      transaction_status_history: { select: { status: true, description: true, created_at: true }, orderBy: { created_at: "asc" } },
    },
  });
  if (!item) throw new Error("TRANSACTION_NOT_FOUND");
  const account = (value: typeof item.accounts_transactions_source_account_idToaccounts) => value ? ({
    maskedAccountNumber: maskAccountNumber(value.account_number), customerNumber: value.customers.customer_number,
    customerName: `${value.customers.first_name} ${value.customers.last_name}`,
  }) : null;
  return {
    transactionId: item.transaction_id.toString(), referenceNumber: item.reference_number, transactionType: item.transaction_type,
    amount: item.amount.toString(), currency: item.currency, status: item.status, initiatedAt: item.initiated_at, completedAt: item.completed_at,
    source: account(item.accounts_transactions_source_account_idToaccounts), destination: account(item.accounts_transactions_destination_account_idToaccounts),
    details: item.transaction_details, statusHistory: item.transaction_status_history,
  };
}

export async function listAdminEmployees(input: AdminListInput) {
  const where: Prisma.employeesWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { OR: [
      { employee_number: { contains: input.search, mode: "insensitive" } }, { first_name: { contains: input.search, mode: "insensitive" } },
      { last_name: { contains: input.search, mode: "insensitive" } }, { email: { contains: input.search, mode: "insensitive" } },
    ] } : {}),
  };
  const [total, items] = await prisma.$transaction([
    prisma.employees.count({ where }),
    prisma.employees.findMany({ where, include: { branches_employees_branch_idTobranches: { select: { branch_id: true, branch_code: true, branch_name: true } } }, orderBy: { employee_id: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
  ]);
  return { items: items.map((employee) => ({ employeeId: employee.employee_id.toString(), employeeNumber: employee.employee_number, firstName: employee.first_name, lastName: employee.last_name, position: employee.position, email: employee.email, phone: employee.phone, gender: employee.gender, hireDate: employee.hire_date, qualification: employee.qualification, status: employee.status, branch: { branchId: employee.branches_employees_branch_idTobranches.branch_id.toString(), branchCode: employee.branches_employees_branch_idTobranches.branch_code, branchName: employee.branches_employees_branch_idTobranches.branch_name } })), pagination: paginationMetadata(input, total) };
}

export async function listAdminBranches(input: AdminListInput) {
  const where: Prisma.branchesWhereInput = { ...(input.status ? { status: input.status } : {}), ...(input.search ? { OR: [{ branch_code: { contains: input.search, mode: "insensitive" } }, { branch_name: { contains: input.search, mode: "insensitive" } }, { city: { contains: input.search, mode: "insensitive" } }] } : {}) };
  const [total, items] = await prisma.$transaction([
    prisma.branches.count({ where }),
    prisma.branches.findMany({ where, include: { employees_branches_manager_idToemployees: { select: { employee_id: true, employee_number: true, first_name: true, last_name: true } }, employees_employees_branch_idTobranches: { select: { employee_id: true, employee_number: true, first_name: true, last_name: true, position: true, status: true }, orderBy: { employee_number: "asc" } }, atms: { select: { atm_id: true, atm_code: true, location: true, status: true }, orderBy: { atm_code: "asc" } }, _count: { select: { employees_employees_branch_idTobranches: true, atms: true, accounts: true, customers: true } } }, orderBy: { branch_name: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit }),
  ]);
  return { items: items.map((branch) => ({ branchId: branch.branch_id.toString(), branchCode: branch.branch_code, branchName: branch.branch_name, address: branch.address, city: branch.city, state: branch.state, postalCode: branch.postal_code, phone: branch.phone, email: branch.email, operatingHours: branch.operating_hours, status: branch.status, manager: branch.employees_branches_manager_idToemployees ? { employeeId: branch.employees_branches_manager_idToemployees.employee_id.toString(), employeeNumber: branch.employees_branches_manager_idToemployees.employee_number, name: `${branch.employees_branches_manager_idToemployees.first_name} ${branch.employees_branches_manager_idToemployees.last_name}` } : null, employees: branch.employees_employees_branch_idTobranches.map((employee) => ({ employeeId: employee.employee_id.toString(), employeeNumber: employee.employee_number, name: `${employee.first_name} ${employee.last_name}`, position: employee.position, status: employee.status })), atms: branch.atms.map((atm) => ({ atmId: atm.atm_id.toString(), atmCode: atm.atm_code, location: atm.location, status: atm.status })), counts: { employees: branch._count.employees_employees_branch_idTobranches, atms: branch._count.atms, accounts: branch._count.accounts, customers: branch._count.customers } })), pagination: paginationMetadata(input, total) };
}

export async function listAdminAtms(input: AdminListInput) {
  const where: Prisma.atmsWhereInput = { ...(input.status ? { status: input.status } : {}), ...(input.search ? { OR: [{ atm_code: { contains: input.search, mode: "insensitive" } }, { location: { contains: input.search, mode: "insensitive" } }, { branches: { branch_name: { contains: input.search, mode: "insensitive" } } }] } : {}) };
  const [total, items] = await prisma.$transaction([prisma.atms.count({ where }), prisma.atms.findMany({ where, include: { branches: { select: { branch_id: true, branch_code: true, branch_name: true, city: true } } }, orderBy: { atm_code: "asc" }, skip: (input.page - 1) * input.limit, take: input.limit })]);
  return { items: items.map((atm) => ({ atmId: atm.atm_id.toString(), atmCode: atm.atm_code, location: atm.location, status: atm.status, operatingHours: atm.operating_hours, supportedTransactions: atm.supported_transactions, branch: { branchId: atm.branches.branch_id.toString(), branchCode: atm.branches.branch_code, branchName: atm.branches.branch_name, city: atm.branches.city } })), pagination: paginationMetadata(input, total) };
}

export async function listAdminCards(input: AdminListInput) {
  const where: Prisma.cardsWhereInput = { ...(input.status ? { card_status: input.status } : {}), ...(input.type ? { card_type: input.type } : {}), ...(input.search ? { OR: [{ card_reference: { contains: input.search, mode: "insensitive" } }, { accounts: { account_number: { contains: input.search, mode: "insensitive" } } }, { accounts: { customers: { customer_number: { contains: input.search, mode: "insensitive" } } } }] } : {}) };
  const [total, items] = await prisma.$transaction([prisma.cards.count({ where }), prisma.cards.findMany({ where, include: { accounts: { select: { account_number: true, account_type: true, customers: { select: { customer_number: true, first_name: true, last_name: true } } } } }, orderBy: { created_at: "desc" }, skip: (input.page - 1) * input.limit, take: input.limit })]);
  return { items: items.map((card) => ({ cardId: card.card_id.toString(), cardReference: card.card_reference, maskedCardNumber: card.masked_card_number, cardType: card.card_type, cardStatus: card.card_status, createdAt: card.created_at, account: { maskedAccountNumber: maskAccountNumber(card.accounts.account_number), accountType: card.accounts.account_type }, customer: { customerNumber: card.accounts.customers.customer_number, name: `${card.accounts.customers.first_name} ${card.accounts.customers.last_name}` } })), pagination: paginationMetadata(input, total) };
}

export async function listAdminAuditLogs(input: AdminListInput) {
  const where: Prisma.audit_logsWhereInput = { ...(input.type ? { action: input.type } : {}), ...(input.entity ? { entity: input.entity } : {}), ...(input.from || input.to ? { created_at: { ...(input.from ? { gte: new Date(`${input.from}T00:00:00.000Z`) } : {}), ...(input.to ? { lte: new Date(`${input.to}T23:59:59.999Z`) } : {}) } } : {}), ...(input.search ? { OR: [{ action: { contains: input.search, mode: "insensitive" } }, { entity: { contains: input.search, mode: "insensitive" } }, { users: { email: { contains: input.search, mode: "insensitive" } } }] } : {}) };
  const [total, items] = await prisma.$transaction([prisma.audit_logs.count({ where }), prisma.audit_logs.findMany({ where, include: { users: { select: { email: true, customers: { select: { customer_number: true, first_name: true, last_name: true } } } } }, orderBy: { created_at: "desc" }, skip: (input.page - 1) * input.limit, take: input.limit })]);
  return { items: items.map((log) => ({ auditId: log.audit_id.toString(), user: { email: log.users.email, customerNumber: log.users.customers?.customer_number ?? null, name: log.users.customers ? `${log.users.customers.first_name} ${log.users.customers.last_name}` : "System user" }, action: log.action, entity: log.entity, entityId: log.entity_id.toString(), ipAddress: log.ip_address, reason: log.reason, metadata: log.metadata, createdAt: log.created_at })), pagination: paginationMetadata(input, total) };
}

export async function createAdminEmployee(
  adminUserId: bigint,
  input: CreateEmployeeInput,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const branch = await transaction.branches.findUnique({
      where: { branch_id: input.branchId },
      select: { branch_id: true },
    });

    if (!branch) {
      throw new AdminWriteServiceError("BRANCH_NOT_FOUND");
    }

    const employee = await transaction.employees.create({
      data: {
        branch_id: branch.branch_id,
        employee_number: input.employeeNumber,
        first_name: input.firstName,
        last_name: input.lastName,
        position: input.position ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        gender: input.gender ?? null,
        hire_date: input.hireDate ? new Date(input.hireDate) : null,
        qualification: input.qualification ?? null,
        status: "ACTIVE",
      },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId: adminUserId,
        action: "EMPLOYEE_CREATED",
        entity: "EMPLOYEE",
        entityId: employee.employee_id,
      },
      transaction
    );

    return employee;
  });
}

export async function updateEmployeeStatus(
  adminUserId: bigint,
  employeeId: bigint,
  status: "ACTIVE" | "INACTIVE",
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const employee = await transaction.employees.findUnique({
      where: { employee_id: employeeId },
    });

    if (!employee) {
      throw new AdminWriteServiceError("EMPLOYEE_NOT_FOUND");
    }

    const updated = await transaction.employees.update({
      where: { employee_id: employeeId },
      data: { status },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId: adminUserId,
        action: "EMPLOYEE_STATUS_CHANGED",
        entity: "EMPLOYEE",
        entityId: employeeId,
      },
      transaction
    );

    return updated;
  });
}

export async function updateCustomerKycStatus(
  adminUserId: bigint,
  customerId: bigint,
  status: "PENDING" | "VERIFIED" | "REJECTED",
  reason: string | undefined,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.findUnique({
      where: { customer_id: customerId },
      select: { customer_id: true, kyc_status: true },
    });
    if (!customer) throw new AdminWriteServiceError("CUSTOMER_NOT_FOUND");

    const allowed =
      (customer.kyc_status === "PENDING" && ["VERIFIED", "REJECTED"].includes(status)) ||
      (customer.kyc_status === "VERIFIED" && ["PENDING", "REJECTED"].includes(status)) ||
      (customer.kyc_status === "REJECTED" && status === "PENDING");
    if (!allowed) {
      throw new AdminWriteServiceError("INVALID_KYC_STATUS_TRANSITION");
    }

    const now = new Date();
    const updated = await transaction.customers.update({
      where: { customer_id: customerId },
      data: {
        kyc_status: status,
        ...(status === "VERIFIED"
          ? {
              kyc_verified_at: now,
              kyc_verified_by: adminUserId,
              kyc_rejected_at: null,
              kyc_rejected_by: null,
              kyc_rejection_reason: null,
            }
          : status === "REJECTED"
            ? {
                kyc_verified_at: null,
                kyc_verified_by: null,
                kyc_rejected_at: now,
                kyc_rejected_by: adminUserId,
                kyc_rejection_reason: reason!,
              }
            : {
                kyc_verified_at: null,
                kyc_verified_by: null,
                kyc_rejected_at: null,
                kyc_rejected_by: null,
                kyc_rejection_reason: null,
              }),
        updated_at: now,
      },
    });

    await transaction.customer_kyc_status_history.create({
      data: {
        customer_id: customerId,
        previous_status: customer.kyc_status,
        new_status: status,
        changed_by: adminUserId,
        reason: reason ?? null,
      },
    });
    await createAuditLog(
      {
        ...auditContext,
        userId: adminUserId,
        action: status === "VERIFIED" ? "KYC_VERIFIED" : status === "REJECTED" ? "KYC_REJECTED" : "KYC_STATUS_CHANGED",
        entity: "KYC",
        entityId: customerId,
        ...(reason !== undefined ? { reason } : {}),
        metadata: { previousStatus: customer.kyc_status, newStatus: status },
      },
      transaction
    );
    return updated;
  });
}

export async function approveCustomer(
  adminUserId: bigint,
  customerId: bigint,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.findUnique({
      where: { customer_id: customerId },
      include: { users: { select: { user_id: true, status: true } } },
    });
    if (!customer) throw new AdminWriteServiceError("CUSTOMER_NOT_FOUND");
    if (customer.customer_status !== "PENDING_ADMIN_APPROVAL") {
      throw new AdminWriteServiceError("CUSTOMER_APPROVAL_INVALID_STATE");
    }
    if (customer.kyc_status !== "VERIFIED") {
      throw new AdminWriteServiceError("CUSTOMER_KYC_NOT_VERIFIED");
    }
    if (!customer.first_name || !customer.last_name || !customer.email || !customer.phone || !customer.date_of_birth) {
      throw new AdminWriteServiceError("CUSTOMER_PROFILE_INCOMPLETE");
    }

    const duplicate = await transaction.customers.findFirst({
      where: {
        customer_id: { not: customerId },
        customer_status: "ACTIVE",
        OR: [{ email: customer.email }, { phone: customer.phone }],
      },
      select: { customer_id: true },
    });
    if (duplicate) throw new AdminWriteServiceError("DUPLICATE_ACTIVE_CUSTOMER");

    const now = new Date();
    const updated = await transaction.customers.update({
      where: { customer_id: customerId },
      data: {
        customer_status: "ACTIVE",
        approved_at: now,
        approved_by: adminUserId,
        updated_at: now,
      },
    });
    await transaction.users.update({
      where: { user_id: customer.user_id },
      data: { status: "ACTIVE", token_version: { increment: 1 }, updated_at: now },
    });
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "CUSTOMER_APPROVED", entity: "CUSTOMER", entityId: customerId },
      transaction
    );
    return updated;
  }, { isolationLevel: "Serializable" });
}

export async function rejectCustomer(
  adminUserId: bigint,
  customerId: bigint,
  reason: string,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.findUnique({
      where: { customer_id: customerId },
      select: { user_id: true, customer_status: true },
    });
    if (!customer) throw new AdminWriteServiceError("CUSTOMER_NOT_FOUND");
    if (customer.customer_status !== "PENDING_ADMIN_APPROVAL") {
      throw new AdminWriteServiceError("CUSTOMER_REJECTION_INVALID_STATE");
    }
    const now = new Date();
    const updated = await transaction.customers.update({
      where: { customer_id: customerId },
      data: {
        customer_status: "REJECTED",
        rejected_at: now,
        rejected_by: adminUserId,
        rejection_reason: reason,
        updated_at: now,
      },
    });
    await transaction.users.update({
      where: { user_id: customer.user_id },
      data: { status: "REJECTED", token_version: { increment: 1 }, updated_at: now },
    });
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "CUSTOMER_REJECTED", entity: "CUSTOMER", entityId: customerId, reason },
      transaction
    );
    return updated;
  });
}

export async function blockCustomer(
  adminUserId: bigint,
  customerId: bigint,
  reason: string,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.findUnique({
      where: { customer_id: customerId },
      select: { user_id: true, customer_status: true },
    });
    if (!customer) throw new AdminWriteServiceError("CUSTOMER_NOT_FOUND");
    if (customer.customer_status !== "ACTIVE") {
      throw new AdminWriteServiceError("CUSTOMER_BLOCK_INVALID_STATE");
    }
    const now = new Date();
    const updated = await transaction.customers.update({
      where: { customer_id: customerId },
      data: { customer_status: "BLOCKED", blocked_at: now, blocked_by: adminUserId, block_reason: reason, updated_at: now },
    });
    await transaction.users.update({
      where: { user_id: customer.user_id },
      data: { status: "BLOCKED", token_version: { increment: 1 }, updated_at: now },
    });
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "CUSTOMER_BLOCKED", entity: "CUSTOMER", entityId: customerId, reason },
      transaction
    );
    return updated;
  });
}

export async function unblockCustomer(
  adminUserId: bigint,
  customerId: bigint,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.findUnique({
      where: { customer_id: customerId },
      select: { user_id: true, customer_status: true },
    });
    if (!customer) throw new AdminWriteServiceError("CUSTOMER_NOT_FOUND");
    if (customer.customer_status !== "BLOCKED") {
      throw new AdminWriteServiceError("CUSTOMER_UNBLOCK_INVALID_STATE");
    }
    const now = new Date();
    const updated = await transaction.customers.update({
      where: { customer_id: customerId },
      data: { customer_status: "ACTIVE", updated_at: now },
    });
    await transaction.users.update({
      where: { user_id: customer.user_id },
      data: { status: "ACTIVE", token_version: { increment: 1 }, updated_at: now },
    });
    await createAuditLog(
      { ...auditContext, userId: adminUserId, action: "CUSTOMER_UNBLOCKED", entity: "CUSTOMER", entityId: customerId },
      transaction
    );
    return updated;
  });
}

export async function updateCustomerStatus(
  adminUserId: bigint,
  customerId: bigint,
  status: "ACTIVE" | "BLOCKED" | "INACTIVE" | "SUSPENDED",
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.findUnique({
      where: { customer_id: customerId },
      select: { customer_id: true, user_id: true, customer_status: true },
    });

    if (!customer) {
      throw new AdminWriteServiceError("CUSTOMER_NOT_FOUND");
    }
    if (status === "BLOCKED") {
      throw new AdminWriteServiceError("BLOCK_REASON_REQUIRED");
    }
    if (["PENDING_ADMIN_APPROVAL", "REJECTED"].includes(customer.customer_status)) {
      throw new AdminWriteServiceError("CUSTOMER_APPROVAL_INVALID_STATE");
    }

    const updated = await transaction.customers.update({
      where: { customer_id: customerId },
      data: { customer_status: status },
    });

    await transaction.users.update({
      where: { user_id: customer.user_id },
      data: {
        status,
        token_version: { increment: 1 },
      },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId: adminUserId,
        action: status === "ACTIVE" ? "CUSTOMER_UNBLOCKED" : "CUSTOMER_STATUS_UPDATED",
        entity: "CUSTOMER",
        entityId: customerId,
      },
      transaction
    );

    return updated;
  });
}

async function setAccountFrozenState(
  adminUserId: bigint,
  accountId: bigint,
  frozen: boolean,
  reason: string,
  auditContext: AuditContext
) {
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ account_id: bigint; account_status: string }>>`
      SELECT account_id, account_status FROM accounts WHERE account_id = ${accountId} FOR UPDATE
    `;
    const account = rows[0];

    if (!account) {
      throw new AdminWriteServiceError("ACCOUNT_NOT_FOUND");
    }
    if (account.account_status === "CLOSED") {
      throw new AdminWriteServiceError("ACCOUNT_ALREADY_CLOSED");
    }
    if (frozen && account.account_status === "FROZEN") throw new AdminWriteServiceError("ACCOUNT_ALREADY_FROZEN");
    if (!frozen && account.account_status !== "FROZEN") throw new AdminWriteServiceError("ACCOUNT_NOT_FROZEN");

    const updated = await transaction.accounts.update({
      where: { account_id: accountId },
      data: frozen ? {
        account_status: "FROZEN", frozen_at: new Date(), frozen_by: adminUserId, freeze_reason: reason,
      } : {
        account_status: "ACTIVE", frozen_at: null, frozen_by: null, freeze_reason: null,
      },
    });

    const cards = frozen
      ? await transaction.cards.updateMany({ where: { account_id: accountId, card_status: "ACTIVE" }, data: { card_status: "BLOCKED", freeze_source: "ACCOUNT_FREEZE" } })
      : await transaction.cards.updateMany({ where: { account_id: accountId, card_status: "BLOCKED", freeze_source: "ACCOUNT_FREEZE" }, data: { card_status: "ACTIVE", freeze_source: null } });

    await createAuditLog(
      {
        ...auditContext,
        userId: adminUserId,
        action: frozen ? "ACCOUNT_FROZEN" : "ACCOUNT_UNFROZEN",
        entity: "ACCOUNT",
        entityId: accountId,
        reason,
        metadata: { linkedCardsChanged: cards.count },
      },
      transaction
    );

    return updated;
  });
}

export function freezeAccount(
  adminUserId: bigint,
  accountId: bigint,
  reason: string,
  auditContext: AuditContext
) {
  return setAccountFrozenState(adminUserId, accountId, true, reason, auditContext);
}

export function unfreezeAccount(
  adminUserId: bigint,
  accountId: bigint,
  reason: string,
  auditContext: AuditContext
) {
  return setAccountFrozenState(adminUserId, accountId, false, reason, auditContext);
}

export async function getAdminAccount(accountId: bigint) {
  const direct = await prisma.accounts.findUnique({
    where: { account_id: accountId },
    select: {
      account_id: true, account_number: true, account_type: true, currency: true, current_balance: true,
      available_balance: true, account_status: true, opened_at: true, closed_at: true,
      customers: { select: { customer_id: true, customer_number: true, first_name: true, last_name: true } },
      branches: { select: { branch_id: true, branch_code: true, branch_name: true } },
      cards: { select: { card_id: true, card_reference: true, masked_card_number: true, card_type: true, card_status: true } },
    },
  });
  if (!direct) throw new AdminWriteServiceError("ACCOUNT_NOT_FOUND");
  return {
    accountId: direct.account_id.toString(), maskedAccountNumber: maskAccountNumber(direct.account_number), accountType: direct.account_type,
    currency: direct.currency, currentBalance: direct.current_balance.toString(), availableBalance: direct.available_balance.toString(),
    accountStatus: direct.account_status, openedAt: direct.opened_at, closedAt: direct.closed_at,
    customer: { customerId: direct.customers.customer_id.toString(), customerNumber: direct.customers.customer_number, name: `${direct.customers.first_name} ${direct.customers.last_name}` },
    branch: { branchId: direct.branches.branch_id.toString(), branchCode: direct.branches.branch_code, branchName: direct.branches.branch_name },
    cards: direct.cards.map((card) => ({ cardId: card.card_id.toString(), cardReference: card.card_reference, maskedCardNumber: card.masked_card_number, cardType: card.card_type, cardStatus: card.card_status })),
  };
}

export async function closeAccount(adminUserId: bigint, accountId: bigint, reason: string, auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ account_id: bigint; account_number: string; current_balance: Prisma.Decimal; available_balance: Prisma.Decimal; account_status: string }>>`
      SELECT account_id, account_number, current_balance, available_balance, account_status FROM accounts WHERE account_id = ${accountId} FOR UPDATE
    `;
    const account = rows[0];
    if (!account) throw new AdminWriteServiceError("ACCOUNT_NOT_FOUND");
    if (account.account_status === "CLOSED") throw new AdminWriteServiceError("ACCOUNT_ALREADY_CLOSED");
    if (!account.current_balance.isZero() || !account.available_balance.isZero()) throw new AdminWriteServiceError("ACCOUNT_CANNOT_CLOSE_WITH_BALANCE");
    const pending = await transaction.transactions.count({ where: { OR: [{ source_account_id: accountId }, { destination_account_id: accountId }], status: { in: ["INITIATED", "PROCESSING", "PENDING"] } } });
    if (pending > 0) throw new Error("ACCOUNT_HAS_PENDING_TRANSACTIONS");
    const loan = await transaction.loans.findFirst({ where: { account_id: accountId, OR: [{ status: { in: ["APPROVED", "ACTIVE", "OVERDUE"] } }, { emi_schedules: { some: { status: { in: ["PENDING", "OVERDUE", "PARTIALLY_PAID"] } } } }] } });
    if (loan) throw new Error("ACCOUNT_HAS_ACTIVE_LOAN_OBLIGATIONS");
    const updated = await transaction.accounts.update({ where: { account_id: accountId }, data: { account_status: "CLOSED", closed_at: new Date(), closed_by: adminUserId, close_reason: reason, frozen_at: null, frozen_by: null, freeze_reason: null } });
    const cards = await transaction.cards.updateMany({ where: { account_id: accountId, card_status: { not: "CLOSED" } }, data: { card_status: "CLOSED", freeze_source: "ACCOUNT_CLOSURE" } });
    const beneficiaries = await transaction.beneficiaries.updateMany({ where: { beneficiary_account_no: account.account_number, status: "ACTIVE" }, data: { status: "INACTIVE" } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "ACCOUNT_CLOSED", entity: "ACCOUNT", entityId: accountId, reason, metadata: { exceptionalAdminClosure: true, cardsClosed: cards.count, beneficiariesDisabled: beneficiaries.count } }, transaction);
    return updated;
  });
}

export async function createAdminBranch(adminUserId: bigint, input: CreateBranchInput, auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const branch = await transaction.branches.create({ data: {
      branch_code: input.branchCode, branch_name: input.branchName, address: input.address ?? null, city: input.city ?? null,
      state: input.state ?? null, postal_code: input.postalCode ?? null, phone: input.phone ?? null, email: input.email ?? null,
      operating_hours: input.operatingHours ?? null, status: "ACTIVE",
    } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "BRANCH_CREATED", entity: "BRANCH", entityId: branch.branch_id }, transaction);
    return branch;
  });
}

export async function updateAdminBranch(adminUserId: bigint, branchId: bigint, input: UpdateBranchInput, auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.branches.findUnique({ where: { branch_id: branchId }, select: { branch_id: true } });
    if (!existing) throw new AdminWriteServiceError("BRANCH_NOT_FOUND");
    const branch = await transaction.branches.update({ where: { branch_id: branchId }, data: {
      ...(input.branchName !== undefined ? { branch_name: input.branchName } : {}), ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}), ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.postalCode !== undefined ? { postal_code: input.postalCode } : {}), ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}), ...(input.operatingHours !== undefined ? { operating_hours: input.operatingHours } : {}),
    } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "BRANCH_UPDATED", entity: "BRANCH", entityId: branchId }, transaction);
    return branch;
  });
}

export async function setBranchManager(adminUserId: bigint, branchId: bigint, managerId: bigint | null, auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const branch = await transaction.branches.findUnique({ where: { branch_id: branchId }, select: { branch_id: true } });
    if (!branch) throw new AdminWriteServiceError("BRANCH_NOT_FOUND");
    if (managerId !== null) {
      const employee = await transaction.employees.findUnique({ where: { employee_id: managerId }, select: { branch_id: true } });
      if (!employee) throw new AdminWriteServiceError("EMPLOYEE_NOT_FOUND");
      if (employee.branch_id !== branchId) throw new AdminWriteServiceError("MANAGER_MUST_BELONG_TO_BRANCH");
    }
    const updated = await transaction.branches.update({ where: { branch_id: branchId }, data: { manager_id: managerId } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "BRANCH_UPDATED", entity: "BRANCH", entityId: branchId }, transaction);
    return updated;
  });
}

export async function setBranchStatus(adminUserId: bigint, branchId: bigint, status: "ACTIVE" | "INACTIVE", auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.branches.findUnique({ where: { branch_id: branchId }, select: { branch_id: true } });
    if (!existing) throw new AdminWriteServiceError("BRANCH_NOT_FOUND");
    const branch = await transaction.branches.update({ where: { branch_id: branchId }, data: { status } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "BRANCH_STATUS_CHANGED", entity: "BRANCH", entityId: branchId }, transaction);
    return branch;
  });
}

export async function createAdminAtm(adminUserId: bigint, input: CreateAtmInput, auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const branch = await transaction.branches.findUnique({ where: { branch_id: input.branchId }, select: { branch_id: true } });
    if (!branch) throw new AdminWriteServiceError("BRANCH_NOT_FOUND");
    const atm = await transaction.atms.create({ data: { branch_id: input.branchId, atm_code: input.atmCode, location: input.location, status: input.status, operating_hours: input.operatingHours ?? null, supported_transactions: input.supportedTransactions ?? null } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "ATM_CREATED", entity: "ATM", entityId: atm.atm_id }, transaction);
    return atm;
  });
}

export async function updateAdminAtm(adminUserId: bigint, atmId: bigint, input: UpdateAtmInput, auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.atms.findUnique({ where: { atm_id: atmId }, select: { atm_id: true } });
    if (!existing) throw new AdminWriteServiceError("ATM_NOT_FOUND");
    if (input.branchId !== undefined) {
      const branch = await transaction.branches.findUnique({ where: { branch_id: input.branchId }, select: { branch_id: true } });
      if (!branch) throw new AdminWriteServiceError("BRANCH_NOT_FOUND");
    }
    const atm = await transaction.atms.update({ where: { atm_id: atmId }, data: {
      ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}), ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.operatingHours !== undefined ? { operating_hours: input.operatingHours } : {}), ...(input.supportedTransactions !== undefined ? { supported_transactions: input.supportedTransactions } : {}),
    } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "ATM_UPDATED", entity: "ATM", entityId: atmId }, transaction);
    return atm;
  });
}

export async function setAtmStatus(adminUserId: bigint, atmId: bigint, status: "ACTIVE" | "MAINTENANCE" | "OUT_OF_SERVICE", auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.atms.findUnique({ where: { atm_id: atmId }, select: { atm_id: true } });
    if (!existing) throw new AdminWriteServiceError("ATM_NOT_FOUND");
    const atm = await transaction.atms.update({ where: { atm_id: atmId }, data: { status } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "ATM_STATUS_CHANGED", entity: "ATM", entityId: atmId }, transaction);
    return atm;
  });
}

export async function updateAdminEmployee(adminUserId: bigint, employeeId: bigint, input: UpdateEmployeeInput, auditContext: AuditContext) {
  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.employees.findUnique({ where: { employee_id: employeeId } });
    if (!existing) throw new AdminWriteServiceError("EMPLOYEE_NOT_FOUND");
    if (input.branchId !== undefined) {
      const branch = await transaction.branches.findUnique({ where: { branch_id: input.branchId }, select: { branch_id: true } });
      if (!branch) throw new AdminWriteServiceError("BRANCH_NOT_FOUND");
      if (input.branchId !== existing.branch_id) await transaction.branches.updateMany({ where: { manager_id: employeeId }, data: { manager_id: null } });
    }
    const employee = await transaction.employees.update({ where: { employee_id: employeeId }, data: {
      ...(input.branchId !== undefined ? { branch_id: input.branchId } : {}), ...(input.firstName !== undefined ? { first_name: input.firstName } : {}),
      ...(input.lastName !== undefined ? { last_name: input.lastName } : {}), ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}), ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}), ...(input.hireDate !== undefined ? { hire_date: new Date(input.hireDate) } : {}),
      ...(input.qualification !== undefined ? { qualification: input.qualification } : {}),
    } });
    await createAuditLog({ ...auditContext, userId: adminUserId, action: "EMPLOYEE_UPDATED", entity: "EMPLOYEE", entityId: employeeId }, transaction);
    return employee;
  });
}
