import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { requiredReasonSchema } from "./admin.schema";
import { adminLoanListSchema, adminLoanRequestListSchema, approveLoanRequestSchema, disburseLoanSchema, loanIdSchema, processOverdueSchema } from "../loans/loan.schema";
import { approveLoanRequest, disburseLoan, getAdminLoan, listAdminLoanRequests, listAdminLoans, markOverdueEmis, rejectLoanRequest, reviewLoanRequest } from "../loans/loan.service";

const respond = (fn: (req: AuthRequest) => Promise<unknown>) => async (req: AuthRequest, res: Response, next: NextFunction) => { try { res.json({ success: true, data: await fn(req) }); } catch (error) { next(error); } };
export const listAdminLoanRequestsController = respond(req => listAdminLoanRequests(adminLoanRequestListSchema.parse(req.query)));
export const reviewLoanRequestController = respond(req => reviewLoanRequest(BigInt(req.user!.userId), loanIdSchema.parse(req.params.requestId), getAuditContext(req)));
export const approveLoanRequestController = respond(req => approveLoanRequest(BigInt(req.user!.userId), loanIdSchema.parse(req.params.requestId), approveLoanRequestSchema.parse(req.body), getAuditContext(req)));
export const rejectLoanRequestController = respond(req => rejectLoanRequest(BigInt(req.user!.userId), loanIdSchema.parse(req.params.requestId), requiredReasonSchema.parse(req.body).reason, getAuditContext(req)));
export const disburseLoanController = respond(req => { disburseLoanSchema.parse(req.body); return disburseLoan(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId), getAuditContext(req)); });
export const listAdminLoansController = respond(req => listAdminLoans(adminLoanListSchema.parse(req.query)));
export const getAdminLoanController = respond(req => getAdminLoan(loanIdSchema.parse(req.params.loanId)));
export const processOverdueController = respond(req => markOverdueEmis(processOverdueSchema.parse(req.body).loanId));
