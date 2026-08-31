import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("1 account opening uses request API and not direct account creation",async()=>{const [page,api]=await Promise.all([read("src/pages/accounts-page.tsx"),read("src/api/customerServicingApi.ts")]);assert.match(page,/Request New Account/);assert.match(api,/post\('\/account-requests'/);assert.doesNotMatch(page,/accountApi\.createAccount/)});
test("2 pending account requests support edit and cancel",async()=>{const s=await read("src/pages/accounts-page.tsx");assert.match(s,/updateAccountRequest/);assert.match(s,/cancelAccountRequest/);assert.match(s,/>Edit</)});
test("3 closure request and warning are wired",async()=>{const s=await read("src/pages/accounts-page.tsx");assert.match(s,/createClosureRequest/);assert.match(s,/non-zero balance or active obligations/)});
test("4 transfer-limit requests show backend limits and history",async()=>{const s=await read("src/pages/accounts-page.tsx");assert.match(s,/createLimitRequest/);assert.match(s,/perTransactionLimit/);assert.match(s,/Transfer Limits/)});
test("5 loan request and pending cancellation are wired",async()=>{const s=await read("src/pages/loans-page.tsx");assert.match(s,/createRequest/);assert.match(s,/cancelRequest/);assert.match(s,/Loan Request History/)});
test("6 loan list and protected detail routes exist",async()=>{const [app,page]=await Promise.all([read("src/app.tsx"),read("src/pages/loans-page.tsx")]);assert.match(app,/path="\/loans"/);assert.match(app,/path="\/loans\/:id"/);assert.match(page,/outstanding_principal/)});
test("7 EMI schedule and owned-account payment are wired",async()=>{const s=await read("src/pages/loan-details-page.tsx");assert.match(s,/EMI Schedule/);assert.match(s,/payEmi/);assert.match(s,/sourceAccountId/)});
test("8 auto-debit and prepayment actions are wired",async()=>{const s=await read("src/pages/loan-details-page.tsx");assert.match(s,/autoDebit/);assert.match(s,/prepay/);assert.match(s,/invalidateQueries/)});
test("9 foreclosure uses a backend quote before execution",async()=>{const [front,back]=await Promise.all([read("src/api/loanApi.ts"),read("../backend/src/modules/loans/loan.routes.ts")]);assert.match(front,/foreclosureQuote/);assert.match(front,/foreclose:/);assert.match(back,/foreclosure-quote/)});
test("10 sidebar navigation and existing protected routes remain present",async()=>{const [side,app]=await Promise.all([read("src/components/dashboard/dashboard-sidebar.tsx"),read("src/app.tsx")]);assert.match(side,/label: "Loans"/);for(const route of ["dashboard","accounts","transfer","transactions","beneficiaries","cards","settings"])assert.match(app,new RegExp(`/${route}`))});
