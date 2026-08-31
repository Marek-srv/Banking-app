import assert from "node:assert/strict";
import test, { after } from "node:test";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";

const stamp = Date.now().toString(36).toUpperCase();
const password = "Focused@Test123";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const results: Array<Record<string, unknown>> = [];

after(async () => {
  await pool.end();
});

async function createCustomer(index: number, branchId: string) {
  const email = `focused.loan.${stamp}.${index}@example.com`;
  const customerNumber = `FLT${stamp}${index}`.slice(0, 30);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await pool.query<{ user_id: string }>(
    `INSERT INTO users(email,password_hash,role,status,email_verified,email_verified_at)
     VALUES($1,$2,'CUSTOMER','ACTIVE',true,now()) RETURNING user_id::text`,
    [email, passwordHash],
  );
  const customer = await pool.query<{ customer_id: string }>(
    `INSERT INTO customers(user_id,branch_id,customer_number,first_name,last_name,email,phone,date_of_birth,customer_status,kyc_status,kyc_verified_at)
     VALUES($1,$2,$3,'Focused',$4,$5,$6,'1990-01-01','ACTIVE','VERIFIED',now()) RETURNING customer_id::text`,
    [user.rows[0]!.user_id, branchId, customerNumber, `Customer ${index}`, email, `98${String(Date.now()).slice(-7)}${index}`.slice(0, 10)],
  );
  const operatingAccounts: Record<"SAVINGS" | "CURRENT", string> = { SAVINGS: "", CURRENT: "" };
  for (const type of ["SAVINGS", "CURRENT"] as const) {
    const account = await pool.query<{ account_id: string }>(
      `INSERT INTO accounts(account_number,customer_id,branch_id,account_type,currency,current_balance,available_balance,account_status,opened_at)
       VALUES($1,$2,$3,$4,'INR',0,0,'ACTIVE',CURRENT_DATE) RETURNING account_id::text`,
      [`F${index}${type[0]}${stamp}`.slice(0, 20), customer.rows[0]!.customer_id, branchId, type],
    );
    operatingAccounts[type] = account.rows[0]!.account_id;
  }
  const login = await request(app).post("/api/v1/auth/login").send({ customerId: customerNumber, password });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const token = login.body.data.token as string;
  for (const accountId of Object.values(operatingAccounts)) {
    const deposit = await request(app).post("/api/v1/transactions/deposit").set(auth(token)).send({ accountId, amount: 800000 });
    assert.equal(deposit.status, 201, JSON.stringify(deposit.body));
  }
  return { customerId: customer.rows[0]!.customer_id, customerNumber, token, accounts: operatingAccounts };
}

