import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { createClosureRequestSchema, createTransferLimitRequestSchema, servicingListSchema, servicingRequestIdSchema } from "./account-servicing.schema";
import { cancelClosureRequest, cancelTransferLimitRequest, createClosureRequest, createTransferLimitRequest, listClosureRequests, listTransferLimitRequests } from "./account-servicing.service";

const handle = (fn: (req: AuthRequest) => Promise<unknown>, status = 200) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try { res.status(status).json({ success: true, data: await fn(req) }); } catch (error) { next(error); }
};

export const createClosureRequestController = handle((req) => createClosureRequest(BigInt(req.user!.userId), createClosureRequestSchema.parse(req.body), getAuditContext(req)), 201);
export const listClosureRequestsController = handle((req) => listClosureRequests(BigInt(req.user!.userId), servicingListSchema.parse(req.query)));
export const cancelClosureRequestController = handle((req) => cancelClosureRequest(BigInt(req.user!.userId), servicingRequestIdSchema.parse(req.params.requestId), getAuditContext(req)));
export const createTransferLimitRequestController = handle((req) => createTransferLimitRequest(BigInt(req.user!.userId), createTransferLimitRequestSchema.parse(req.body), getAuditContext(req)), 201);
export const listTransferLimitRequestsController = handle((req) => listTransferLimitRequests(BigInt(req.user!.userId), servicingListSchema.parse(req.query)));
export const cancelTransferLimitRequestController = handle((req) => cancelTransferLimitRequest(BigInt(req.user!.userId), servicingRequestIdSchema.parse(req.params.requestId), getAuditContext(req)));
