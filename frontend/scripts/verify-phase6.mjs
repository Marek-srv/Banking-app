import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("1. dashboard wires Phase 6 metrics and pending navigation", async () => { const source=await read("src/pages/admin-dashboard-page.tsx"); for(const value of ["activeLoans","pendingCustomerApprovals","pendingAccountRequests","pendingLoanRequests","pendingClosureRequests","<Link"]) assert.match(source,new RegExp(value)); });
test("2. customer approval and rejection are available from Customers UI", async () => { const source=await read("src/pages/admin-customers-page.tsx"); assert.match(source,/approveCustomer/); assert.match(source,/rejectCustomer/); });
test("3. KYC verified and rejected actions are wired", async () => { const source=await read("src/pages/admin-customers-page.tsx"); assert.match(source,/updateCustomerKyc/); assert.match(source,/kyc-rejected/); });
test("4. account request review and approval are wired", async () => { const source=await read("src/pages/admin-account-requests-page.tsx"); assert.match(source,/reviewAccountRequest/); assert.match(source,/approveAccountRequest/); });
test("5. freeze and unfreeze require the shared action dialog", async () => { const source=await read("src/pages/admin-accounts-page.tsx"); assert.match(source,/freezeAccount\(id,v.reason\)/); assert.match(source,/unfreezeAccount\(id,v.reason\)/); });
test("6. closure review, approval and rejection are wired", async () => { const source=await read("src/pages/admin-accounts-page.tsx"); for(const value of ["reviewClosureRequest","approveClosureRequest","rejectClosureRequest"]) assert.match(source,new RegExp(value)); });
test("7. transfer-limit review and approval are wired", async () => { const source=await read("src/pages/admin-accounts-page.tsx"); assert.match(source,/reviewLimitRequest/); assert.match(source,/approveLimitRequest/); assert.match(source,/reduceLimits/); });
test("8. loan request review and approval are wired", async () => { const source=await read("src/pages/admin-loan-requests-page.tsx"); assert.match(source,/reviewLoanRequest/); assert.match(source,/approveLoanRequest/); });
test("9. loan disbursement and EMI detail schedule are wired", async () => { const source=await read("src/pages/admin-loans-page.tsx"); assert.match(source,/disburseLoan/); assert.match(source,/emi_schedules/); });
test("10. protected sidebar and direct routes cover every Phase 6 page", async () => { const [app,layout,guard]=await Promise.all([read("src/app.tsx"),read("src/components/admin/admin-layout.tsx"),read("src/routes/admin-route.tsx")]); for(const path of ["/admin/customers","/admin/account-requests","/admin/accounts","/admin/loan-requests","/admin/loans"]) { assert.match(app,new RegExp(path)); assert.match(layout,new RegExp(path)); } assert.match(guard,/hasHydrated/); assert.match(guard,/user\?\.role !== "ADMIN"/); });
