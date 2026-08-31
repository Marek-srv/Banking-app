import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../src/config/db";

after(async () => {
  await pool.end();
});

test("completed internal transfers have balanced debit and credit totals", async () => {
  const result = await pool.query<{ transaction_id: string }>(`
    SELECT t.transaction_id::text
    FROM transactions t
    LEFT JOIN ledger_entries le ON le.transaction_id = t.transaction_id
    WHERE t.transaction_type = 'TRANSFER'
      AND t.status = 'COMPLETED'
    GROUP BY t.transaction_id
    HAVING COALESCE(SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END), 0)
         <> COALESCE(SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END), 0)
  `);

  assert.deepEqual(result.rows, []);
});

test("ledger balance_after arithmetic is valid", async () => {
  const result = await pool.query<{ ledger_entry_id: string }>(`
    SELECT ledger_entry_id::text
    FROM ledger_entries
    WHERE (entry_type = 'DEBIT' AND balance_after <> balance_before - amount)
       OR (entry_type = 'CREDIT' AND balance_after <> balance_before + amount)
  `);

  assert.deepEqual(result.rows, []);
});

test("account balances match their account-type ledger rules", async () => {
  const result = await pool.query<{ account_id: string }>(`
    WITH latest_ledger AS (
      SELECT DISTINCT ON (account_id)
        account_id,
        balance_after
      FROM ledger_entries
      ORDER BY account_id, created_at DESC, ledger_entry_id DESC
    )
    SELECT a.account_id::text
    FROM accounts a
    LEFT JOIN latest_ledger ll ON ll.account_id = a.account_id
    WHERE (ll.account_id IS NULL AND (a.current_balance <> 0 OR a.available_balance <> 0))
       OR (ll.account_id IS NOT NULL AND a.current_balance <> ll.balance_after)
       OR (a.account_type IN ('SAVINGS', 'CURRENT') AND ll.account_id IS NOT NULL
           AND a.available_balance <> ll.balance_after)
       OR (a.account_type = 'LOAN' AND a.available_balance <> 0)
  `);

  assert.deepEqual(result.rows, []);
});

test("financial rows contain only positive amounts and valid entry types", async () => {
  const transactions = await pool.query<{ transaction_id: string }>(`
    SELECT transaction_id::text
    FROM transactions
    WHERE amount <= 0
  `);
  const ledger = await pool.query<{ ledger_entry_id: string }>(`
    SELECT ledger_entry_id::text
    FROM ledger_entries
    WHERE amount <= 0
       OR entry_type NOT IN ('DEBIT', 'CREDIT')
  `);

  assert.deepEqual(transactions.rows, []);
  assert.deepEqual(ledger.rows, []);
});

test("completed transactions always have completed_at", async () => {
  const result = await pool.query<{ transaction_id: string }>(`
    SELECT transaction_id::text
    FROM transactions
    WHERE status = 'COMPLETED'
      AND completed_at IS NULL
  `);

  assert.deepEqual(result.rows, []);
});
