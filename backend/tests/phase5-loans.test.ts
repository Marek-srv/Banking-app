import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";

process.env.NODE_ENV = "test";
const prefix = `p5${Date.now().toString(36)}`;
const password = "Phase5@Loan123";
const customerNumber = `P5${Date.now().toString().slice(-12)}`;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let userId = "", customerId = "", branchId = "", operatingAccountId = "", customerToken = "", adminToken = "", requestId = "", loanId = "", loanAccountId = "", firstEmiId = "", secondEmiId = "";

before(async () => {
  const branch = await pool.query<{ branch_id: string }>("SELECT branch_id::text FROM branches WHERE status='ACTIVE' ORDER BY branch_id LIMIT 1"); branchId = branch.rows[0]!.branch_id;
  const hash = await bcrypt.hash(password, 10);
  const user = await pool.query<{ user_id: string }>("INSERT INTO users(email,password_hash,role,status,email_verified,email_verified_at) VALUES($1,$2,'CUSTOMER','ACTIVE',true,now()) RETURNING user_id::text", [`${prefix}@example.com`, hash]); userId = user.rows[0]!.user_id;
  const customer = await pool.query<{ customer_id: string }>("INSERT INTO customers(user_id,branch_id,customer_number,first_name,last_name,email,customer_status,kyc_status,kyc_verified_at) VALUES($1,$2,$3,'Loan','Customer',$4,'ACTIVE','VERIFIED',now()) RETURNING customer_id::text", [userId, branchId, customerNumber, `${prefix}@example.com`]); customerId = customer.rows[0]!.customer_id;
  const account = await pool.query<{ account_id: string }>("INSERT INTO accounts(account_number,customer_id,branch_id,account_type,currency,current_balance,available_balance,account_status,opened_at) VALUES($1,$2,$3,'SAVINGS','INR',50000,50000,'ACTIVE',CURRENT_DATE) RETURNING account_id::text", [`${prefix}operating`.slice(0,20), customerId, branchId]); operatingAccountId = account.rows[0]!.account_id;
  const login = await request(app).post("/api/v1/auth/login").send({ customerId: customerNumber, password }); assert.equal(login.status, 200); customerToken = login.body.data.token;
  const admin = await request(app).post("/api/v1/auth/login").send({ customerId: "ADMINLOCAL0001", password: "PiBank@Admin001" }); assert.equal(admin.status, 200); adminToken = admin.body.data.token;
});

after(async () => {
  const transactions = await pool.query<{ transaction_id: string }>("SELECT transaction_id::text FROM transactions WHERE source_account_id=$1 OR destination_account_id=$1", [operatingAccountId]); const txIds = transactions.rows.map(row => row.transaction_id);
  await pool.query("DELETE FROM audit_logs WHERE user_id=$1 OR (entity='LOAN' AND entity_id=$2) OR (entity='LOAN_REQUEST' AND entity_id=$3)", [userId, loanId || null, requestId || null]);
  if (requestId) await pool.query("DELETE FROM request_status_history WHERE request_type='LOAN' AND request_id=$1", [requestId]);
  if (loanId) await pool.query("DELETE FROM loan_emi_schedules WHERE loan_id=$1", [loanId]);
  if (loanId) await pool.query("DELETE FROM loans WHERE loan_id=$1", [loanId]);
  if (txIds.length) { await pool.query("DELETE FROM ledger_entries WHERE transaction_id=ANY($1::bigint[])", [txIds]); await pool.query("DELETE FROM transaction_details WHERE transaction_id=ANY($1::bigint[])", [txIds]); await pool.query("DELETE FROM transaction_status_history WHERE transaction_id=ANY($1::bigint[])", [txIds]); await pool.query("DELETE FROM transactions WHERE transaction_id=ANY($1::bigint[])", [txIds]); }
  if (requestId) await pool.query("DELETE FROM loan_requests WHERE loan_request_id=$1", [requestId]);
  const accountIds = [operatingAccountId, loanAccountId].filter(Boolean); if (accountIds.length) await pool.query("DELETE FROM accounts WHERE account_id=ANY($1::bigint[])", [accountIds]);
  await pool.query("DELETE FROM customers WHERE customer_id=$1", [customerId]); await pool.query("DELETE FROM users WHERE user_id=$1", [userId]); await pool.end();
});

