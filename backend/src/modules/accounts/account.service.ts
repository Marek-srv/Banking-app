import { randomBytes } from "crypto";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../config/prisma";
import { accountBranchForCustomer } from "../../domain/account.rules";
import { CreateAccountInput } from "./account.schema";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import {
  PaginationInput,
  paginationMetadata,
} from "../../schemas/pagination.schema";

const ACCOUNT_NUMBER_ATTEMPTS = 5;

export class AccountServiceError extends Error {
  constructor(
    public readonly code: "CUSTOMER_NOT_FOUND" | "ACCOUNT_NOT_FOUND"
  ) {
    super(code);
  }
}

function generateAccountNumber(): string {
  return `AC${randomBytes(9).toString("hex").toUpperCase()}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function findAuthenticatedCustomer(userId: bigint) {
  const customer = await prisma.customers.findUnique({
    where: { user_id: userId },
  });

  if (!customer) {
    throw new AccountServiceError("CUSTOMER_NOT_FOUND");
  }

  return customer;
}

export async function createAccount(
  userId: bigint,
  input: CreateAccountInput,
  auditContext: AuditContext
) {
  const customer = await findAuthenticatedCustomer(userId);
  const branchId = accountBranchForCustomer(customer.branch_id);

  for (let attempt = 0; attempt < ACCOUNT_NUMBER_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const account = await transaction.accounts.create({
          data: {
            account_number: generateAccountNumber(),
            customer_id: customer.customer_id,
            branch_id: branchId,
            account_type: input.accountType,
            currency: "INR",
            current_balance: 0,
            available_balance: 0,
            account_status: "ACTIVE",
            opened_at: new Date(),
          },
        });

        await createAuditLog(
          {
            ...auditContext,
            userId,
            action: "ACCOUNT_CREATED",
            entity: "ACCOUNT",
            entityId: account.account_id,
          },
          transaction
        );

        return account;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("ACCOUNT_NUMBER_GENERATION_FAILED");
}

export async function listAccounts(
  userId: bigint,
  pagination: PaginationInput
) {
  const customer = await findAuthenticatedCustomer(userId);
  const where = { customer_id: customer.customer_id, NOT: { account_type: "LOAN" as const, account_status: "CLOSED" } };
  const [total, accounts] = await prisma.$transaction([
    prisma.accounts.count({ where }),
    prisma.accounts.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
  ]);

  return { items: accounts, pagination: paginationMetadata(pagination, total) };
}

export async function getAccount(userId: bigint, accountId: bigint) {
  const customer = await findAuthenticatedCustomer(userId);
  const account = await prisma.accounts.findFirst({
    where: {
      account_id: accountId,
      customer_id: customer.customer_id,
    },
  });

  if (!account) {
    throw new AccountServiceError("ACCOUNT_NOT_FOUND");
  }

  return account;
}
