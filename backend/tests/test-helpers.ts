import { pool } from "../src/config/db";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app";
import { getCapturedOtpForTest } from "../src/services/email.service";

async function ensureTestOnboardingBranch() {
  const branchCode = (process.env.DEFAULT_ONBOARDING_BRANCH_CODE ?? "DIGITAL001")
    .trim()
    .toUpperCase();

  await pool.query(
    `INSERT INTO branches (
       branch_code, branch_name, city, state, country, status
     ) VALUES ($1, 'π Bank Test Onboarding Branch', 'Test City', 'Test State', 'India', 'ACTIVE')
     ON CONFLICT (branch_code) DO NOTHING`,
    [branchCode]
  );
}

export async function startTestRegistration(email: string) {
  await ensureTestOnboardingBranch();
  const normalizedEmail = email.toLowerCase();
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      firstName: "Test",
      lastName: "Customer",
      dateOfBirth: "1992-06-18",
      mobile: "9876543210",
      email,
    });
  assert.equal(response.status, 201);
  const otp = getCapturedOtpForTest(normalizedEmail);
  assert.match(otp ?? "", /^\d{6}$/);
  return { normalizedEmail, otp: otp!, response };
}

export async function completeTestRegistration(email: string, password: string) {
  const started = await startTestRegistration(email);
  const verification = await request(app)
    .post("/api/v1/auth/verify-otp")
    .send({ email: started.normalizedEmail, otp: started.otp });
  assert.equal(verification.status, 200);
  const registrationToken = verification.body.data.registrationToken as string;
  assert.match(registrationToken, /^[a-f0-9]{64}$/);
  const completion = await request(app)
    .post("/api/v1/auth/complete-registration")
    .send({ registrationToken, password, confirmPassword: password });
  assert.equal(completion.status, 201);
  await activateCompletedTestCustomer(started.normalizedEmail);
  return {
    normalizedEmail: started.normalizedEmail,
    customerNumber: completion.body.data.customerId as string,
    registrationToken,
  };
}

export async function activateCompletedTestCustomer(email: string) {
  const normalizedEmail = email.toLowerCase();
  await pool.query(
    `UPDATE users
     SET status = 'ACTIVE', updated_at = now()
     WHERE email = $1`,
    [normalizedEmail]
  );
  await pool.query(
    `UPDATE customers
     SET customer_status = 'ACTIVE', approved_at = now(), updated_at = now()
     WHERE user_id = (SELECT user_id FROM users WHERE email = $1)`,
    [normalizedEmail]
  );
}

export async function createTestBranch(prefix: string) {
  const result = await pool.query<{ branch_id: string }>(
    `INSERT INTO branches (
       branch_code,
       branch_name,
       city,
       state,
       country
     ) VALUES ($1, $2, 'Test City', 'Test State', 'India')
     RETURNING branch_id::text`,
    [`${prefix}-BR`, `${prefix} Test Branch`]
  );

  return result.rows[0]!.branch_id;
}

export async function accountBalances(accountId: string) {
  const result = await pool.query<{
    current_balance: string;
    available_balance: string;
  }>(
    `SELECT current_balance::text, available_balance::text
     FROM accounts WHERE account_id = $1`,
    [accountId]
  );

  return result.rows[0]!;
}

export async function transactionLedger(transactionId: string) {
  const result = await pool.query<{
    ledger_entry_id: string;
    account_id: string;
    entry_type: string;
    amount: string;
    balance_before: string;
    balance_after: string;
  }>(
    `SELECT
       ledger_entry_id::text,
       account_id::text,
       entry_type,
       amount::text,
       balance_before::text,
       balance_after::text
     FROM ledger_entries
     WHERE transaction_id = $1
     ORDER BY ledger_entry_id`,
    [transactionId]
  );

  return result.rows;
}

