import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after } from "node:test";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";
import {
  accountBalances,
  cleanupTestData,
  completeTestRegistration,
  createTestBranch,
  transactionLedger,
} from "./test-helpers";
import { queryAssistant } from "../src/modules/assistant/assistant.service";

process.env.NODE_ENV = "test";

after(async () => {
  await pool.end();
});

const prefix = `v1${Date.now().toString(36)}`;
const password = "StrongPassword123!";

interface UserContext {
  email: string;
  token: string;
  userId: string;
  customerId: string;
  customerNumber: string;
  accountId?: string;
}

const auth = (context: UserContext) => ({
  Authorization: `Bearer ${context.token}`,
});

async function registerAndLogin(
  email: string,
  _branchId: string,
  role?: "ADMIN" | "EMPLOYEE"
) {
  const completed = await completeTestRegistration(email, password);
  const normalizedEmail = completed.normalizedEmail;

  if (role) {
    await pool.query("UPDATE users SET role = $1 WHERE email = $2", [
      role,
      normalizedEmail,
    ]);
  }

  const loggedIn = await request(app)
    .post("/api/v1/auth/login")
    .send({ customerId: ` ${completed.customerNumber.toLowerCase()} `, password });
  assert.equal(loggedIn.status, 200);
  const profile = await request(app)
    .get("/api/v1/customers/me")
    .set("Authorization", `Bearer ${loggedIn.body.data.token}`);
  assert.equal(profile.status, 200);

  return {
    email: normalizedEmail,
    token: loggedIn.body.data.token as string,
    userId: loggedIn.body.data.user.userId as string,
    customerId: profile.body.data.customer_id as string,
    customerNumber: completed.customerNumber,
  } satisfies UserContext;
}

async function addCustomerAndAccount(
  context: UserContext,
  branchId: string,
  _firstName: string
) {
  assert.ok(context.customerId);

  const account = await pool.query<{ account_id: string }>(
    `INSERT INTO accounts (
       account_number, customer_id, branch_id, account_type,
       currency, current_balance, available_balance, account_status, opened_at
     ) VALUES ($1, $2, $3, 'SAVINGS', 'INR', 0, 0, 'ACTIVE', CURRENT_DATE)
     RETURNING account_id::text`,
    [`TST${randomBytes(8).toString("hex").toUpperCase()}`, context.customerId, branchId]
  );
  context.accountId = account.rows[0]!.account_id;
}

async function addAccountFixture(
  context: UserContext,
  branchId: string,
  accountType: "SAVINGS" | "CURRENT"
) {
  const account = await pool.query<{ account_id: string }>(
    `INSERT INTO accounts (
       account_number, customer_id, branch_id, account_type,
       currency, current_balance, available_balance, account_status, opened_at
     ) VALUES ($1, $2, $3, $4, 'INR', 0, 0, 'ACTIVE', CURRENT_DATE)
     RETURNING account_id::text`,
    [
      `TST${randomBytes(8).toString("hex").toUpperCase()}`,
      context.customerId,
      branchId,
      accountType,
    ]
  );
  return account.rows[0]!.account_id;
}

