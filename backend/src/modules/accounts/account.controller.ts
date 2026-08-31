import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { accountIdSchema, createAccountSchema, statementQuerySchema } from "./account.schema";
import { createAccount, getAccount, listAccounts } from "./account.service";
import { paginationQuerySchema } from "../../schemas/pagination.schema";
import { generateAccountStatement } from "./statement.service";

export async function createAccountController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createAccountSchema.parse(req.body);
    const account = await createAccount(
      BigInt(req.user!.userId),
      input,
      getAuditContext(req)
    );
    return res.status(201).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
}

export async function listAccountsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination = paginationQuerySchema.parse(req.query);
    const accounts = await listAccounts(
      BigInt(req.user!.userId),
      pagination
    );
    return res.json({
      success: true,
      data: accounts.items,
      pagination: accounts.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAccountController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const accountId = accountIdSchema.parse(req.params.accountId);
    const account = await getAccount(
      BigInt(req.user!.userId),
      accountId
    );
    return res.json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
}

export async function downloadStatementController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const accountId = accountIdSchema.parse(req.params.accountId);
    const query = statementQuerySchema.parse(req.query);
    const document = await generateAccountStatement(BigInt(req.user!.userId), accountId, query);
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
