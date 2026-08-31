import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";

process.env.NODE_ENV = "test";
const prefix = `p4${Date.now().toString(36)}`;
const password = "Phase4@Bank123";
const customerNumber = `P4${Date.now().toString().slice(-12)}`;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
let customerId = "", customerUserId = "", customerToken = "", adminToken = "", branchId = "";
const accounts: Record<string, string> = {};
let zeroAccountNumber = "", closureRequestId = "", limitRequestId = "";

before(async () => {
  const branch = await pool.query<{ branch_id: string }>("SELECT branch_id::text FROM branches WHERE status = 'ACTIVE' ORDER BY branch_id LIMIT 1");
  branchId = branch.rows[0]!.branch_id;
  const hash = await bcrypt.hash(password, 10);
  const user = await pool.query<{ user_id: string }>(`INSERT INTO users (email,password_hash,role,status,email_verified,email_verified_at) VALUES ($1,$2,'CUSTOMER','ACTIVE',true,now()) RETURNING user_id::text`, [`${prefix}@example.com`, hash]);
  customerUserId = user.rows[0]!.user_id;
  const customer = await pool.query<{ customer_id: string }>(`INSERT INTO customers (user_id,branch_id,customer_number,first_name,last_name,email,customer_status,kyc_status) VALUES ($1,$2,$3,'Phase','Four',$4,'ACTIVE','VERIFIED') RETURNING customer_id::text`, [customerUserId, branchId, customerNumber, `${prefix}@example.com`]);
  customerId = customer.rows[0]!.customer_id;
  for (const [name, balance] of [["freeze", 1000], ["destination", 0], ["zero", 0], ["nonzero", 100], ["limit", 1000]] as const) {
    const number = `${prefix}${name}`.slice(0, 20);
    const result = await pool.query<{ account_id: string }>(`INSERT INTO accounts (account_number,customer_id,branch_id,account_type,currency,current_balance,available_balance,account_status,opened_at) VALUES ($1,$2,$3,'SAVINGS','INR',$4,$4,'ACTIVE',CURRENT_DATE) RETURNING account_id::text`, [number, customerId, branchId, balance]);
    accounts[name] = result.rows[0]!.account_id;
    if (name === "zero") zeroAccountNumber = number;
  }
  await pool.query(`INSERT INTO cards (account_id,card_reference,masked_card_number,card_type,card_status) VALUES ($1,$2,'**** **** **** 1111','DEBIT','ACTIVE'),($1,$3,'**** **** **** 2222','DEBIT','BLOCKED')`, [accounts.freeze, `${prefix}-auto`, `${prefix}-manual`]);
  await pool.query(`INSERT INTO cards (account_id,card_reference,masked_card_number,card_type,card_status) VALUES ($1,$2,'**** **** **** 3333','DEBIT','ACTIVE')`, [accounts.zero, `${prefix}-close`]);
  await pool.query(`INSERT INTO beneficiaries (customer_id,beneficiary_name,beneficiary_account_no,status) VALUES ($1,'Closure target',$2,'ACTIVE')`, [customerId, zeroAccountNumber]);
  const login = await request(app).post("/api/v1/auth/login").send({ customerId: customerNumber, password });
  assert.equal(login.status, 200); customerToken = login.body.data.token;
  const admin = await request(app).post("/api/v1/auth/login").send({ customerId: "ADMINLOCAL0001", password: "PiBank@Admin001" });
  assert.equal(admin.status, 200); adminToken = admin.body.data.token;
});

