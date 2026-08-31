import { Router } from "express";
import { approveCardRequestController, listAdminCardRequestsController, rejectCardRequestController, reviewCardRequestController } from "../cards/card-request.controller";
import {
  authenticate,
  authorizeRoles,
} from "../../middleware/auth.middleware";
import {
  createAdminEmployeeController,
  createAtmController,
  createBranchController,
  closeAccountController,
  freezeAccountController,
  getAdminCustomerController,
  getAdminDashboardController,
  getAdminAccountController,
  getAdminTransactionController,
  listAdminAccountsController,
  listAdminAtmsController,
  listAdminAuditLogsController,
  listAdminBranchesController,
  listAdminCardsController,
  listAdminCustomersController,
  listAdminEmployeesController,
  listAdminTransactionsController,
  unfreezeAccountController,
  updateCustomerStatusController,
  updateAtmController,
  updateAtmStatusController,
  updateBranchController,
  updateBranchManagerController,
  updateBranchStatusController,
  updateEmployeeController,
  updateEmployeeStatusController,
  updateCustomerKycStatusController,
  approveCustomerController,
  rejectCustomerController,
  blockCustomerController,
  unblockCustomerController,
  listAdminAccountRequestsController,
  startAccountRequestReviewController,
  approveAccountRequestController,
  rejectAccountRequestController,
  createExceptionalAdminAccountController,
  listClosureRequestsAdminController,
  reviewClosureRequestController,
  approveClosureRequestController,
  rejectClosureRequestController,
  listTransferLimitRequestsAdminController,
  reviewTransferLimitRequestController,
  approveTransferLimitRequestController,
  rejectTransferLimitRequestController,
  reduceAccountLimitsController,
} from "./admin.controller";
import { approveLoanRequestController, disburseLoanController, getAdminLoanController, listAdminLoanRequestsController, listAdminLoansController, processOverdueController, rejectLoanRequestController, reviewLoanRequestController } from "./loan-admin.controller";

const router = Router();

router.use(authenticate, authorizeRoles("ADMIN"));
router.get("/dashboard", getAdminDashboardController);
router.get("/employees", listAdminEmployeesController);
router.post("/employees", createAdminEmployeeController);
router.patch("/employees/:employeeId", updateEmployeeController);
router.patch("/employees/:employeeId/status", updateEmployeeStatusController);
router.patch("/customers/:customerId/status", updateCustomerStatusController);
router.patch("/customers/:customerId/kyc", updateCustomerKycStatusController);
router.post("/customers/:customerId/approve", approveCustomerController);
router.post("/customers/:customerId/reject", rejectCustomerController);
router.post("/customers/:customerId/block", blockCustomerController);
router.post("/customers/:customerId/unblock", unblockCustomerController);
router.post("/customers/:customerId/accounts", createExceptionalAdminAccountController);
router.get("/account-requests", listAdminAccountRequestsController);
router.post("/account-requests/:requestId/review", startAccountRequestReviewController);
router.post("/account-requests/:requestId/approve", approveAccountRequestController);
router.post("/account-requests/:requestId/reject", rejectAccountRequestController);
router.patch("/accounts/:accountId/freeze", freezeAccountController);
router.patch("/accounts/:accountId/unfreeze", unfreezeAccountController);
router.post("/accounts/:accountId/freeze", freezeAccountController);
router.post("/accounts/:accountId/unfreeze", unfreezeAccountController);
router.post("/accounts/:accountId/limits/reduce", reduceAccountLimitsController);
router.get("/account-closure-requests", listClosureRequestsAdminController);
router.post("/account-closure-requests/:requestId/review", reviewClosureRequestController);
router.post("/account-closure-requests/:requestId/approve", approveClosureRequestController);
router.post("/account-closure-requests/:requestId/reject", rejectClosureRequestController);
router.get("/transfer-limit-requests", listTransferLimitRequestsAdminController);
router.post("/transfer-limit-requests/:requestId/review", reviewTransferLimitRequestController);
router.post("/transfer-limit-requests/:requestId/approve", approveTransferLimitRequestController);
router.post("/transfer-limit-requests/:requestId/reject", rejectTransferLimitRequestController);
router.get("/customers", listAdminCustomersController);
router.get("/customers/:customerId", getAdminCustomerController);
router.get("/accounts", listAdminAccountsController);
router.get("/accounts/:accountId", getAdminAccountController);
router.patch("/accounts/:accountId/close", closeAccountController);
router.get("/transactions", listAdminTransactionsController);
router.get("/transactions/:transactionId", getAdminTransactionController);
router.get("/branches", listAdminBranchesController);
router.post("/branches", createBranchController);
router.patch("/branches/:branchId", updateBranchController);
router.patch("/branches/:branchId/manager", updateBranchManagerController);
router.patch("/branches/:branchId/status", updateBranchStatusController);
router.get("/atms", listAdminAtmsController);
router.post("/atms", createAtmController);
router.patch("/atms/:atmId", updateAtmController);
router.patch("/atms/:atmId/status", updateAtmStatusController);
router.get("/cards", listAdminCardsController);
router.get("/card-requests", listAdminCardRequestsController);
router.post("/card-requests/:requestId/review", reviewCardRequestController);
router.post("/card-requests/:requestId/approve", approveCardRequestController);
router.post("/card-requests/:requestId/reject", rejectCardRequestController);
router.get("/audit-logs", listAdminAuditLogsController);
router.get("/loan-requests", listAdminLoanRequestsController);
router.post("/loan-requests/:requestId/review", reviewLoanRequestController);
router.post("/loan-requests/:requestId/approve", approveLoanRequestController);
router.post("/loan-requests/:requestId/reject", rejectLoanRequestController);
router.get("/loans", listAdminLoansController);
router.get("/loans/:loanId", getAdminLoanController);
router.post("/loans/:loanId/disburse", disburseLoanController);
router.post("/loans/process-overdue", processOverdueController);

export default router;
