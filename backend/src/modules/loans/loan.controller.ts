import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { autoDebitSchema, createLoanRequestSchema, forecloseLoanSchema, loanIdSchema, loanListSchema, loanPreviewSchema, payEmiSchema, prepayLoanSchema } from "./loan.schema";
import { cancelLoanRequest, configureAutoDebit, createLoanRequest, forecloseLoan, getForeclosureQuote, getLoan, listEmis, listLoanRequests, listLoans, payEmi, prepayLoan, previewLoan } from "./loan.service";

const respond = (fn: (req: AuthRequest) => Promise<unknown>, status = 200) => async (req: AuthRequest, res: Response, next: NextFunction) => { try { res.status(status).json({ success: true, data: await fn(req) }); } catch (error) { next(error); } };
export const createLoanRequestController = respond(req => createLoanRequest(BigInt(req.user!.userId), createLoanRequestSchema.parse(req.body), getAuditContext(req)), 201);
export const previewLoanController = respond(req => { const input = loanPreviewSchema.parse(req.query); return Promise.resolve(previewLoan(input.requestedAmount, input.durationMonths)); });
export const listLoanRequestsController = respond(req => listLoanRequests(BigInt(req.user!.userId), loanListSchema.parse(req.query)));
export const cancelLoanRequestController = respond(req => cancelLoanRequest(BigInt(req.user!.userId), loanIdSchema.parse(req.params.requestId), getAuditContext(req)));
export const listLoansController = respond(req => listLoans(BigInt(req.user!.userId), loanListSchema.parse(req.query)));
export const getLoanController = respond(req => getLoan(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId)));
export const listEmisController = respond(req => listEmis(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId)));
export const payEmiController = respond(req => { const body = payEmiSchema.parse(req.body); return payEmi(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId), loanIdSchema.parse(req.params.emiId), body.sourceAccountId, getAuditContext(req)); }, 201);
export const prepayLoanController = respond(req => { const body = prepayLoanSchema.parse(req.body); return prepayLoan(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId), body.sourceAccountId, body.amount, getAuditContext(req)); }, 201);
export const forecloseLoanController = respond(req => { const body = forecloseLoanSchema.parse(req.body); return forecloseLoan(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId), body.sourceAccountId, getAuditContext(req)); }, 201);
export const foreclosureQuoteController = respond(req => getForeclosureQuote(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId)));
export const configureAutoDebitController = respond(req => { const body = autoDebitSchema.parse(req.body); return configureAutoDebit(BigInt(req.user!.userId), loanIdSchema.parse(req.params.loanId), body.enabled, body.accountId, getAuditContext(req)); });
