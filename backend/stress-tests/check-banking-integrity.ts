import "dotenv/config";
import { pool } from "../src/config/db";

interface IntegrityViolation {
  check: string;
  count: number;
  samples: Record<string, string>[];
}

interface IntegrityQuery {
  check: string;
  sql: string;
  idColumn: string;
}

const integrityQueries: IntegrityQuery[] = [
  {
    check: "negative account balances",
    idColumn: "account_id",
    sql: `SELECT account_id::text
          FROM accounts
          WHERE current_balance < 0 OR available_balance < 0`,
  },
  {
    check: "non-positive ledger amounts",
    idColumn: "ledger_entry_id",
    sql: `SELECT ledger_entry_id::text
          FROM ledger_entries
          WHERE amount <= 0`,
  },
  {
    check: "invalid ledger entry types",
    idColumn: "ledger_entry_id",
    sql: `SELECT ledger_entry_id::text
          FROM ledger_entries
          WHERE entry_type NOT IN ('DEBIT', 'CREDIT')`,
  },
  {
    check: "completed transactions missing completed_at",
    idColumn: "transaction_id",
    sql: `SELECT transaction_id::text
          FROM transactions
          WHERE status = 'COMPLETED' AND completed_at IS NULL`,
  },
  {
    check: "invalid completed transfer account references or amounts",
    idColumn: "transaction_id",
    sql: `SELECT transaction_id::text
          FROM transactions
          WHERE transaction_type = 'TRANSFER'
            AND status = 'COMPLETED'
            AND (
              source_account_id IS NULL
              OR destination_account_id IS NULL
              OR source_account_id = destination_account_id
              OR amount <= 0
            )`,
  },
  {
    check: "unbalanced completed transfers",
    idColumn: "transaction_id",
    sql: `SELECT t.transaction_id::text
          FROM transactions t
          LEFT JOIN ledger_entries le ON le.transaction_id = t.transaction_id
          WHERE t.transaction_type = 'TRANSFER' AND t.status = 'COMPLETED'
          GROUP BY t.transaction_id
          HAVING COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'DEBIT'), 0)
               <> COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'CREDIT'), 0)`,
  },
  {
    check: "incorrect completed transfer ledger shape or accounts",
    idColumn: "transaction_id",
    sql: `SELECT t.transaction_id::text
          FROM transactions t
          LEFT JOIN ledger_entries le ON le.transaction_id = t.transaction_id
          WHERE t.transaction_type = 'TRANSFER' AND t.status = 'COMPLETED'
          GROUP BY t.transaction_id, t.source_account_id, t.destination_account_id, t.amount
          HAVING COUNT(le.ledger_entry_id) <> 2
             OR COUNT(*) FILTER (
               WHERE le.entry_type = 'DEBIT'
                 AND le.account_id = t.source_account_id
                 AND le.amount = t.amount
             ) <> 1
             OR COUNT(*) FILTER (
               WHERE le.entry_type = 'CREDIT'
                 AND le.account_id = t.destination_account_id
                 AND le.amount = t.amount
             ) <> 1`,
  },
  {
    check: "incorrect ledger balance_after arithmetic",
    idColumn: "ledger_entry_id",
    sql: `SELECT ledger_entry_id::text
          FROM ledger_entries
          WHERE (entry_type = 'DEBIT' AND balance_after <> balance_before - amount)
             OR (entry_type = 'CREDIT' AND balance_after <> balance_before + amount)`,
  },
  {
    check: "account balance differs from latest ledger-derived balance",
    idColumn: "account_id",
    sql: `WITH latest_ledger AS (
            SELECT DISTINCT ON (account_id)
              account_id,
              balance_after
            FROM ledger_entries
            ORDER BY account_id, ledger_entry_id DESC
          )
          SELECT
            a.account_id::text,
            a.account_number,
            a.current_balance::text,
            COALESCE(ll.balance_after, 0)::text AS latest_ledger_balance,
            (
              SELECT JSON_AGG(recent)
              FROM (
                SELECT
                  le.ledger_entry_id::text,
                  le.entry_type,
                  le.balance_before::text,
                  le.balance_after::text,
                  le.created_at
                FROM ledger_entries le
                WHERE le.account_id = a.account_id
                ORDER BY le.ledger_entry_id DESC
                LIMIT 5
              ) recent
            )::text AS recent_ledger
          FROM accounts a
          LEFT JOIN latest_ledger ll ON ll.account_id = a.account_id
          WHERE (ll.account_id IS NULL AND a.current_balance <> 0)
             OR (ll.account_id IS NOT NULL AND a.current_balance <> ll.balance_after)`,
  },
  {
    check: "duplicate user-scoped idempotency keys",
    idColumn: "idempotency_key",
    sql: `SELECT idempotency_key
          FROM idempotency_records
          GROUP BY user_id, idempotency_key
          HAVING COUNT(*) > 1`,
  },
  {
    check: "completed idempotency records without one transaction",
    idColumn: "idempotency_id",
    sql: `SELECT idempotency_id::text
          FROM idempotency_records
          WHERE status = 'COMPLETED' AND transaction_id IS NULL`,
  },
];

export async function runBankingIntegrityCheck() {
  const violations: IntegrityViolation[] = [];

  for (const query of integrityQueries) {
    const result = await pool.query<Record<string, string>>(query.sql);

    if (result.rowCount && result.rowCount > 0) {
      violations.push({
        check: query.check,
        count: result.rowCount,
        samples: result.rows.slice(0, 10),
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    checksRun: integrityQueries.length,
    violations,
    passed: violations.length === 0,
  };
}

async function main() {
  try {
    const result = await runBankingIntegrityCheck();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
