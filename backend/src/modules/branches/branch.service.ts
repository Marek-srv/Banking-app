import { prisma } from "../../config/prisma";
import {
  PaginationInput,
  paginationMetadata,
} from "../../schemas/pagination.schema";

export class BranchServiceError extends Error {
  constructor(public readonly code: "BRANCH_NOT_FOUND") {
    super(code);
  }
}

const branchSelect = {
  branch_id: true,
  branch_code: true,
  branch_name: true,
  address: true,
  city: true,
  state: true,
  country: true,
  postal_code: true,
  phone: true,
  email: true,
  operating_hours: true,
  atms: {
    select: {
      atm_id: true,
      atm_code: true,
      location: true,
      status: true,
      operating_hours: true,
      supported_transactions: true,
    },
    orderBy: { atm_code: "asc" as const },
  },
};

function toBranchResponse(branch: {
  branch_id: bigint;
  branch_code: string;
  branch_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  operating_hours: string | null;
  atms: Array<{
    atm_id: bigint;
    atm_code: string;
    location: string;
    status: string;
    operating_hours: string | null;
    supported_transactions: string | null;
  }>;
}) {
  return {
    branchId: branch.branch_id.toString(),
    branchCode: branch.branch_code,
    branchName: branch.branch_name,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    country: branch.country,
    postalCode: branch.postal_code,
    phone: branch.phone,
    email: branch.email,
    operatingHours: branch.operating_hours,
    atms: branch.atms.map((atm) => ({
      atmId: atm.atm_id.toString(),
      atmCode: atm.atm_code,
      location: atm.location,
      status: atm.status,
      operatingHours: atm.operating_hours,
      supportedTransactions: atm.supported_transactions,
    })),
  };
}

export async function listBranches(pagination: PaginationInput) {
  const [total, branches] = await prisma.$transaction([
    prisma.branches.count(),
    prisma.branches.findMany({
      select: branchSelect,
      orderBy: { branch_name: "asc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
  ]);

  return {
    items: branches.map(toBranchResponse),
    pagination: paginationMetadata(pagination, total),
  };
}

export async function getBranch(branchId: bigint) {
  const branch = await prisma.branches.findUnique({
    where: { branch_id: branchId },
    select: branchSelect,
  });

  if (!branch) {
    throw new BranchServiceError("BRANCH_NOT_FOUND");
  }

  return toBranchResponse(branch);
}
