// src/modules/customers/customer.service.ts

import { prisma } from "../../config/prisma";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";

export async function createCustomer(
  userId: bigint,
  data: any,
  auditContext: AuditContext
) {
  const existing = await prisma.customers.findUnique({
    where: {
      user_id: userId,
    },
  });

  if (existing) {
    throw new Error("CUSTOMER_ALREADY_EXISTS");
  }

  return prisma.$transaction(async (transaction) => {
    const customer = await transaction.customers.create({
      data: {
        user_id: userId,
        branch_id: data.branchId,
        customer_number: `CUS${Date.now()}`,
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone,
        date_of_birth: data.dateOfBirth
          ? new Date(data.dateOfBirth)
          : null,
        gender: data.gender,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postal_code: data.postalCode,
        kyc_status: "PENDING",
        customer_status: "ACTIVE",
      },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId,
        action: "CUSTOMER_CREATED",
        entity: "CUSTOMER",
        entityId: customer.customer_id,
      },
      transaction
    );

    return customer;
  });
}

export async function getMyProfile(userId: bigint) {
  return prisma.customers.findUnique({
    where: {
      user_id: userId,
    },
  });
}
