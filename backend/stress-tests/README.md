# Banking Backend Artillery Stress Suite

This suite runs only against the local backend and creates deterministic synthetic records using emails under `artillery-stress-*@example.test` and branch code `ARTSTRESS`. Fixture funding is represented by completed deposit transactions and credit ledger entries; balances are never seeded without matching ledger history.

## Prerequisites

- PostgreSQL is running with the backend `.env` configuration.
- Dependencies are installed with `npm install`.
- Run commands from `backend/`.

Each Artillery command resets only the named synthetic fixture, starts the compiled backend on `http://localhost:3102`, executes the test, validates database effects, runs the integrity checker, and stops that backend process. Raw Artillery JSON reports are written to the ignored `stress-tests/results/` directory.

## Commands

```powershell
npm run build
npm run stress:typecheck
npm run stress:integrity

npm run stress:25
npm run stress:50
npm run stress:100
npm run stress:250
npm run stress:500

npm run stress:concurrency
npm run stress:idempotency
npm run stress:invalid
npm run stress:cleanup
```

`stress:test` is an alias for the safe initial 25-user stage. The 500-user stage is intentionally never invoked by another script; run it explicitly only after smaller stages are healthy.

## Test behavior

- `load-test.js`: every virtual user exercises login, owned accounts, owned transactions, transfer, deposit, and withdrawal.
- `concurrency-transfer.js`: 100 near-simultaneous ₹500 transfers contend on one ₹10,000 source account. Database verification requires no more than 20 successes, exact source/destination balances, two correctly assigned ledger rows per success, and no negative balance.
- `idempotency.js`: 25 concurrent retries share one user-scoped idempotency key. Verification requires one transaction, two ledger entries, and exactly one ₹100 balance movement.
- `invalid-cases.js`: 10 concurrent users send 60 total requests covering insufficient funds, same-account, missing destination, unauthorized source, zero amount, and negative amount without being masked by the 60-request local transaction limiter. Account balances, transaction count, and ledger count must remain unchanged.
- `check-banking-integrity.ts`: performs read-only PostgreSQL checks and exits non-zero when any integrity violation exists.

The application’s local IP-based rate limits remain enabled. At higher stages, HTTP 429 responses are therefore expected and are reported as failed requests; the suite does not weaken rate limits to improve results.

## Database observations

The runner samples PostgreSQL connection usage and lock waits, reports changes to database deadlock and rollback counters, and states whether `pg_stat_statements` is installed. It does not install extensions or change PostgreSQL configuration.
