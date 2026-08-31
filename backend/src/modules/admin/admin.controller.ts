import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
  getAdminCustomer,
  getAdminDashboard,
  getAdminAccount,
  getAdminTransaction,
  closeAccount,
  createAdminAtm,
  createAdminBranch,
  listAdminAccounts,
  listAdminAtms,
  listAdminAuditLogs,
  listAdminBranches,
  listAdminCards,
  listAdminCustomers,
  listAdminEmployees,
  listAdminTransactions,
  setAtmStatus,
  setBranchManager,
  setBranchStatus,
  updateAdminAtm,
  updateAdminBranch,
  updateAdminEmployee,
} from "./admin.service";
import {
  PaginationInput,
  paginationQuerySchema,
} from "../../schemas/pagination.schema";
import {
  adminEntityIdSchema,
  adminListQuerySchema,
  adminAccountRequestListSchema,
  approveAccountRequestSchema,
  atmStatusSchema,
  branchManagerSchema,
  branchStatusSchema,
  createAtmSchema,
  createBranchSchema,
  createEmployeeSchema,
  customerStatusSchema,
  customerKycStatusSchema,
  employeeStatusSchema,
  requiredReasonSchema,
  directAccountCreationSchema,
  updateAtmSchema,
  updateBranchSchema,
  updateEmployeeSchema,
  adminServicingListSchema,
  directLimitReductionSchema,
} from "./admin.schema";
import {
  createAdminEmployee,
  freezeAccount,
  unfreezeAccount,
  updateCustomerStatus,
  updateEmployeeStatus,
  updateCustomerKycStatus,
  approveCustomer,
  rejectCustomer,
  blockCustomer,
  unblockCustomer,
} from "./admin.service";
import { getAuditContext } from "../../middleware/audit.middleware";
import {
  approveAccountRequest,
  createExceptionalAdminAccount,
  listAdminAccountRequests,
  rejectAccountRequest,
  startAccountRequestReview,
} from "./account-request-admin.service";
import {
  approveClosureRequest,
  approveTransferLimitRequest,
  listAdminClosureRequests,
  listAdminTransferLimitRequests,
  reduceAccountLimits,
  rejectServicingRequest,
  startServicingReview,
} from "./account-servicing-admin.service";

export async function listClosureRequestsAdminController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await listAdminClosureRequests(adminServicingListSchema.parse(req.query)) }); } catch (error) { next(error); }
}
export async function reviewClosureRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await startServicingReview("closure", adminEntityIdSchema.parse(req.params.requestId), BigInt(req.user!.userId), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function approveClosureRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await approveClosureRequest(adminEntityIdSchema.parse(req.params.requestId), BigInt(req.user!.userId), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function rejectClosureRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { reason } = requiredReasonSchema.parse(req.body); res.json({ success: true, data: await rejectServicingRequest("closure", adminEntityIdSchema.parse(req.params.requestId), BigInt(req.user!.userId), reason, getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function listTransferLimitRequestsAdminController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await listAdminTransferLimitRequests(adminServicingListSchema.parse(req.query)) }); } catch (error) { next(error); }
}
export async function reviewTransferLimitRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await startServicingReview("limit", adminEntityIdSchema.parse(req.params.requestId), BigInt(req.user!.userId), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function approveTransferLimitRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await approveTransferLimitRequest(adminEntityIdSchema.parse(req.params.requestId), BigInt(req.user!.userId), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function rejectTransferLimitRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { reason } = requiredReasonSchema.parse(req.body); res.json({ success: true, data: await rejectServicingRequest("limit", adminEntityIdSchema.parse(req.params.requestId), BigInt(req.user!.userId), reason, getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function reduceAccountLimitsController(req: AuthRequest, res: Response, next: NextFunction) {
  try { res.json({ success: true, data: await reduceAccountLimits(adminEntityIdSchema.parse(req.params.accountId), BigInt(req.user!.userId), directLimitReductionSchema.parse(req.body), getAuditContext(req)) }); } catch (error) { next(error); }
}

async function respondWithAdminList<T>(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  list: (input: ReturnType<typeof adminListQuerySchema.parse>) => Promise<T>
) {
  try {
    const pagination = adminListQuerySchema.parse(req.query);
    return res.json({ success: true, data: await list(pagination) });
  } catch (error) {
    next(error);
  }
}

export async function getAdminDashboardController(_req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.json({ success: true, data: await getAdminDashboard() }); } catch (error) { next(error); }
}

export async function getAdminCustomerController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.json({ success: true, data: await getAdminCustomer(adminEntityIdSchema.parse(req.params.customerId)) }); } catch (error) { next(error); }
}

export async function listAdminAccountRequestsController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await listAdminAccountRequests(adminAccountRequestListSchema.parse(req.query));
    return res.json({ success: true, data: result.items, pagination: result.pagination });
  } catch (error) { next(error); }
}

export async function startAccountRequestReviewController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await startAccountRequestReview(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.requestId), getAuditContext(req));
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function approveAccountRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await approveAccountRequest(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.requestId), approveAccountRequestSchema.parse(req.body), getAuditContext(req));
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function rejectAccountRequestController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { reason } = requiredReasonSchema.parse(req.body);
    const result = await rejectAccountRequest(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.requestId), reason, getAuditContext(req));
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function createExceptionalAdminAccountController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await createExceptionalAdminAccount(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.customerId), directAccountCreationSchema.parse(req.body), getAuditContext(req));
    return res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
}

export async function getAdminTransactionController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.json({ success: true, data: await getAdminTransaction(adminEntityIdSchema.parse(req.params.transactionId)) }); } catch (error) { next(error); }
}

export async function getAdminAccountController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.json({ success: true, data: await getAdminAccount(adminEntityIdSchema.parse(req.params.accountId)) }); } catch (error) { next(error); }
}

