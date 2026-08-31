import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { cardIdSchema, createCardSchema } from "./card.schema";
import {
  blockCard,
  createCard,
  getCard,
  listCards,
  unblockCard,
} from "./card.service";
import { paginationQuerySchema } from "../../schemas/pagination.schema";

function parseCardId(value: unknown): bigint {
  return cardIdSchema.parse(value);
}

export async function createCardController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createCardSchema.parse(req.body);
    const card = await createCard(
      BigInt(req.user!.userId),
      input,
      getAuditContext(req)
    );
    return res.status(201).json({ success: true, data: card });
  } catch (error) {
    next(error);
  }
}

export async function listCardsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination = paginationQuerySchema.parse(req.query);
    const cards = await listCards(BigInt(req.user!.userId), pagination);
    return res.json({
      success: true,
      data: cards.items,
      pagination: cards.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCardController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const card = await getCard(
      BigInt(req.user!.userId),
      parseCardId(req.params.cardId)
    );
    return res.json({ success: true, data: card });
  } catch (error) {
    next(error);
  }
}

export async function blockCardController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const card = await blockCard(
      BigInt(req.user!.userId),
      parseCardId(req.params.cardId),
      getAuditContext(req)
    );
    return res.json({ success: true, data: card });
  } catch (error) {
    next(error);
  }
}

export async function unblockCardController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const card = await unblockCard(
      BigInt(req.user!.userId),
      parseCardId(req.params.cardId),
      getAuditContext(req)
    );
    return res.json({ success: true, data: card });
  } catch (error) {
    next(error);
  }
}
