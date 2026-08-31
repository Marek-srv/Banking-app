import { randomBytes, randomInt } from "crypto";
import { prisma } from "../../config/prisma";
import { Prisma } from "../../generated/prisma/client";
import { CreateCardInput } from "./card.schema";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import {
  PaginationInput,
  paginationMetadata,
} from "../../schemas/pagination.schema";

type CardErrorCode =
  | "CUSTOMER_NOT_FOUND"
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_NOT_ACTIVE"
  | "CARD_NOT_FOUND"
  | "CARD_BLOCKED_BY_ACCOUNT";

const REFERENCE_ATTEMPTS = 5;

export class CardServiceError extends Error {
  constructor(public readonly code: CardErrorCode) {
    super(code);
  }
}

function generateCardReference(): string {
  const year = new Date().getUTCFullYear();
  const suffix = randomBytes(6).toString("hex").toUpperCase();
  return `CARD-${year}-${suffix}`;
}

function generateSyntheticMaskedCardNumber(): string {
  const lastFour = randomInt(0, 10_000).toString().padStart(4, "0");
  return `**** **** **** ${lastFour}`;
}

export async function createApprovedCard(
  transaction: Prisma.TransactionClient,
  accountId: bigint,
  cardType: "DEBIT" | "CREDIT"
) {
  return transaction.cards.create({
    data: {
      account_id: accountId,
      card_reference: generateCardReference(),
      masked_card_number: generateSyntheticMaskedCardNumber(),
      card_type: cardType,
      card_status: "ACTIVE",
    },
  });
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function toCardResponse(card: {
  card_id: bigint;
  account_id: bigint;
  card_reference: string;
  masked_card_number: string | null;
  card_type: string;
  card_status: string;
}) {
  return {
    cardId: card.card_id.toString(),
    accountId: card.account_id.toString(),
    cardReference: card.card_reference,
    maskedCardNumber: card.masked_card_number,
    cardType: card.card_type,
    cardStatus: card.card_status,
  };
}

async function findAuthenticatedCustomer(userId: bigint) {
  const customer = await prisma.customers.findUnique({
    where: { user_id: userId },
    select: { customer_id: true },
  });

  if (!customer) {
    throw new CardServiceError("CUSTOMER_NOT_FOUND");
  }

  return customer;
}

async function findOwnedCard(userId: bigint, cardId: bigint) {
  const customer = await findAuthenticatedCustomer(userId);
  const card = await prisma.cards.findFirst({
    where: {
      card_id: cardId,
      accounts: { customer_id: customer.customer_id },
    },
  });

  if (!card) {
    throw new CardServiceError("CARD_NOT_FOUND");
  }

  return card;
}

export async function createCard(
  userId: bigint,
  input: CreateCardInput,
  auditContext: AuditContext
) {
  const customer = await findAuthenticatedCustomer(userId);
  const account = await prisma.accounts.findFirst({
    where: {
      account_id: input.accountId,
      customer_id: customer.customer_id,
    },
  });

  if (!account) {
    throw new CardServiceError("ACCOUNT_NOT_FOUND");
  }

  if (account.account_status !== "ACTIVE") {
    throw new CardServiceError("ACCOUNT_NOT_ACTIVE");
  }

  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt++) {
    try {
      const card = await prisma.$transaction(async (transaction) => {
        const createdCard = await transaction.cards.create({
          data: {
            account_id: account.account_id,
            card_reference: generateCardReference(),
            masked_card_number: generateSyntheticMaskedCardNumber(),
            card_type: input.cardType,
            card_status: "ACTIVE",
          },
        });

        await createAuditLog(
          {
            ...auditContext,
            userId,
            action: "CARD_CREATED",
            entity: "CARD",
            entityId: createdCard.card_id,
          },
          transaction
        );

        return createdCard;
      });

      return toCardResponse(card);
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
    }
  }

  throw new Error("CARD_REFERENCE_GENERATION_FAILED");
}

export async function listCards(userId: bigint, pagination: PaginationInput) {
  const customer = await findAuthenticatedCustomer(userId);
  const where = { accounts: { customer_id: customer.customer_id } };
  const [total, cards] = await prisma.$transaction([
    prisma.cards.count({ where }),
    prisma.cards.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    }),
  ]);

  return {
    items: cards.map(toCardResponse),
    pagination: paginationMetadata(pagination, total),
  };
}

export async function getCard(userId: bigint, cardId: bigint) {
  return toCardResponse(await findOwnedCard(userId, cardId));
}

export async function blockCard(
  userId: bigint,
  cardId: bigint,
  auditContext: AuditContext
) {
  const card = await findOwnedCard(userId, cardId);
  const blockedCard = await prisma.$transaction(async (transaction) => {
    const updatedCard = await transaction.cards.update({
      where: { card_id: card.card_id },
      data: { card_status: "BLOCKED", freeze_source: "MANUAL" },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId,
        action: "CARD_BLOCKED",
        entity: "CARD",
        entityId: card.card_id,
      },
      transaction
    );

    return updatedCard;
  });

  return toCardResponse(blockedCard);
}

export async function unblockCard(
  userId: bigint,
  cardId: bigint,
  auditContext: AuditContext
) {
  const card = await findOwnedCard(userId, cardId);
  if (card.freeze_source === "ACCOUNT_FREEZE") {
    throw new CardServiceError("CARD_BLOCKED_BY_ACCOUNT");
  }
  const activeCard = await prisma.$transaction(async (transaction) => {
    const updatedCard = await transaction.cards.update({
      where: { card_id: card.card_id },
      data: { card_status: "ACTIVE", freeze_source: null },
    });

    await createAuditLog(
      {
        ...auditContext,
        userId,
        action: "CARD_UNBLOCKED",
        entity: "CARD",
        entityId: card.card_id,
      },
      transaction
    );

    return updatedCard;
  });

  return toCardResponse(activeCard);
}
