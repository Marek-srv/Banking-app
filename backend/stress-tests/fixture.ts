import "dotenv/config";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../src/config/db";
import { env } from "../src/config/env";

const FIXTURE_EMAIL_PATTERN = "artillery-stress-%@example.test";
const FIXTURE_BRANCH_CODE = "ARTSTRESS";
export const STRESS_PASSWORD = "StressOnlyPassword123!";

export interface StressFixture {
  token: string;
  userId: string;
  email: string;
  customerNumber: string;
  password: string;
  loadSourceId: string;
  loadDestinationId: string;
  concurrencySourceId: string;
  concurrencyDestinationId: string;
  idempotencySourceId: string;
  idempotencyDestinationId: string;
  unauthorizedSourceId: string;
  idempotencyKey: string;
}

async function removePreviousFixture() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const users = await client.query<{ user_id: string }>(
      "SELECT user_id::text FROM users WHERE email LIKE $1",
      [FIXTURE_EMAIL_PATTERN]
    );
    const userIds = users.rows.map((row) => row.user_id);

    if (userIds.length > 0) {
      await client.query(
        "DELETE FROM audit_logs WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );
      await client.query(
        "DELETE FROM email_verification_otps WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );
      await client.query(
        "DELETE FROM idempotency_records WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );

      const accounts = await client.query<{ account_id: string }>(
        `SELECT a.account_id::text
         FROM accounts a
         JOIN customers c ON c.customer_id = a.customer_id
         WHERE c.user_id = ANY($1::bigint[])`,
        [userIds]
      );
      const accountIds = accounts.rows.map((row) => row.account_id);

      if (accountIds.length > 0) {
        const transactions = await client.query<{ transaction_id: string }>(
          `SELECT transaction_id::text
           FROM transactions
           WHERE source_account_id = ANY($1::bigint[])
              OR destination_account_id = ANY($1::bigint[])`,
          [accountIds]
        );
        const transactionIds = transactions.rows.map(
          (row) => row.transaction_id
        );

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

        await client.query(
          "DELETE FROM cards WHERE account_id = ANY($1::bigint[])",
          [accountIds]
        );
      }

      const customers = await client.query<{ customer_id: string }>(
        "SELECT customer_id::text FROM customers WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );
      const customerIds = customers.rows.map((row) => row.customer_id);

      if (customerIds.length > 0) {
        await client.query(
          "DELETE FROM beneficiaries WHERE customer_id = ANY($1::bigint[])",
          [customerIds]
        );
        await client.query(
          "DELETE FROM accounts WHERE customer_id = ANY($1::bigint[])",
          [customerIds]
        );
        await client.query(
          "DELETE FROM customers WHERE customer_id = ANY($1::bigint[])",
          [customerIds]
        );
      }

      await client.query(
        "DELETE FROM users WHERE user_id = ANY($1::bigint[])",
        [userIds]
      );
    }

    await client.query("DELETE FROM branches WHERE branch_code = $1", [
      FIXTURE_BRANCH_CODE,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function prepareStressFixture(): Promise<StressFixture> {
  await removePreviousFixture();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const passwordHash = await bcrypt.hash(STRESS_PASSWORD, 10);
    const branch = await client.query<{ branch_id: string }>(
      `INSERT INTO branches (branch_code, branch_name, city, state, country)
       VALUES ($1, 'Artillery Synthetic Branch', 'Test City', 'Test State', 'India')
       RETURNING branch_id::text`,
      [FIXTURE_BRANCH_CODE]
    );
    const branchId = branch.rows[0]!.branch_id;

    async function createUserCustomer(label: string) {
      const email = `artillery-stress-${label}@example.test`;
      const user = await client.query<{ user_id: string }>(
        `INSERT INTO users (
           email, password_hash, role, status, email_verified, email_verified_at
         ) VALUES ($1, $2, 'CUSTOMER', 'ACTIVE', TRUE, $3)
         RETURNING user_id::text`,
        [email, passwordHash, new Date()]
      );
      const userId = user.rows[0]!.user_id;
      const customer = await client.query<{
        customer_id: string;
        customer_number: string;
      }>(
        `INSERT INTO customers (
           user_id, branch_id, customer_number, first_name, last_name,
           country, kyc_status, customer_status
         ) VALUES ($1, $2, $3, 'Synthetic', $4, 'India', 'VERIFIED', 'ACTIVE')
         RETURNING customer_id::text, customer_number`,
        [userId, branchId, `ART-${label.toUpperCase()}`, label]
      );

      return {
        userId,
        email,
        customerId: customer.rows[0]!.customer_id,
        customerNumber: customer.rows[0]!.customer_number,
      };
    }

    async function createAccount(
      code: string,
      customerId: string,
      openingBalance: number
    ) {
      const account = await client.query<{ account_id: string }>(
        `INSERT INTO accounts (
           account_number, customer_id, branch_id, account_type, currency,
           current_balance, available_balance, account_status, opened_at
         ) VALUES ($1, $2, $3, 'SAVINGS', 'INR', 0, 0, 'ACTIVE', CURRENT_DATE)
         RETURNING account_id::text`,
        [`ART${code}`, customerId, branchId]
      );
      const accountId = account.rows[0]!.account_id;

      if (openingBalance > 0) {
        const seededAt = new Date();
        const transaction = await client.query<{ transaction_id: string }>(
          `INSERT INTO transactions (
             reference_number, transaction_type, destination_account_id,
             amount, currency, status, initiated_at, completed_at, created_at
           ) VALUES ($1, 'DEPOSIT', $2, $3, 'INR', 'COMPLETED', $4, $4, $4)
           RETURNING transaction_id::text`,
          [`ART-SEED-${code}`, accountId, openingBalance, seededAt]
        );
        const transactionId = transaction.rows[0]!.transaction_id;

        await client.query(
          `INSERT INTO ledger_entries (
             transaction_id, account_id, entry_type, amount,
             balance_before, balance_after, created_at
           ) VALUES ($1, $2, 'CREDIT', $3, 0, $3, $4)`,
          [transactionId, accountId, openingBalance, seededAt]
        );
        await client.query(
          `INSERT INTO transaction_status_history (
             transaction_id, status, description, created_at
           ) VALUES ($1, 'COMPLETED', 'Synthetic stress-test opening balance', $2)`,
          [transactionId, seededAt]
        );
        await client.query(
          `UPDATE accounts
           SET current_balance = $2, available_balance = $2
           WHERE account_id = $1`,
          [accountId, openingBalance]
        );
      }

      return accountId;
    }

    const owner = await createUserCustomer("owner");
    const destination = await createUserCustomer("destination");
    const unauthorized = await createUserCustomer("unauthorized");

    const loadSourceId = await createAccount("LOADSRC", owner.customerId, 1_000_000);
    const loadDestinationId = await createAccount("LOADDST", destination.customerId, 0);
    const concurrencySourceId = await createAccount("CONCSRC", owner.customerId, 10_000);
    const concurrencyDestinationId = await createAccount("CONCDST", destination.customerId, 0);
    const idempotencySourceId = await createAccount("IDEMSRC", owner.customerId, 1_000);
    const idempotencyDestinationId = await createAccount("IDEMDST", destination.customerId, 0);
    const unauthorizedSourceId = await createAccount(
      "UNAUTHSRC",
      unauthorized.customerId,
      1_000
    );

    await client.query("COMMIT");

    const token = jwt.sign(
      { userId: owner.userId, role: "CUSTOMER", tokenVersion: 0 },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return {
      token,
      userId: owner.userId,
      email: owner.email,
      customerNumber: owner.customerNumber,
      password: STRESS_PASSWORD,
      loadSourceId,
      loadDestinationId,
      concurrencySourceId,
      concurrencyDestinationId,
      idempotencySourceId,
      idempotencyDestinationId,
      unauthorizedSourceId,
      idempotencyKey: `artillery-idempotency-${Date.now()}`,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupStressFixture() {
  await removePreviousFixture();
}