export async function closeAccountController(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { reason } = requiredReasonSchema.parse(req.body); return res.json({ success: true, data: await closeAccount(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.accountId), reason, getAuditContext(req)) }); } catch (error) { next(error); }
}

export async function createBranchController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.status(201).json({ success: true, data: await createAdminBranch(BigInt(req.user!.userId), createBranchSchema.parse(req.body), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function updateBranchController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.json({ success: true, data: await updateAdminBranch(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.branchId), updateBranchSchema.parse(req.body), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function updateBranchManagerController(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { managerId } = branchManagerSchema.parse(req.body); return res.json({ success: true, data: await setBranchManager(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.branchId), managerId, getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function updateBranchStatusController(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { status } = branchStatusSchema.parse(req.body); return res.json({ success: true, data: await setBranchStatus(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.branchId), status, getAuditContext(req)) }); } catch (error) { next(error); }
}

export async function createAtmController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.status(201).json({ success: true, data: await createAdminAtm(BigInt(req.user!.userId), createAtmSchema.parse(req.body), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function updateAtmController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.json({ success: true, data: await updateAdminAtm(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.atmId), updateAtmSchema.parse(req.body), getAuditContext(req)) }); } catch (error) { next(error); }
}
export async function updateAtmStatusController(req: AuthRequest, res: Response, next: NextFunction) {
  try { const { status } = atmStatusSchema.parse(req.body); return res.json({ success: true, data: await setAtmStatus(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.atmId), status, getAuditContext(req)) }); } catch (error) { next(error); }
}

export async function updateEmployeeController(req: AuthRequest, res: Response, next: NextFunction) {
  try { return res.json({ success: true, data: await updateAdminEmployee(BigInt(req.user!.userId), adminEntityIdSchema.parse(req.params.employeeId), updateEmployeeSchema.parse(req.body), getAuditContext(req)) }); } catch (error) { next(error); }
}

export function listAdminCustomersController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  return respondWithAdminList(req, res, next, listAdminCustomers);
}

export function listAdminAccountsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  return respondWithAdminList(req, res, next, listAdminAccounts);
}

export function listAdminTransactionsController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  return respondWithAdminList(req, res, next, listAdminTransactions);
}

export function listAdminEmployeesController(req: AuthRequest, res: Response, next: NextFunction) { return respondWithAdminList(req, res, next, listAdminEmployees); }
export function listAdminBranchesController(req: AuthRequest, res: Response, next: NextFunction) { return respondWithAdminList(req, res, next, listAdminBranches); }
export function listAdminAtmsController(req: AuthRequest, res: Response, next: NextFunction) { return respondWithAdminList(req, res, next, listAdminAtms); }
export function listAdminCardsController(req: AuthRequest, res: Response, next: NextFunction) { return respondWithAdminList(req, res, next, listAdminCards); }
export function listAdminAuditLogsController(req: AuthRequest, res: Response, next: NextFunction) { return respondWithAdminList(req, res, next, listAdminAuditLogs); }

export async function createAdminEmployeeController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createEmployeeSchema.parse(req.body);
    const employee = await createAdminEmployee(
      BigInt(req.user!.userId),
      input,
      getAuditContext(req)
    );
    return res.status(201).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployeeStatusController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const employeeId = adminEntityIdSchema.parse(req.params.employeeId);
    const { status } = employeeStatusSchema.parse(req.body);
    const employee = await updateEmployeeStatus(
      BigInt(req.user!.userId),
      employeeId,
      status,
      getAuditContext(req)
    );
    return res.json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerStatusController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const customerId = adminEntityIdSchema.parse(req.params.customerId);
    const { status } = customerStatusSchema.parse(req.body);
    const customer = await updateCustomerStatus(
      BigInt(req.user!.userId),
      customerId,
      status,
      getAuditContext(req)
    );
    return res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function updateCustomerKycStatusController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const customerId = adminEntityIdSchema.parse(req.params.customerId);
    const { status, reason } = customerKycStatusSchema.parse(req.body);
    const customer = await updateCustomerKycStatus(
      BigInt(req.user!.userId),
      customerId,
      status,
      reason,
      getAuditContext(req)
    );
    return res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function approveCustomerController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const customer = await approveCustomer(
      BigInt(req.user!.userId),
      adminEntityIdSchema.parse(req.params.customerId),
      getAuditContext(req)
    );
    return res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function rejectCustomerController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { reason } = requiredReasonSchema.parse(req.body);
    const customer = await rejectCustomer(
      BigInt(req.user!.userId),
      adminEntityIdSchema.parse(req.params.customerId),
      reason,
      getAuditContext(req)
    );
    return res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function blockCustomerController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const { reason } = requiredReasonSchema.parse(req.body);
    const customer = await blockCustomer(
      BigInt(req.user!.userId),
      adminEntityIdSchema.parse(req.params.customerId),
      reason,
      getAuditContext(req)
    );
    return res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function unblockCustomerController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const customer = await unblockCustomer(
      BigInt(req.user!.userId),
      adminEntityIdSchema.parse(req.params.customerId),
      getAuditContext(req)
    );
    return res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

async function changeAccountFrozenState(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  frozen: boolean
) {
  try {
    const accountId = adminEntityIdSchema.parse(req.params.accountId);
    const { reason } = requiredReasonSchema.parse(req.body);
    const account = await (frozen ? freezeAccount : unfreezeAccount)(
      BigInt(req.user!.userId),
      accountId,
      reason,
      getAuditContext(req)
    );
    return res.json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
}

export function freezeAccountController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  return changeAccountFrozenState(req, res, next, true);
}

export function unfreezeAccountController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  return changeAccountFrozenState(req, res, next, false);
}
