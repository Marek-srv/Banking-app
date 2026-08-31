import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";
import { cleanupTestData } from "./test-helpers";

process.env.NODE_ENV = "test";

const prefix = `phase3${Date.now().toString(36)}`;
const customerNumber = `T${Date.now().toString().slice(-12)}`;
const password = "AccountRequest@123";
let customerId = "";
let branchId = "";
let customerToken = "";
let adminToken = "";
let savingsRequestId = "";
let cancelledRequestId = "";
let approvedAccountId = "";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const requestBody = (accountType: "SAVINGS" | "CURRENT", subtype: string) => ({
  accountType,
  accountSubtype: subtype,
  preferredBranchId: branchId,
  purpose: "Focused Phase 3 account request",
  requestedPerTransactionLimit: 50000,
  requestedDailyTransferLimit: 150000,
  notes: "Customer requested account",
});

before(async () => {
  const branch = await pool.query<{ branch_id: string }>(
    "SELECT branch_id::text FROM branches WHERE branch_code = 'DIGITAL001' AND status = 'ACTIVE'"
  );
  assert.equal(branch.rowCount, 1);
  branchId = branch.rows[0]!.branch_id;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await pool.query<{ user_id: string }>(
    `INSERT INTO users (email, password_hash, role, status, email_verified, email_verified_at)
     VALUES ($1, $2, 'CUSTOMER', 'ACTIVE', true, now()) RETURNING user_id::text`,
    [`${prefix}@example.com`, passwordHash]
  );
  const customer = await pool.query<{ customer_id: string }>(
    `INSERT INTO customers (
       user_id, branch_id, customer_number, first_name, last_name,
       date_of_birth, phone, email, customer_status, kyc_status, kyc_verified_at
     ) VALUES ($1, $2, $3, 'Account', 'Requester', '1990-01-01', '9234567891', $4, 'ACTIVE', 'VERIFIED', now())
     RETURNING customer_id::text`,
    [user.rows[0]!.user_id, branchId, customerNumber, `${prefix}@example.com`]
  );
  customerId = customer.rows[0]!.customer_id;

  const customerLogin = await request(app).post("/api/v1/auth/login").send({ customerId: customerNumber, password });
  assert.equal(customerLogin.status, 200);
  customerToken = customerLogin.body.data.token as string;

  const adminLogin = await request(app).post("/api/v1/auth/login").send({ customerId: "ADMINLOCAL0001", password: "PiBank@Admin001" });
  assert.equal(adminLogin.status, 200);
  adminToken = adminLogin.body.data.token as string;
});

after(async () => {
  await cleanupTestData(prefix);
  await pool.end();
});

test("1. active KYC-verified customer creates a savings request", async () => {
  const response = await request(app)
    .post("/api/v1/account-requests")
    .set(auth(customerToken))
    .send(requestBody("SAVINGS", "REGULAR"));
  assert.equal(response.status, 201);
  assert.equal(response.body.data.status, "PENDING");
  assert.equal(response.body.data.account_type, "SAVINGS");
  savingsRequestId = response.body.data.account_request_id as string;
  assert.ok(savingsRequestId);
});

test("2. pending request can be edited by its customer", async () => {
  const response = await request(app)
    .patch(`/api/v1/account-requests/${savingsRequestId}`)
    .set(auth(customerToken))
    .send({ notes: "Updated customer note", requestedDailyTransferLimit: 175000 });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.notes, "Updated customer note");
  assert.equal(Number(response.body.data.requested_daily_transfer_limit), 175000);
});

test("3. pending request can be cancelled and remains in history", async () => {
  const created = await request(app)
    .post("/api/v1/account-requests")
    .set(auth(customerToken))
    .send(requestBody("CURRENT", "BUSINESS"));
  assert.equal(created.status, 201);
  cancelledRequestId = created.body.data.account_request_id as string;

  const cancelled = await request(app)
    .post(`/api/v1/account-requests/${cancelledRequestId}/cancel`)
    .set(auth(customerToken))
    .send({});
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.data.status, "CANCELLED");

  const history = await request(app).get("/api/v1/account-requests").set(auth(customerToken));
  assert.equal(history.status, 200);
  assert.ok(history.body.data.some((item: any) => item.account_request_id === cancelledRequestId && item.status === "CANCELLED"));
});

test("4. admin moves pending request to under review", async () => {
  const list = await request(app)
    .get(`/api/v1/admin/account-requests?status=PENDING&customerId=${customerId}&accountType=SAVINGS`)
    .set(auth(adminToken));
  assert.equal(list.status, 200);
  assert.ok(list.body.data.some((item: any) => item.account_request_id === savingsRequestId));

  const response = await request(app)
    .post(`/api/v1/admin/account-requests/${savingsRequestId}/review`)
    .set(auth(adminToken))
    .send({});
  assert.equal(response.status, 200);
  assert.equal(response.body.data.status, "UNDER_REVIEW");
});

