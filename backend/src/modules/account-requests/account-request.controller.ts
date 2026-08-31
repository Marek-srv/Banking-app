import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { paginationQuerySchema } from "../../schemas/pagination.schema";
import {
  accountRequestIdSchema,
  createAccountRequestSchema,
  updateAccountRequestSchema,
} from "./account-request.schema";
import {
  cancelAccountRequest,
  createAccountRequest,
  listAccountRequests,
  updateAccountRequest,
} from "./account-request.service";

export async function createAccountRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await createAccountRequest(BigInt(req.user!.userId), createAccountRequestSchema.parse(req.body), getAuditContext(req));
    return res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function listAccountRequestsController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await listAccountRequests(BigInt(req.user!.userId), paginationQuerySchema.parse(req.query));
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) { next(error); }
}

export async function updateAccountRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await updateAccountRequest(BigInt(req.user!.userId), accountRequestIdSchema.parse(req.params.requestId), updateAccountRequestSchema.parse(req.body));
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function cancelAccountRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await cancelAccountRequest(BigInt(req.user!.userId), accountRequestIdSchema.parse(req.params.requestId), getAuditContext(req));
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
}
