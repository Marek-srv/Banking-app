import { prisma } from "../../config/prisma";
import {
  PaginationInput,
  paginationMetadata,
} from "../../schemas/pagination.schema";

export class AtmServiceError extends Error {
  constructor(public readonly code: "ATM_NOT_FOUND") {
    super(code);
  }
}

const atmSelect = {
  atm_id: true,
  atm_code: true,
  location: true,
  status: true,
  operating_hours: true,
  supported_transactions: true,
  branches: {
    select: {
      branch_id: true,
      branch_code: true,
      branch_name: true,
      address: true,
      city: true,
      state: true,
      country: true,
      postal_code: true,
    },
  },
};

function toAtmResponse(atm: {
  atm_id: bigint;
  atm_code: string;
  location: string;
  status: string;
  operating_hours: string | null;
  supported_transactions: string | null;
  branches: {
    branch_id: bigint;
    branch_code: string;
    branch_name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
  };
}) {
  return {
    atmId: atm.atm_id.toString(),
    atmCode: atm.atm_code,
    location: atm.location,
    status: atm.status,
    operatingHours: atm.operating_hours,
    supportedTransactions: atm.supported_transactions,
    branch: {
      branchId: atm.branches.branch_id.toString(),
      branchCode: atm.branches.branch_code,
      branchName: atm.branches.branch_name,
      address: atm.branches.address,
      city: atm.branches.city,
      state: atm.branches.state,
      country: atm.branches.country,
      postalCode: atm.branches.postal_code,
    },
  };
}

export async function listAtms(pagination: PaginationInput) {
  const [total, atms] = await prisma.$transaction([
    prisma.atms.count(),
    prisma.atms.findMany({
      select: atmSelect,
      orderBy: { atm_code: "asc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
  ]);

  return {
    items: atms.map(toAtmResponse),
    pagination: paginationMetadata(pagination, total),
  };
}

export async function getAtm(atmId: bigint) {
  const atm = await prisma.atms.findUnique({
    where: { atm_id: atmId },
    select: atmSelect,
  });

  if (!atm) {
    throw new AtmServiceError("ATM_NOT_FOUND");
  }

  return toAtmResponse(atm);
}