test("5. under-review request cannot be edited or cancelled", async () => {
  const edited = await request(app)
    .patch(`/api/v1/account-requests/${savingsRequestId}`)
    .set(auth(customerToken))
    .send({ notes: "Must not change" });
  assert.equal(edited.status, 409);
  assert.equal(edited.body.error.code, "ACCOUNT_REQUEST_NOT_EDITABLE");

  const cancelled = await request(app)
    .post(`/api/v1/account-requests/${savingsRequestId}/cancel`)
    .set(auth(customerToken))
    .send({});
  assert.equal(cancelled.status, 409);
  assert.equal(cancelled.body.error.code, "ACCOUNT_REQUEST_NOT_CANCELLABLE");
});

test("6. admin approves request and creates the account atomically", async () => {
  const response = await request(app)
    .post(`/api/v1/admin/account-requests/${savingsRequestId}/approve`)
    .set(auth(adminToken))
    .send({
      approvedBranchId: branchId,
      approvedPerTransactionLimit: 60000,
      approvedDailyTransferLimit: 180000,
      adminNote: "Approved after review",
    });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.request.status, "APPROVED");
  approvedAccountId = response.body.data.account.account_id as string;
  assert.equal(response.body.data.request.approved_account_id, approvedAccountId);
});

test("7. approved account starts at zero with approved immutable details", async () => {
  const result = await pool.query<{
    account_type: string;
    account_subtype: string;
    branch_id: string;
    ifsc_code: string;
    current_balance: string;
    available_balance: string;
    per_transaction_limit: string;
    daily_transfer_limit: string;
  }>(
    `SELECT account_type::text, account_subtype, branch_id::text, ifsc_code,
            current_balance::text, available_balance::text,
            per_transaction_limit::text, daily_transfer_limit::text
     FROM accounts WHERE account_id = $1`,
    [approvedAccountId]
  );
  assert.equal(result.rowCount, 1);
  assert.equal(result.rows[0]?.account_type, "SAVINGS");
  assert.equal(result.rows[0]?.account_subtype, "REGULAR");
  assert.equal(result.rows[0]?.branch_id, branchId);
  assert.match(result.rows[0]?.ifsc_code ?? "", /^PIBK[A-Z0-9]+$/);
  assert.equal(Number(result.rows[0]?.current_balance), 0);
  assert.equal(Number(result.rows[0]?.available_balance), 0);
  assert.equal(Number(result.rows[0]?.per_transaction_limit), 60000);
  assert.equal(Number(result.rows[0]?.daily_transfer_limit), 180000);
});

test("8. admin rejects another request with a reason", async () => {
  const created = await request(app)
    .post("/api/v1/account-requests")
    .set(auth(customerToken))
    .send(requestBody("CURRENT", "BUSINESS"));
  assert.equal(created.status, 201);
  const requestId = created.body.data.account_request_id as string;

  const rejected = await request(app)
    .post(`/api/v1/admin/account-requests/${requestId}/reject`)
    .set(auth(adminToken))
    .send({ reason: "Requested product is not suitable" });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.data.status, "REJECTED");
  assert.equal(rejected.body.data.rejection_reason, "Requested product is not suitable");
});

test("9. savings account-count limit blocks excess requests", async () => {
  for (let index = 0; index < 2; index += 1) {
    await pool.query(
      `INSERT INTO accounts (
         account_number, customer_id, branch_id, account_type, currency,
         current_balance, available_balance, account_status, opened_at
       ) VALUES ($1, $2, $3, 'SAVINGS', 'INR', 0, 0, 'ACTIVE', CURRENT_DATE)`,
      [`LIM${Date.now().toString().slice(-12)}${index}`, customerId, branchId]
    );
  }
  const response = await request(app)
    .post("/api/v1/account-requests")
    .set(auth(customerToken))
    .send(requestBody("SAVINGS", "EXCESS"));
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "ACCOUNT_LIMIT_REACHED");
});

test("10. existing login, accounts, transactions, and ledger integrity remain valid", async () => {
  const login = await request(app).post("/api/v1/auth/login").send({ customerId: customerNumber, password });
  assert.equal(login.status, 200);
  const token = login.body.data.token as string;
  for (const path of ["accounts", "transactions"]) {
    const response = await request(app).get(`/api/v1/${path}`).set(auth(token));
    assert.equal(response.status, 200, path);
  }
  const invalidLedger = await pool.query(
    `SELECT 1 FROM ledger_entries
     WHERE amount <= 0 OR entry_type NOT IN ('DEBIT', 'CREDIT')
        OR (entry_type = 'DEBIT' AND balance_after <> balance_before - amount)
        OR (entry_type = 'CREDIT' AND balance_after <> balance_before + amount)
     LIMIT 1`
  );
  assert.equal(invalidLedger.rowCount, 0);
});
