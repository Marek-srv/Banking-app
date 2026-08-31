import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { createTransferSchema } from "./transfer.schema";
import { transferFunds } from "./transfer.service";
import { parseIdempotencyKey } from "../../schemas/idempotency.schema";
import { createIdempotencyRequest } from "../../services/idempotency.service";

export async function createTransferController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createTransferSchema.parse(req.body);
    const idempotency = createIdempotencyRequest(
      parseIdempotencyKey(req.header("Idempotency-Key")),
      "TRANSFER",
      {
        sourceAccountId: input.sourceAccountId.toString(),
        destinationAccountId: input.destinationAccountId.toString(),
        amount: input.amount.toString(),
        remarks: input.remarks ?? "",
      }
    );
    const transaction = await transferFunds(
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