after(async () => {
  const ids = Object.values(accounts);
  await pool.query("DELETE FROM audit_logs WHERE (user_id=$1) OR (entity='ACCOUNT' AND entity_id=ANY($2::bigint[]))", [customerUserId, ids]);
  await pool.query("DELETE FROM request_status_history WHERE request_type IN ('ACCOUNT_CLOSURE','TRANSFER_LIMIT') AND request_id IN (SELECT account_closure_request_id FROM account_closure_requests WHERE customer_id=$1 UNION SELECT transfer_limit_request_id FROM transfer_limit_requests WHERE customer_id=$1)", [customerId]);
  await pool.query("DELETE FROM audit_logs WHERE entity IN ('ACCOUNT_CLOSURE_REQUEST','TRANSFER_LIMIT_REQUEST') AND entity_id IN (SELECT account_closure_request_id FROM account_closure_requests WHERE customer_id=$1 UNION SELECT transfer_limit_request_id FROM transfer_limit_requests WHERE customer_id=$1)", [customerId]);
  await pool.query("DELETE FROM account_closure_requests WHERE customer_id=$1", [customerId]);
  await pool.query("DELETE FROM transfer_limit_requests WHERE customer_id=$1", [customerId]);
  const txs = await pool.query<{ transaction_id: string }>("SELECT transaction_id::text FROM transactions WHERE source_account_id=ANY($1::bigint[]) OR destination_account_id=ANY($1::bigint[])", [ids]);
  const txIds = txs.rows.map(x => x.transaction_id);
  if (txIds.length) {
    await pool.query("DELETE FROM audit_logs WHERE entity='TRANSACTION' AND entity_id=ANY($1::bigint[])", [txIds]);
    await pool.query("DELETE FROM ledger_entries WHERE transaction_id=ANY($1::bigint[])", [txIds]);
    await pool.query("DELETE FROM transaction_details WHERE transaction_id=ANY($1::bigint[])", [txIds]);
    await pool.query("DELETE FROM transaction_status_history WHERE transaction_id=ANY($1::bigint[])", [txIds]);
    await pool.query("DELETE FROM transactions WHERE transaction_id=ANY($1::bigint[])", [txIds]);
  }
  await pool.query("DELETE FROM cards WHERE account_id=ANY($1::bigint[])", [ids]);
  await pool.query("DELETE FROM beneficiaries WHERE customer_id=$1", [customerId]);
  await pool.query("DELETE FROM accounts WHERE account_id=ANY($1::bigint[])", [ids]);
  await pool.query("DELETE FROM customers WHERE customer_id=$1", [customerId]);
  await pool.query("DELETE FROM users WHERE user_id=$1", [customerUserId]);
  await pool.end();
});

test("1. admin freezes an active account with reason and metadata", async () => {
  const res = await request(app).post(`/api/v1/admin/accounts/${accounts.freeze}/freeze`).set(auth(adminToken)).send({ reason: "Suspected account compromise" });
  assert.equal(res.status, 200); assert.equal(res.body.data.account_status, "FROZEN");
  const row = await pool.query("SELECT frozen_at,frozen_by,freeze_reason FROM accounts WHERE account_id=$1", [accounts.freeze]);
  assert.ok(row.rows[0].frozen_at); assert.ok(row.rows[0].frozen_by); assert.equal(row.rows[0].freeze_reason, "Suspected account compromise");
});

test("2. frozen account blocks new outgoing transfers", async () => {
  const res = await request(app).post("/api/v1/transfers").set(auth(customerToken)).send({ sourceAccountId: accounts.freeze, destinationAccountId: accounts.destination, amount: 10 });
  assert.equal(res.status, 409); assert.equal(res.body.error.code, "SOURCE_ACCOUNT_NOT_ACTIVE");
});

test("3. freeze provenance protects manually blocked cards", async () => {
  const rows = await pool.query("SELECT card_status,freeze_source FROM cards WHERE account_id=$1 ORDER BY card_reference", [accounts.freeze]);
  assert.deepEqual(rows.rows.map(r => [r.card_status, r.freeze_source]), [["BLOCKED", "ACCOUNT_FREEZE"], ["BLOCKED", null]]);
});

test("4. unfreeze restores only account-auto-frozen cards", async () => {
  const res = await request(app).post(`/api/v1/admin/accounts/${accounts.freeze}/unfreeze`).set(auth(adminToken)).send({ reason: "Security review completed" });
  assert.equal(res.status, 200); assert.equal(res.body.data.account_status, "ACTIVE");
  const rows = await pool.query("SELECT card_status,freeze_source FROM cards WHERE account_id=$1 ORDER BY card_reference", [accounts.freeze]);
  assert.deepEqual(rows.rows.map(r => [r.card_status, r.freeze_source]), [["ACTIVE", null], ["BLOCKED", null]]);
});

test("5. customer creates and cancels a pending closure request", async () => {
  const created = await request(app).post("/api/v1/account-closure-requests").set(auth(customerToken)).send({ accountId: accounts.zero, reason: "No longer required" });
  assert.equal(created.status, 201);
  const cancelled = await request(app).post(`/api/v1/account-closure-requests/${created.body.data.account_closure_request_id}/cancel`).set(auth(customerToken));
  assert.equal(cancelled.status, 200); assert.equal(cancelled.body.data.status, "CANCELLED");
});