export async function cleanupTestData(prefix: string) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM pending_registrations WHERE email LIKE $1", [
      `${prefix.toLowerCase()}%`,
    ]);
    const users = await client.query<{ user_id: string }>(
      "SELECT user_id::text FROM users WHERE email LIKE $1",
      [`${prefix.toLowerCase()}%`]
    );
    const userIds = users.rows.map((row) => row.user_id);

    if (userIds.length > 0) {
      await client.query("DELETE FROM audit_logs WHERE user_id = ANY($1::bigint[])", [userIds]);
      await client.query(
        "DELETE FROM email_verification_otps WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );
      await client.query(
        "DELETE FROM account_recovery_otps WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );
      await client.query("DELETE FROM idempotency_records WHERE user_id = ANY($1::bigint[])", [userIds]);

      const accounts = await client.query<{ account_id: string }>(
        `SELECT a.account_id::text
         FROM accounts a
         JOIN customers c ON c.customer_id = a.customer_id
         WHERE c.user_id = ANY($1::bigint[])`,
        [userIds]
      );
      const accountIds = accounts.rows.map((row) => row.account_id);

      if (accountIds.length > 0) {
        await client.query(
          "DELETE FROM audit_logs WHERE entity = 'ACCOUNT' AND entity_id = ANY($1::bigint[])",
          [accountIds]
        );
        const transactions = await client.query<{ transaction_id: string }>(
          `SELECT transaction_id::text
           FROM transactions
           WHERE source_account_id = ANY($1::bigint[])
              OR destination_account_id = ANY($1::bigint[])`,
          [accountIds]
        );
        const transactionIds = transactions.rows.map((row) => row.transaction_id);

        if (transactionIds.length > 0) {
          await client.query(
            "DELETE FROM idempotency_records WHERE transaction_id = ANY($1::bigint[])",
            [transactionIds]
          );
          await client.query(
            "DELETE FROM ledger_entries WHERE transaction_id = ANY($1::bigint[])",
            [transactionIds]
          );
          await client.query(
            "DELETE FROM transaction_details WHERE transaction_id = ANY($1::bigint[])",
            [transactionIds]
          );
          await client.query(
            "DELETE FROM transaction_status_history WHERE transaction_id = ANY($1::bigint[])",
            [transactionIds]
          );
          await client.query(
            `DELETE FROM transactions
             WHERE transaction_id = ANY($1::bigint[])
               AND reversal_of_transaction_id IS NOT NULL`,
            [transactionIds]
          );
          await client.query(
            "DELETE FROM transactions WHERE transaction_id = ANY($1::bigint[])",
            [transactionIds]
          );
        }

        await client.query("DELETE FROM cards WHERE account_id = ANY($1::bigint[])", [accountIds]);
      }

      const customers = await client.query<{ customer_id: string }>(
        "SELECT customer_id::text FROM customers WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );
      const customerIds = customers.rows.map((row) => row.customer_id);

      if (customerIds.length > 0) {
        await client.query(
          "DELETE FROM audit_logs WHERE entity IN ('CUSTOMER', 'KYC') AND entity_id = ANY($1::bigint[])",
          [customerIds]
        );
        await client.query(
          "DELETE FROM customer_kyc_status_history WHERE customer_id = ANY($1::bigint[])",
          [customerIds]
        );
        const accountRequests = await client.query<{ account_request_id: string }>(
          "SELECT account_request_id::text FROM account_requests WHERE customer_id = ANY($1::bigint[])",
          [customerIds]
        );
        const accountRequestIds = accountRequests.rows.map((row) => row.account_request_id);
        if (accountRequestIds.length > 0) {
          await client.query(
            "DELETE FROM audit_logs WHERE entity = 'ACCOUNT_REQUEST' AND entity_id = ANY($1::bigint[])",
            [accountRequestIds]
          );
          await client.query(
            "DELETE FROM request_status_history WHERE request_type = 'ACCOUNT_OPENING' AND request_id = ANY($1::bigint[])",
            [accountRequestIds]
          );
        }
        await client.query("DELETE FROM account_closure_requests WHERE customer_id = ANY($1::bigint[])", [customerIds]);
        await client.query("DELETE FROM transfer_limit_requests WHERE customer_id = ANY($1::bigint[])", [customerIds]);
        await client.query("DELETE FROM account_requests WHERE customer_id = ANY($1::bigint[])", [customerIds]);
        await client.query("DELETE FROM loan_requests WHERE customer_id = ANY($1::bigint[])", [customerIds]);
        await client.query(
          "DELETE FROM beneficiaries WHERE customer_id = ANY($1::bigint[])",
          [customerIds]
        );
        await client.query("DELETE FROM accounts WHERE customer_id = ANY($1::bigint[])", [customerIds]);
        await client.query("DELETE FROM customers WHERE customer_id = ANY($1::bigint[])", [customerIds]);
      }

      await client.query("DELETE FROM users WHERE user_id = ANY($1::bigint[])", [userIds]);
    }

    await client.query("DELETE FROM employees WHERE employee_number LIKE $1", [`${prefix}%`]);
    await client.query("DELETE FROM branches WHERE branch_code = $1", [`${prefix}-BR`]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