test("1. ACTIVE KYC-verified customer creates loan request", async () => {
  const response = await request(app).post("/api/v1/loan-requests").set(auth(customerToken)).send({ requestedAmount: 12000, durationMonths: 3, loanType: "PERSONAL", loanSubtype: "UNSECURED_PERSONAL", purpose: "Focused Phase 5 test loan" });
  assert.equal(response.status, 201); assert.equal(response.body.data.status, "PENDING"); requestId = response.body.data.loan_request_id;
});

test("2. admin moves request to UNDER_REVIEW", async () => {
  const response = await request(app).post(`/api/v1/admin/loan-requests/${requestId}/review`).set(auth(adminToken)); assert.equal(response.status, 200); assert.equal(response.body.data.status, "UNDER_REVIEW");
});

test("3. approval creates Loan and zero-balance account without moving money", async () => {
  const before = await pool.query("SELECT current_balance::text FROM accounts WHERE account_id=$1", [operatingAccountId]);
  const response = await request(app).post(`/api/v1/admin/loan-requests/${requestId}/approve`).set(auth(adminToken)).send({ approvedAmount: 12000, approvedDurationMonths: 3, approvedInterestRate: 12, adminNote: "Approved for focused testing" });
  assert.equal(response.status, 200); loanId = response.body.data.loan.loan_id; loanAccountId = response.body.data.loanAccount.account_id; assert.equal(response.body.data.loan.status, "APPROVED");
  const state = await pool.query("SELECT current_balance::text,(SELECT count(*)::int FROM loan_emi_schedules WHERE loan_id=$2) schedule_count FROM accounts WHERE account_id=$1", [loanAccountId, loanId]); assert.equal(Number(state.rows[0].current_balance), 0); assert.equal(state.rows[0].schedule_count, 0);
  const afterBalance = await pool.query("SELECT current_balance::text FROM accounts WHERE account_id=$1", [operatingAccountId]); assert.equal(afterBalance.rows[0].current_balance, before.rows[0].current_balance);
});

test("4. disbursement credits ledger and activates loan", async () => {
  const response = await request(app).post(`/api/v1/admin/loans/${loanId}/disburse`).set(auth(adminToken)).send({ destinationAccountId: operatingAccountId }); assert.equal(response.status, 200); assert.equal(response.body.data.loan.status, "ACTIVE");
  const ledger = await pool.query("SELECT entry_type,amount::text FROM ledger_entries WHERE transaction_id=$1", [response.body.data.transaction.transaction_id]); assert.deepEqual(ledger.rows, [{ entry_type: "CREDIT", amount: "12000.0000" }]);
});

test("5. reducing-balance EMI schedule reconciles principal", async () => {
  const rows = await pool.query("SELECT emi_schedule_id::text,installment_number,principal_component::text,interest_component::text,total_emi::text FROM loan_emi_schedules WHERE loan_id=$1 ORDER BY installment_number", [loanId]); assert.equal(rows.rowCount, 3); firstEmiId = rows.rows[0].emi_schedule_id; secondEmiId = rows.rows[1].emi_schedule_id;
  const principal = rows.rows.reduce((sum, row) => sum + Number(row.principal_component), 0); assert.ok(Math.abs(principal - 12000) < 0.0001); assert.ok(rows.rows.every(row => Number(row.interest_component) >= 0 && Number(row.total_emi) > 0));
});

