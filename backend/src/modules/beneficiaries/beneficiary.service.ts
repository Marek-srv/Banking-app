import { prisma } from "../../config/prisma";
import { CreateBeneficiaryInput } from "./beneficiary.schema";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import {
  PaginationInput,
  paginationMetadata,
} from "../../schemas/pagination.schema";

type BeneficiaryErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "BENEFICIARY_NOT_FOUND"
  | "BENEFICIARY_ALREADY_EXISTS";

export class BeneficiaryServiceError extends Error {
  constructor(public readonly code: BeneficiaryErrorCode) {
    super(code);
  }
}

async function findAuthenticatedCustomer(userId: bigint) {
  const customer = await prisma.customers.findUnique({
    where: { user_id: userId },
  });

  if (!customer) {
    throw new BeneficiaryServiceError("CUSTOMER_NOT_FOUND");
  }

  return customer;
}

export async function createBeneficiary(
  userId: bigint,
  input: CreateBeneficiaryInput,
  auditContext: AuditContext
) {
  const customer = await findAuthenticatedCustomer(userId);

  return prisma.$transaction(async (transaction) => {
    // Serialize beneficiary creation per customer so concurrent requests
    // cannot bypass the duplicate account-number check.
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(${customer.customer_id})::text
    `;

    const duplicate = await transaction.beneficiaries.findFirst({
      where: {
        customer_id: customer.customer_id,
        beneficiary_account_no: input.beneficiaryAccountNo,
      },
    });

    if (duplicate) {
      throw new BeneficiaryServiceError("BENEFICIARY_ALREADY_EXISTS");
    }

    const beneficiary = await transaction.beneficiaries.create({
      data: {
        customer_id: customer.customer_id,
        beneficiary_name: input.beneficiaryName,
        beneficiary_account_no: input.beneficiaryAccountNo,
        bank_name: input.bankName ?? null,
        bank_code: input.bankCode ?? null,
        nickname: input.nickname ?? null,
        status: "ACTIVE",
      },
    });

    const destinationAccount = await transaction.accounts.findUnique({
      where: { account_number: beneficiary.beneficiary_account_no },
      select: { account_id: true },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId,
        action: "BENEFICIARY_CREATED",
        entity: "BENEFICIARY",
        entityId: beneficiary.beneficiary_id,
      },
      transaction
    );

    return {
      ...beneficiary,
      destination_account_id: destinationAccount?.account_id ?? null,
    };
  });
}

export async function listBeneficiaries(
  userId: bigint,
  pagination: PaginationInput
) {
  const customer = await findAuthenticatedCustomer(userId);
  const where = {
    customer_id: customer.customer_id,
    status: "ACTIVE",
  };
  const [total, beneficiaries] = await prisma.$transaction([
    prisma.beneficiaries.count({ where }),
    prisma.beneficiaries.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
  ]);

  const destinationAccounts = beneficiaries.length
    ? await prisma.accounts.findMany({
        where: {
          account_number: {
            in: beneficiaries.map((beneficiary) => beneficiary.beneficiary_account_no),
          },
        },
        select: { account_id: true, account_number: true },
      })
    : [];
  const destinationIdByAccountNumber = new Map(
    destinationAccounts.map((account) => [account.account_number, account.account_id])
  );

  return {
    items: beneficiaries.map((beneficiary) => ({
      ...beneficiary,
      destination_account_id:
        destinationIdByAccountNumber.get(beneficiary.beneficiary_account_no) ?? null,
    })),
    pagination: paginationMetadata(pagination, total),
  };
}

export async function deleteBeneficiary(
  userId: bigint,
  beneficiaryId: bigint
) {
  const customer = await findAuthenticatedCustomer(userId);
  const beneficiary = await prisma.beneficiaries.findFirst({
    where: {
      beneficiary_id: beneficiaryId,
      customer_id: customer.customer_id,
      status: "ACTIVE",
    },
  });

  if (!beneficiary) {
    throw new BeneficiaryServiceError("BENEFICIARY_NOT_FOUND");
  }

  return prisma.beneficiaries.update({
    where: { beneficiary_id: beneficiary.beneficiary_id },
    data: { status: "INACTIVE" },
  });
}