async function createApproveAndDisburseLoan(
  token: string,
  adminToken: string,
  requestedAmount: number,
  durationMonths: number,
) {
  const created = await request(app).post("/api/v1/loan-requests").set(auth(token)).send({
    loanType: "PERSONAL",
    loanSubtype: "UNSECURED_PERSONAL",
    requestedAmount,
    durationMonths,
    purpose: `Focused ${durationMonths}-month loan verification`,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const requestId = String(created.body.data.loan_request_id);
  const review = await request(app).post(`/api/v1/admin/loan-requests/${requestId}/review`).set(auth(adminToken));
  assert.equal(review.status, 200, JSON.stringify(review.body));
  const approval = await request(app).post(`/api/v1/admin/loan-requests/${requestId}/approve`).set(auth(adminToken)).send({ approvedAmount: requestedAmount, approvedDurationMonths: durationMonths });
  assert.equal(approval.status, 200, JSON.stringify(approval.body));
  const loanId = String(approval.body.data.loan.loan_id);
  const loanAccountId = String(approval.body.data.loanAccount.account_id);
  assert.equal(Number(approval.body.data.loan.interest_rate), durationMonths <= 12 ? 10.5 : durationMonths <= 24 ? 11 : durationMonths <= 36 ? 11.5 : durationMonths <= 48 ? 12 : 12.5);
  assert.equal(Number(approval.body.data.loanAccount.current_balance), 0);
  const disbursement = await request(app).post(`/api/v1/admin/loans/${loanId}/disburse`).set(auth(adminToken)).send({});
  assert.equal(disbursement.status, 200, JSON.stringify(disbursement.body));
  const duplicateDisbursement = await request(app).post(`/api/v1/admin/loans/${loanId}/disburse`).set(auth(adminToken)).send({});
  assert.equal(duplicateDisbursement.status, 409);
  const state = await pool.query<{
    outstanding_principal: string; current_balance: string; available_balance: string;
    account_status: string; loan_status: string; relation_count: number; emi_count: number;
  }>(
    `SELECT l.outstanding_principal::text,a.current_balance::text,a.available_balance::text,
            a.account_status,l.status::text loan_status,
            (SELECT count(*)::int FROM loans x WHERE x.account_id=a.account_id) relation_count,
            (SELECT count(*)::int FROM loan_emi_schedules e WHERE e.loan_id=l.loan_id) emi_count
     FROM loans l JOIN accounts a ON a.account_id=l.account_id WHERE l.loan_id=$1`,
    [loanId],
  );
  assert.equal(Number(state.rows[0]!.outstanding_principal), requestedAmount);
  assert.equal(state.rows[0]!.current_balance, state.rows[0]!.outstanding_principal);
  assert.equal(Number(state.rows[0]!.available_balance), 0);
  assert.equal(state.rows[0]!.account_status, "ACTIVE");
  assert.equal(state.rows[0]!.loan_status, "ACTIVE");
  assert.equal(state.rows[0]!.relation_count, 1);
  assert.equal(state.rows[0]!.emi_count, durationMonths);
  return { requestId, loanId, loanAccountId };
}

async function verifySynced(loanId: string) {
  const state = await pool.query<{ outstanding: string; balance: string; available: string }>(
    `SELECT l.outstanding_principal::text outstanding,a.current_balance::text balance,a.available_balance::text available
     FROM loans l JOIN accounts a ON a.account_id=l.account_id WHERE l.loan_id=$1`,
    [loanId],
  );
  assert.equal(state.rows[0]!.balance, state.rows[0]!.outstanding);
  assert.equal(Number(state.rows[0]!.available), 0);
  return Number(state.rows[0]!.outstanding);
}

test("exactly five focused loan liability and card request scenarios", { timeout: 120_000 }, async () => {
  const branch = await pool.query<{ branch_id: string }>("SELECT branch_id::text FROM branches WHERE status='ACTIVE' ORDER BY branch_id LIMIT 1");
  assert.ok(branch.rows[0], "An active branch is required");
  const adminLogin = await request(app).post("/api/v1/auth/login").send({ customerId: "ADMINLOCAL0001", password: "PiBank@Admin001" });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));
  const adminToken = adminLogin.body.data.token as string;
  const scenarios = [
    { amount: 100000, months: 12, rate: 10.5 },
    { amount: 200000, months: 24, rate: 11 },
    { amount: 300000, months: 36, rate: 11.5 },
    { amount: 400000, months: 48, rate: 12 },
    { amount: 500000, months: 60, rate: 12.5 },
  ];
  const customers = [];
  for (let index = 1; index <= 5; index += 1) customers.push(await createCustomer(index, branch.rows[0]!.branch_id));
  const createdCount = await pool.query<{ count: number }>("SELECT count(*)::int count FROM customers WHERE email LIKE $1", [`focused.loan.${stamp}.%@example.com`]);
  assert.equal(createdCount.rows[0]!.count, 5);

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index]!;
    const customer = customers[index]!;
    const loan = await createApproveAndDisburseLoan(customer.token, adminToken, scenario.amount, scenario.months);
    let expectedOutstanding = scenario.amount;
    let cardResult = "";

    if (index === 0) {
      const cardRequest = await request(app).post("/api/v1/card-requests").set(auth(customer.token)).send({ accountId: customer.accounts.SAVINGS, cardType: "DEBIT" });
      assert.equal(cardRequest.status, 201);
      const cardRequestId = String(cardRequest.body.data.card_request_id);
      assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/review`).set(auth(adminToken))).status, 200);
      assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/approve`).set(auth(adminToken))).status, 200);
      assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/approve`).set(auth(adminToken))).status, 409);
      const cards = await pool.query<{ count: number }>("SELECT count(*)::int count FROM cards WHERE account_id=$1", [customer.accounts.SAVINGS]);
      assert.equal(cards.rows[0]!.count, 1);
      cardResult = "SAVINGS request approved; exactly one card created";
    } else if (index === 1 || index === 3) {
      const emis = await pool.query<{ emi_schedule_id: string; principal_component: string }>("SELECT emi_schedule_id::text,principal_component::text FROM loan_emi_schedules WHERE loan_id=$1 ORDER BY installment_number LIMIT 1", [loan.loanId]);
      const sourceId = index === 1 ? customer.accounts.SAVINGS : customer.accounts.CURRENT;
      const payment = await request(app).post(`/api/v1/loans/${loan.loanId}/emis/${emis.rows[0]!.emi_schedule_id}/pay`).set(auth(customer.token)).send({ sourceAccountId: sourceId });
      assert.equal(payment.status, 201, JSON.stringify(payment.body));
      expectedOutstanding -= Number(emis.rows[0]!.principal_component);
      if (index === 1) {
        const cardRequest = await request(app).post("/api/v1/card-requests").set(auth(customer.token)).send({ accountId: customer.accounts.CURRENT, cardType: "DEBIT" });
        assert.equal(cardRequest.status, 201);
        const cardRequestId = String(cardRequest.body.data.card_request_id);
        assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/review`).set(auth(adminToken))).status, 200);
        assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/approve`).set(auth(adminToken))).status, 200);
        cardResult = "CURRENT request approved; exactly one card created";
      } else {
        const cardRequest = await request(app).post("/api/v1/card-requests").set(auth(customer.token)).send({ accountId: customer.accounts.CURRENT, cardType: "DEBIT" });
        assert.equal(cardRequest.status, 201);
        assert.equal((await request(app).post(`/api/v1/card-requests/${cardRequest.body.data.card_request_id}/cancel`).set(auth(customer.token))).status, 200);
        const cards = await pool.query<{ count: number }>("SELECT count(*)::int count FROM cards WHERE account_id=$1", [customer.accounts.CURRENT]);
        assert.equal(cards.rows[0]!.count, 0);
        cardResult = "PENDING request cancelled; no card created";
      }
    } else if (index === 2) {
      const prepayment = await request(app).post(`/api/v1/loans/${loan.loanId}/prepay`).set(auth(customer.token)).send({ sourceAccountId: customer.accounts.SAVINGS, amount: 25000 });
      assert.equal(prepayment.status, 201, JSON.stringify(prepayment.body));
      expectedOutstanding -= 25000;
      const cardRequest = await request(app).post("/api/v1/card-requests").set(auth(customer.token)).send({ accountId: customer.accounts.SAVINGS, cardType: "DEBIT" });
      assert.equal(cardRequest.status, 201);
      const cardRequestId = String(cardRequest.body.data.card_request_id);
      assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/review`).set(auth(adminToken))).status, 200);
      assert.equal((await request(app).post(`/api/v1/admin/card-requests/${cardRequestId}/reject`).set(auth(adminToken)).send({ reason: "Focused rejection verification" })).status, 200);
      const cards = await pool.query<{ count: number }>("SELECT count(*)::int count FROM cards WHERE account_id=$1", [customer.accounts.SAVINGS]);
      assert.equal(cards.rows[0]!.count, 0);
      cardResult = "Request rejected; no card created";
    } else {
      const loanCard = await request(app).post("/api/v1/card-requests").set(auth(customer.token)).send({ accountId: loan.loanAccountId, cardType: "DEBIT" });
      assert.equal(loanCard.status, 409);
      const foreclosure = await request(app).post(`/api/v1/loans/${loan.loanId}/foreclose`).set(auth(customer.token)).send({ sourceAccountId: customer.accounts.SAVINGS });
      assert.equal(foreclosure.status, 201, JSON.stringify(foreclosure.body));
      expectedOutstanding = 0;
      const closed = await pool.query<{ loan_status: string; account_status: string; balance: string }>("SELECT l.status::text loan_status,a.account_status,a.current_balance::text balance FROM loans l JOIN accounts a ON a.account_id=l.account_id WHERE l.loan_id=$1", [loan.loanId]);
      assert.deepEqual(closed.rows[0], { loan_status: "FORECLOSED", account_status: "CLOSED", balance: "0.0000" });
      cardResult = "LOAN account request rejected; no card created";
    }

    const actualOutstanding = await verifySynced(loan.loanId);
    assert.ok(Math.abs(actualOutstanding - expectedOutstanding) < 0.0001);
    results.push({ customer: index + 1, principal: scenario.amount, months: scenario.months, rate: scenario.rate, outstanding: actualOutstanding, card: cardResult });
  }

  const loanCards = await pool.query<{ count: number }>("SELECT count(*)::int count FROM cards c JOIN accounts a ON a.account_id=c.account_id WHERE a.account_type='LOAN'");
  assert.equal(loanCards.rows[0]!.count, 0);
  const customerIds = customers.map((customer) => customer.customerId);
  const mismatches = await pool.query<{ count: number }>("SELECT count(*)::int count FROM loans l JOIN accounts a ON a.account_id=l.account_id WHERE l.customer_id=ANY($1::bigint[]) AND l.outstanding_principal<>a.current_balance", [customerIds]);
  assert.equal(mismatches.rows[0]!.count, 0);
  const badLedger = await pool.query<{ count: number }>(
    `SELECT count(*)::int count FROM ledger_entries e JOIN accounts a ON a.account_id=e.account_id
     WHERE a.customer_id=ANY($1::bigint[]) AND (amount<=0 OR entry_type NOT IN ('DEBIT','CREDIT') OR
       balance_after <> CASE WHEN entry_type='DEBIT' THEN balance_before-amount ELSE balance_before+amount END)`,
    [customerIds],
  );
  assert.equal(badLedger.rows[0]!.count, 0);
  const loanIncomePollution = await pool.query<{ count: number }>(
    `SELECT count(*)::int count FROM transactions t JOIN accounts a ON a.account_id=t.destination_account_id
     WHERE a.customer_id=ANY($1::bigint[]) AND t.transaction_type='LOAN_DISBURSEMENT' AND a.account_type IN ('SAVINGS','CURRENT')`,
    [customerIds],
  );
  assert.equal(loanIncomePollution.rows[0]!.count, 0);
  console.log(JSON.stringify({ focusedResults: results }, null, 2));
});