test("Banking Backend V1 critical flows", async () => {
  const branchId = await createTestBranch(prefix);

  try {
    const owner = await registerAndLogin(`${prefix}.Owner@Example.com`, branchId);
    const destination = await registerAndLogin(`${prefix}.destination@example.com`, branchId);
    const other = await registerAndLogin(`${prefix}.other@example.com`, branchId);
    const admin = await registerAndLogin(`${prefix}.admin@example.com`, branchId, "ADMIN");

    assert.equal(owner.email, `${prefix}.owner@example.com`);

    await addCustomerAndAccount(owner, branchId, "Owner");
    await addCustomerAndAccount(destination, branchId, "Destination");
    await addCustomerAndAccount(other, branchId, "Other");

    assert.ok(owner.accountId && destination.accountId && other.accountId);

    const ownerProfile = await request(app)
      .get("/api/v1/customers/me")
      .set(auth(owner));
    const otherProfile = await request(app)
      .get("/api/v1/customers/me")
      .set(auth(other));
    assert.equal(ownerProfile.status, 200);
    assert.notEqual(ownerProfile.body.data.customer_id, otherProfile.body.data.customer_id);

    const unknownCustomerLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ customerId: `${prefix}-UNKNOWN`, password });
    const wrongPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ customerId: owner.customerNumber, password: "WrongPassword123!" });
    const legacyEmailLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: owner.email, password });
    assert.equal(unknownCustomerLogin.status, 401);
    assert.equal(wrongPasswordLogin.status, 401);
    assert.equal(legacyEmailLogin.status, 400);
    assert.equal(unknownCustomerLogin.body.error.code, "INVALID_CREDENTIALS");
    assert.equal(wrongPasswordLogin.body.error.code, "INVALID_CREDENTIALS");
    assert.equal(
      unknownCustomerLogin.body.error.message,
      wrongPasswordLogin.body.error.message
    );
    const ownerLastLogin = await pool.query<{ last_login_at: Date | null }>(
      "SELECT last_login_at FROM users WHERE user_id = $1",
      [owner.userId]
    );
    assert.ok(ownerLastLogin.rows[0]?.last_login_at);

    const unauthorizedAccount = await request(app)
      .get(`/api/v1/accounts/${owner.accountId}`)
      .set(auth(other));
    assert.equal(unauthorizedAccount.status, 404);

    const beneficiary = await request(app)
      .post("/api/v1/beneficiaries")
      .set(auth(owner))
      .send({
        beneficiaryName: "Owned Beneficiary",
        beneficiaryAccountNo: "100000000001",
        bankName: "Local Bank",
        bankCode: "LOCAL001",
      });
    assert.equal(beneficiary.status, 201);
    const unauthorizedBeneficiaryDelete = await request(app)
      .delete(`/api/v1/beneficiaries/${beneficiary.body.data.beneficiary_id}`)
      .set(auth(other));
    assert.equal(unauthorizedBeneficiaryDelete.status, 404);

    await pool.query(
      `INSERT INTO cards (
         account_id, card_reference, masked_card_number, card_type, card_status
       ) VALUES ($1, $2, '**** **** **** 4242', 'DEBIT', 'ACTIVE')`,
      [owner.accountId, `CARD-TEST-${randomBytes(6).toString("hex").toUpperCase()}`]
    );
    const dashboardCards = await request(app)
      .get("/api/v1/cards")
      .set(auth(owner));
    assert.equal(dashboardCards.status, 200);
    assert.equal(dashboardCards.body.data[0].accountId, owner.accountId);

    const depositKey = `${prefix}-deposit-key`;
    const deposit = await request(app)
      .post("/api/v1/transactions/deposit")
      .set(auth(owner))
      .set("Idempotency-Key", depositKey)
      .send({ accountId: owner.accountId, amount: 1000 });
    const depositRetry = await request(app)
      .post("/api/v1/transactions/deposit")
      .set(auth(owner))
      .set("Idempotency-Key", depositKey)
      .send({ accountId: owner.accountId, amount: 1000 });
    assert.equal(deposit.status, 201);
    assert.equal(depositRetry.status, 201);
    assert.equal(depositRetry.body.data.transaction_id, deposit.body.data.transaction_id);
    assert.equal((await accountBalances(owner.accountId)).current_balance, "1000.0000");

    const reusedKey = await request(app)
      .post("/api/v1/transactions/deposit")
      .set(auth(owner))
      .set("Idempotency-Key", depositKey)
      .send({ accountId: owner.accountId, amount: 999 });
    assert.equal(reusedKey.status, 409);
    assert.equal(reusedKey.body.error.code, "IDEMPOTENCY_KEY_REUSED");

    const withdrawal = await request(app)
      .post("/api/v1/transactions/withdraw")
      .set(auth(owner))
      .send({ accountId: owner.accountId, amount: 200 });
    assert.equal(withdrawal.status, 201);
    assert.equal((await accountBalances(owner.accountId)).current_balance, "800.0000");

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dateOnly = (value: Date) => value.toISOString().slice(0, 10);
    const statementCsv = await request(app)
      .get(`/api/v1/accounts/${owner.accountId}/statement`)
      .query({ from: dateOnly(yesterday), to: dateOnly(today), format: "csv" })
      .set(auth(owner));
    assert.equal(statementCsv.status, 200);
    assert.match(statementCsv.headers["content-type"], /^text\/csv/);
    assert.match(statementCsv.headers["content-disposition"], /pi-bank-statement-/);
    assert.match(statementCsv.text, /Opening Balance/);
    assert.match(statementCsv.text, /Closing Balance/);
    assert.match(statementCsv.text, /INR 800\.00/);
    assert.match(statementCsv.text, /Deposit/);
    assert.match(statementCsv.text, /Withdrawal/);

    const statementPdf = await request(app)
      .get(`/api/v1/accounts/${owner.accountId}/statement`)
      .query({ from: dateOnly(yesterday), to: dateOnly(today), format: "pdf" })
      .set(auth(owner));
    assert.equal(statementPdf.status, 200);
    assert.match(statementPdf.headers["content-type"], /^application\/pdf/);
    assert.equal(Buffer.from(statementPdf.body).subarray(0, 4).toString(), "%PDF");

    const unauthorizedStatement = await request(app)
      .get(`/api/v1/accounts/${owner.accountId}/statement`)
      .query({ from: dateOnly(yesterday), to: dateOnly(today), format: "csv" })
      .set(auth(other));
    assert.equal(unauthorizedStatement.status, 404);

    const invalidStatementRange = await request(app)
      .get(`/api/v1/accounts/${owner.accountId}/statement`)
      .query({ from: dateOnly(today), to: dateOnly(yesterday), format: "pdf" })
      .set(auth(owner));
    assert.equal(invalidStatementRange.status, 400);

    const receipt = await request(app)
      .get(`/api/v1/transactions/${deposit.body.data.transaction_id}/receipt`)
      .set(auth(owner));
    assert.equal(receipt.status, 200);
    assert.match(receipt.headers["content-type"], /^application\/pdf/);
    assert.match(receipt.headers["content-disposition"], /pi-bank-transaction-/);
    assert.equal(Buffer.from(receipt.body).subarray(0, 4).toString(), "%PDF");

    const unauthorizedReceipt = await request(app)
      .get(`/api/v1/transactions/${deposit.body.data.transaction_id}/receipt`)
      .set(auth(other));
    assert.equal(unauthorizedReceipt.status, 404);

    const insufficient = await request(app)
      .post("/api/v1/transactions/withdraw")
      .set(auth(owner))
      .send({ accountId: owner.accountId, amount: 999 });
    assert.equal(insufficient.status, 409);
    assert.equal(insufficient.body.error.code, "INSUFFICIENT_FUNDS");

    const sameAccount = await request(app)
      .post("/api/v1/transfers")
      .set(auth(owner))
      .send({
        sourceAccountId: owner.accountId,
        destinationAccountId: owner.accountId,
        amount: 1,
      });
    assert.equal(sameAccount.status, 400);

    const unauthorizedSource = await request(app)
      .post("/api/v1/transfers")
      .set(auth(other))
      .send({
        sourceAccountId: owner.accountId,
        destinationAccountId: other.accountId,
        amount: 1,
      });
    assert.equal(unauthorizedSource.status, 403);

    const transfer = await request(app)
      .post("/api/v1/transfers")
      .set(auth(owner))
      .send({
        sourceAccountId: owner.accountId,
        destinationAccountId: destination.accountId,
        amount: 300,
      });
    assert.equal(transfer.status, 201);
    const transferId = transfer.body.data.transaction_id as string;
    const originalLedger = await transactionLedger(transferId);
    assert.equal(originalLedger.length, 2);
    const debit = originalLedger.find((entry) => entry.entry_type === "DEBIT")!;
    const credit = originalLedger.find((entry) => entry.entry_type === "CREDIT")!;
    assert.equal(debit.amount, credit.amount);
    assert.equal(debit.balance_after, "500.0000");
    assert.equal(credit.balance_after, "300.0000");

    const concurrentKey = `${prefix}-concurrent-idempotent`;
    const concurrentIdempotent = await Promise.all([
      request(app)
        .post("/api/v1/transfers")
        .set(auth(owner))
        .set("Idempotency-Key", concurrentKey)
        .send({
          sourceAccountId: owner.accountId,
          destinationAccountId: destination.accountId,
          amount: 50,
        }),
      request(app)
        .post("/api/v1/transfers")
        .set(auth(owner))
        .set("Idempotency-Key", concurrentKey)
        .send({
          sourceAccountId: owner.accountId,
          destinationAccountId: destination.accountId,
          amount: 50,
        }),
    ]);
    assert.deepEqual(concurrentIdempotent.map((response) => response.status), [201, 201]);
    assert.equal(
      concurrentIdempotent[0]!.body.data.transaction_id,
      concurrentIdempotent[1]!.body.data.transaction_id
    );
    assert.equal((await accountBalances(owner.accountId)).current_balance, "450.0000");

    await pool.query(
      `INSERT INTO transaction_details (transaction_id, transaction_category, description)
       VALUES ($1, 'Isolation Test Category', 'Assistant ownership fixture')`,
      [concurrentIdempotent[0]!.body.data.transaction_id]
    );
    const trustedExplanation = async (analytics: { draftAnswer: string }) => analytics.draftAnswer;
    const ownerAssistant = await queryAssistant(
      BigInt(owner.userId),
      "Where did I spend the most this month?",
      trustedExplanation
    );
    const otherAssistant = await queryAssistant(
      BigInt(other.userId),
      "Where did I spend the most this month?",
      trustedExplanation
    );
    assert.match(ownerAssistant.answer, /Isolation Test Category/);
    assert.doesNotMatch(otherAssistant.answer, /Isolation Test Category/);

    const assistantWithoutToken = await request(app)
      .post("/api/v1/assistant/query")
      .send({ question: "What is my highest transaction?" });
    assert.equal(assistantWithoutToken.status, 401);

    const assistantAction = await request(app)
      .post("/api/v1/assistant/query")
      .set(auth(owner))
      .send({ question: "Transfer money to another account" });
    assert.equal(assistantAction.status, 400);
    assert.equal(assistantAction.body.error.code, "ASSISTANT_READ_ONLY");

    const extraSourceId = await addAccountFixture(owner, branchId, "CURRENT");
    const seedExtra = await request(app)
      .post("/api/v1/transactions/deposit")
      .set(auth(owner))
      .send({ accountId: extraSourceId, amount: 100 });
    assert.equal(seedExtra.status, 201);

    const concurrentTransfers = await Promise.all([
      request(app).post("/api/v1/transfers").set(auth(owner)).send({
        sourceAccountId: extraSourceId,
        destinationAccountId: destination.accountId,
        amount: 80,
      }),
      request(app).post("/api/v1/transfers").set(auth(owner)).send({
        sourceAccountId: extraSourceId,
        destinationAccountId: other.accountId,
        amount: 80,
      }),
    ]);
    assert.deepEqual(
      concurrentTransfers.map((response) => response.status).sort(),
      [201, 409]
    );
    assert.equal((await accountBalances(extraSourceId)).current_balance, "20.0000");

    const sourceBeforeReversal = await accountBalances(owner.accountId);
    const destinationBeforeReversal = await accountBalances(destination.accountId);
    const reversal = await request(app)
      .post(`/api/v1/transactions/${transferId}/reverse`)
      .set(auth(owner));
    assert.equal(reversal.status, 201);
    assert.equal(reversal.body.data.transaction_type, "REVERSAL");
    const sourceAfterReversal = await accountBalances(owner.accountId);
    const destinationAfterReversal = await accountBalances(destination.accountId);
    assert.equal(
      Number(sourceAfterReversal.current_balance),
      Number(sourceBeforeReversal.current_balance) + 300
    );
    assert.equal(
      Number(destinationAfterReversal.current_balance),
      Number(destinationBeforeReversal.current_balance) - 300
    );
    assert.deepEqual(await transactionLedger(transferId), originalLedger);

    const doubleReversal = await request(app)
      .post(`/api/v1/transactions/${transferId}/reverse`)
      .set(auth(owner));
    assert.equal(doubleReversal.status, 409);
    assert.equal(doubleReversal.body.error.code, "TRANSACTION_ALREADY_REVERSED");

    const filteredTransactions = await request(app)
      .get("/api/v1/transactions")
      .query({ page: 1, limit: 1, type: "TRANSFER", status: "COMPLETED" })
      .set(auth(owner));
    assert.equal(filteredTransactions.status, 200);
    assert.ok(filteredTransactions.body.data.length <= 1);
    assert.equal(filteredTransactions.body.pagination.limit, 1);

    const customerAdminDenied = await request(app)
      .post("/api/v1/admin/employees")
      .set(auth(owner))
      .send({
        branchId,
        employeeNumber: `${prefix}-DENIED`,
        firstName: "Denied",
        lastName: "Employee",
      });
    assert.equal(customerAdminDenied.status, 403);

    const employeeCreated = await request(app)
      .post("/api/v1/admin/employees")
      .set(auth(admin))
      .send({
        branchId,
        employeeNumber: `${prefix}-EMP`,
        firstName: "Admin",
        lastName: "Created",
        position: "Teller",
      });
    assert.equal(employeeCreated.status, 201);
    const employeeId = employeeCreated.body.data.employee_id as string;
    const employeeStatus = await request(app)
      .patch(`/api/v1/admin/employees/${employeeId}/status`)
      .set(auth(admin))
      .send({ status: "INACTIVE" });
    assert.equal(employeeStatus.status, 200);

    const balancesBeforeFreeze = await accountBalances(owner.accountId);
    const frozen = await request(app)
      .patch(`/api/v1/admin/accounts/${owner.accountId}/freeze`)
      .set(auth(admin))
      .send({ reason: "Test account freeze" });
    assert.equal(frozen.status, 200);
    assert.equal(frozen.body.data.account_status, "FROZEN");
    assert.deepEqual(await accountBalances(owner.accountId), balancesBeforeFreeze);
    const frozenDeposit = await request(app)
      .post("/api/v1/transactions/deposit")
      .set(auth(owner))
      .send({ accountId: owner.accountId, amount: 1 });
    assert.equal(frozenDeposit.status, 409);
    const unfrozen = await request(app)
      .patch(`/api/v1/admin/accounts/${owner.accountId}/unfreeze`)
      .set(auth(admin))
      .send({ reason: "Test account unfreeze" });
    assert.equal(unfrozen.status, 200);
    assert.deepEqual(await accountBalances(owner.accountId), balancesBeforeFreeze);

    const customerStatus = await request(app)
      .patch(`/api/v1/admin/customers/${other.customerId}/status`)
      .set(auth(admin))
      .send({ status: "INACTIVE" });
    assert.equal(customerStatus.status, 200);
    assert.equal(customerStatus.body.data.customer_status, "INACTIVE");

    const inactivatedCustomerLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ customerId: other.customerNumber, password });
    assert.equal(inactivatedCustomerLogin.status, 403);

    const directBalance = await request(app)
      .patch(`/api/v1/accounts/${owner.accountId}/balance`)
      .set(auth(owner))
      .send({ currentBalance: 999999 });
    const ledgerMutation = await request(app)
      .delete(`/api/v1/ledger/${debit.ledger_entry_id}`)
      .set(auth(owner));
    assert.equal(directBalance.status, 404);
    assert.equal(ledgerMutation.status, 404);

    const disabledEmail = `${prefix}.disabled@example.com`;
    const disabledRegistration = await completeTestRegistration(disabledEmail, password);
    const disabledCustomerNumber = disabledRegistration.customerNumber;
    await pool.query("UPDATE users SET status = 'INACTIVE' WHERE email = $1", [
      disabledEmail,
    ]);
    const disabledLogin = await request(app).post("/api/v1/auth/login").send({
      customerId: disabledCustomerNumber,
      password,
    });
    assert.equal(disabledLogin.status, 403);

    const lockEmail = `${prefix}.lock@example.com`;
    const lockRegistration = await completeTestRegistration(lockEmail, password);
    const lockCustomerNumber = lockRegistration.customerNumber;
    for (let attempt = 0; attempt < 5; attempt++) {
      const failed = await request(app).post("/api/v1/auth/login").send({
        customerId: lockCustomerNumber,
        password: "WrongPassword123!",
      });
      assert.equal(failed.status, 401);
    }
    const lockedLogin = await request(app).post("/api/v1/auth/login").send({
      customerId: lockCustomerNumber,
      password,
    });
    assert.equal(lockedLogin.status, 423);

    const adminAudits = await pool.query<{ action: string }>(
      "SELECT action FROM audit_logs WHERE user_id = $1",
      [admin.userId]
    );
    const adminActions = adminAudits.rows.map((row) => row.action);
    for (const action of [
      "EMPLOYEE_CREATED",
      "EMPLOYEE_STATUS_CHANGED",
      "CUSTOMER_STATUS_UPDATED",
      "ACCOUNT_FROZEN",
      "ACCOUNT_UNFROZEN",
    ]) {
      assert.ok(adminActions.includes(action));
    }

    const docs = await request(app).get("/api-docs/");
    const docsJson = await request(app).get("/api-docs.json");
    assert.equal(docs.status, 200);
    assert.equal(docsJson.status, 200);
    assert.equal(docsJson.body.openapi, "3.0.3");
    assert.equal(
      docsJson.body.paths["/api/v1/auth/login"].post.requestBody.content[
        "application/json"
      ].schema.$ref,
      "#/components/schemas/CustomerLoginCredentials"
    );
    assert.deepEqual(
      docsJson.body.components.schemas.CustomerLoginCredentials.required,
      ["customerId", "password"]
    );
    assert.ok(docsJson.body.paths["/api/v1/assistant/query"]);

    const logout = await request(app)
      .post("/api/v1/auth/logout")
      .set(auth(owner));
    assert.equal(logout.status, 200);
    const invalidatedToken = await request(app)
      .get("/api/v1/accounts")
      .set(auth(owner));
    assert.equal(invalidatedToken.status, 401);
  } finally {
    await cleanupTestData(prefix);
  }
});
