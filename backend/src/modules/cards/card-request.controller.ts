import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { cardRequestIdSchema, cardRequestListSchema, createCardRequestSchema, rejectCardRequestSchema } from "./card-request.schema";
import { approveCardRequest, cancelCardRequest, createCardRequest, listAdminCardRequests, listCustomerCardRequests, rejectCardRequest, reviewCardRequest } from "./card-request.service";

const respond = (fn: (req: AuthRequest) => Promise<unknown>, status = 200) => async (req: AuthRequest, res: Response, next: NextFunction) => { try { res.status(status).json({ success: true, data: await fn(req) }); } catch (error) { next(error); } };
export const createCardRequestController = respond(req => createCardRequest(BigInt(req.user!.userId), createCardRequestSchema.parse(req.body), getAuditContext(req)), 201);
export const listCustomerCardRequestsController = respond(req => listCustomerCardRequests(BigInt(req.user!.userId), cardRequestListSchema.parse(req.query)));
export const cancelCardRequestController = respond(req => cancelCardRequest(BigInt(req.user!.userId), cardRequestIdSchema.parse(req.params.requestId), getAuditContext(req)));
export const listAdminCardRequestsController = respond(req => listAdminCardRequests(cardRequestListSchema.parse(req.query)));
export const reviewCardRequestController = respond(req => reviewCardRequest(BigInt(req.user!.userId), cardRequestIdSchema.parse(req.params.requestId), getAuditContext(req)));
export const approveCardRequestController = respond(req => approveCardRequest(BigInt(req.user!.userId), cardRequestIdSchema.parse(req.params.requestId), getAuditContext(req)));
export const rejectCardRequestController = respond(req => rejectCardRequest(BigInt(req.user!.userId), cardRequestIdSchema.parse(req.params.requestId), rejectCardRequestSchema.parse(req.body).reason, getAuditContext(req)));
