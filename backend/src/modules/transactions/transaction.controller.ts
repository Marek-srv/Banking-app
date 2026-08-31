import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import {
  depositFunds,
  withdrawFunds,
} from "./cash-operation.service";
import {
  cashOperationSchema,
  transactionListQuerySchema,
} from "./transaction.schema";
import { getTransaction, listTransactions } from "./transaction.service";
import { reverseTransaction } from "./reversal.service";
import { parseIdempotencyKey } from "../../schemas/idempotency.schema";
import { createIdempotencyRequest } from "../../services/idempotency.service";
import { generateTransactionReceipt } from "./receipt.service";

const transactionIdSchema = z.coerce.bigint().positive();

export async function depositController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = cashOperationSchema.parse(req.body);
    const idempotency = createIdempotencyRequest(
      parseIdempotencyKey(req.header("Idempotency-Key")),
      "DEPOSIT",
      {
        accountId: input.accountId.toString(),
        amount: input.amount.toString(),
      }
    );
    const transaction = await depositFunds(
      BigInt(req.user!.userId),
      input,
      getAuditContext(req),
      idempotency
    );
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
}

export async function withdrawController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = cashOperationSchema.parse(req.body);
    const idempotency = createIdempotencyRequest(
      parseIdempotencyKey(req.header("Idempotency-Key")),
      "WITHDRAWAL",
      {
        accountId: input.accountId.toString(),
        amount: input.amount.toString(),
      }
    );
    const transaction = await withdrawFunds(
      BigInt(req.user!.userId),
      input,
      getAuditContext(req),
      idempotency
    );
    return res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
}

export async function listTransactionsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const filters = transactionListQuerySchema.parse(req.query);
    const transactions = await listTransactions(
      BigInt(req.user!.userId),
      filters
    );
    return res.json({
      success: true,
      data: transactions.items,
      pagination: transactions.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTransactionController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const transactionId = transactionIdSchema.parse(
      req.params.transactionId
    );
    const transaction = await getTransaction(
      BigInt(req.user!.userId),
      transactionId
    );
    return res.json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
}

export async function downloadTransactionReceiptController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const transactionId = transactionIdSchema.parse(req.params.transactionId);
    const document = await generateTransactionReceipt(BigInt(req.user!.userId), transactionId);
    res.set({
      "Content-Type": document.contentType,
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(document.buffer);
  } catch (error) {
    next(error);
  }
}

export async function reverseTransactionController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const transactionId = transactionIdSchema.parse(
      req.params.transactionId
    );
    const reversal = await reverseTransaction(
      BigInt(req.user!.userId),
      transactionId,
      getAuditContext(req)
    );
    return res.status(201).json({ success: true, data: reversal });
  } catch (error) {
    next(error);
  }
}