test("6. non-zero account closure approval is rejected", async () => {
  const created = await request(app).post("/api/v1/account-closure-requests").set(auth(customerToken)).send({ accountId: accounts.nonzero, reason: "Close this account" });
  const id = created.body.data.account_closure_request_id;
  assert.equal((await request(app).post(`/api/v1/admin/account-closure-requests/${id}/review`).set(auth(adminToken))).status, 200);
  const approved = await request(app).post(`/api/v1/admin/account-closure-requests/${id}/approve`).set(auth(adminToken));
  assert.equal(approved.status, 409); assert.equal(approved.body.error.code, "ACCOUNT_CANNOT_CLOSE_WITH_BALANCE");
});

test("7. eligible closure closes account/cards and disables matching beneficiaries", async () => {
  const created = await request(app).post("/api/v1/account-closure-requests").set(auth(customerToken)).send({ accountId: accounts.zero, reason: "Customer requested closure" });
  closureRequestId = created.body.data.account_closure_request_id;
  await request(app).post(`/api/v1/admin/account-closure-requests/${closureRequestId}/review`).set(auth(adminToken));
  const approved = await request(app).post(`/api/v1/admin/account-closure-requests/${closureRequestId}/approve`).set(auth(adminToken));
  assert.equal(approved.status, 200); assert.equal(approved.body.data.status, "APPROVED");
  const state = await pool.query("SELECT (SELECT account_status FROM accounts WHERE account_id=$1) account_status,(SELECT card_status FROM cards WHERE account_id=$1) card_status,(SELECT status FROM beneficiaries WHERE customer_id=$2 AND beneficiary_account_no=$3) beneficiary_status", [accounts.zero, customerId, zeroAccountNumber]);
  assert.deepEqual(state.rows[0], { account_status: "CLOSED", card_status: "CLOSED", beneficiary_status: "INACTIVE" });
});

test("8. approved transfer limits apply immediately", async () => {
  const created = await request(app).post("/api/v1/transfer-limit-requests").set(auth(customerToken)).send({ accountId: accounts.limit, requestedPerTransactionLimit: 500, requestedDailyTransferLimit: 800, reason: "Adjust online transfer limits" });
  limitRequestId = created.body.data.transfer_limit_request_id;
  await request(app).post(`/api/v1/admin/transfer-limit-requests/${limitRequestId}/review`).set(auth(adminToken));
  assert.equal((await request(app).post(`/api/v1/admin/transfer-limit-requests/${limitRequestId}/approve`).set(auth(adminToken))).status, 200);
  const blocked = await request(app).post("/api/v1/transfers").set(auth(customerToken)).send({ sourceAccountId: accounts.limit, destinationAccountId: accounts.destination, amount: 600 });
  assert.equal(blocked.status, 409); assert.equal(blocked.body.error.code, "TRANSFER_PER_TRANSACTION_LIMIT_EXCEEDED");
});

test("9. admin can reduce but cannot directly increase limits", async () => {
  const reduced = await request(app).post(`/api/v1/admin/accounts/${accounts.limit}/limits/reduce`).set(auth(adminToken)).send({ perTransactionLimit: 300, dailyTransferLimit: 700, reason: "Risk control reduction" });
  assert.equal(reduced.status, 200); assert.equal(Number(reduced.body.data.per_transaction_limit), 300);
  const increase = await request(app).post(`/api/v1/admin/accounts/${accounts.limit}/limits/reduce`).set(auth(adminToken)).send({ perTransactionLimit: 400, reason: "Attempted direct increase" });
  assert.equal(increase.status, 409); assert.equal(increase.body.error.code, "DIRECT_LIMIT_INCREASE_NOT_ALLOWED");
});

test("10. existing transfer and ledger flow remains balanced", async () => {
  const transfer = await request(app).post("/api/v1/transfers").set(auth(customerToken)).send({ sourceAccountId: accounts.limit, destinationAccountId: accounts.destination, amount: 100, remarks: "Phase 4 regression" });
  assert.equal(transfer.status, 201);
  const ledger = await pool.query("SELECT entry_type,amount::text FROM ledger_entries WHERE transaction_id=$1 ORDER BY entry_type", [transfer.body.data.transaction_id]);
  assert.equal(ledger.rowCount, 2); assert.equal(ledger.rows[0].amount, ledger.rows[1].amount); assert.deepEqual(ledger.rows.map(r => r.entry_type).sort(), ["CREDIT", "DEBIT"]);
  assert.equal((await request(app).get("/api/v1/accounts").set(auth(customerToken))).status, 200);
  assert.equal((await request(app).get("/api/v1/transactions").set(auth(customerToken))).status, 200);
});