test("6. manual EMI payment updates installment and principal", async () => {
  const before = await pool.query("SELECT outstanding_principal::text FROM loans WHERE loan_id=$1", [loanId]); const component = await pool.query("SELECT principal_component::text FROM loan_emi_schedules WHERE emi_schedule_id=$1", [firstEmiId]);
  const response = await request(app).post(`/api/v1/loans/${loanId}/emis/${firstEmiId}/pay`).set(auth(customerToken)).send({ sourceAccountId: operatingAccountId }); assert.equal(response.status, 201);
  const state = await pool.query("SELECT e.status,e.transaction_id::text,l.outstanding_principal::text FROM loan_emi_schedules e JOIN loans l ON l.loan_id=e.loan_id WHERE e.emi_schedule_id=$1", [firstEmiId]); assert.equal(state.rows[0].status, "PAID"); assert.ok(state.rows[0].transaction_id); assert.ok(Math.abs(Number(state.rows[0].outstanding_principal) - (Number(before.rows[0].outstanding_principal) - Number(component.rows[0].principal_component))) < 0.0001);
});

test("7. same loan cannot be disbursed twice", async () => {
  const response = await request(app).post(`/api/v1/admin/loans/${loanId}/disburse`).set(auth(adminToken)).send({ destinationAccountId: operatingAccountId }); assert.equal(response.status, 409); assert.equal(response.body.error.code, "LOAN_NOT_DISBURSABLE");
});

test("8. overdue processing applies one configured late fee", async () => {
  await pool.query("UPDATE loan_emi_schedules SET due_date=CURRENT_DATE-1 WHERE emi_schedule_id=$1", [secondEmiId]);
  const response = await request(app).post("/api/v1/admin/loans/process-overdue").set(auth(adminToken)).send({ loanId }); assert.equal(response.status, 200); assert.equal(response.body.data.markedOverdue, 1);
  const state = await pool.query("SELECT e.status,e.late_fee::text,l.status loan_status FROM loan_emi_schedules e JOIN loans l ON l.loan_id=e.loan_id WHERE e.emi_schedule_id=$1", [secondEmiId]); assert.equal(state.rows[0].status, "OVERDUE"); assert.equal(Number(state.rows[0].late_fee), 500); assert.equal(state.rows[0].loan_status, "OVERDUE");
});

test("9. partial prepayment reduces principal and recalculates future EMI", async () => {
  const before = await pool.query("SELECT outstanding_principal::text,emi_amount::text FROM loans WHERE loan_id=$1", [loanId]);
  const response = await request(app).post(`/api/v1/loans/${loanId}/prepay`).set(auth(customerToken)).send({ sourceAccountId: operatingAccountId, amount: 1000 }); assert.equal(response.status, 201);
  const afterState = await pool.query("SELECT outstanding_principal::text,emi_amount::text FROM loans WHERE loan_id=$1", [loanId]); assert.equal(Number(afterState.rows[0].outstanding_principal), Number(before.rows[0].outstanding_principal) - 1000); assert.notEqual(afterState.rows[0].emi_amount, before.rows[0].emi_amount);
});

test("10. foreclosure settles obligation and preserves history", async () => {
  const response = await request(app).post(`/api/v1/loans/${loanId}/foreclose`).set(auth(customerToken)).send({ sourceAccountId: operatingAccountId }); assert.equal(response.status, 201);
  const loan = await pool.query("SELECT status,outstanding_principal::text,(SELECT account_status FROM accounts WHERE account_id=l.account_id) account_status FROM loans l WHERE loan_id=$1", [loanId]); assert.deepEqual(loan.rows[0], { status: "FORECLOSED", outstanding_principal: "0.0000", account_status: "CLOSED" });
  const history = await pool.query("SELECT status,count(*)::int count FROM loan_emi_schedules WHERE loan_id=$1 GROUP BY status", [loanId]); assert.ok(history.rows.some(row => row.status === "PAID")); assert.ok(history.rows.some(row => row.status === "CANCELLED"));
  const financial = await pool.query("SELECT count(*)::int count FROM transactions WHERE source_account_id=$1 OR destination_account_id=$1", [operatingAccountId]); assert.equal(financial.rows[0].count, 4);
});
