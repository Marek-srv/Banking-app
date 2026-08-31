import "dotenv/config";
import { spawn, ChildProcess } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pool } from "../src/config/db";
import {
  prepareStressFixture,
  StressFixture,
} from "./fixture";
import { runBankingIntegrityCheck } from "./check-banking-integrity";

type Mode = "load" | "concurrency" | "idempotency" | "invalid";

interface DatabaseSnapshot {
  connections: number;
  maxConnections: number;
  waitingLocks: number;
  deadlocks: number;
  rollbacks: number;
  slowQueryVisibility: "pg_stat_statements available" | "not available";
}

interface AccountSnapshot {
  currentBalance: number;
  availableBalance: number;
}

const backendRoot = path.resolve(__dirname, "..");
const resultsDirectory = path.join(__dirname, "results");
const targetPort = Number(process.env.STRESS_PORT || 3102);
const target = `http://localhost:${targetPort}`;

function parseMode(value: string | undefined): Mode {
  if (
    value === "load" ||
    value === "concurrency" ||
    value === "idempotency" ||
    value === "invalid"
  ) {
    return value;
  }

  throw new Error("Mode must be load, concurrency, idempotency, or invalid");
}

function parseUsers(mode: Mode, value: string | undefined) {
  const fallback = mode === "concurrency" ? 100 : 25;
  const users = value ? Number(value) : fallback;

  if (!Number.isInteger(users) || users <= 0 || users > 500) {
    throw new Error("User count must be an integer between 1 and 500");
  }

  if (mode === "load" && ![25, 50, 100, 250, 500].includes(users)) {
    throw new Error("Load stages support 25, 50, 100, 250, or 500 users");
  }

  return users;
}

async function waitForServer(server: ChildProcess) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) {
      throw new Error(`Backend exited before becoming ready (${server.exitCode})`);
    }

    try {
      const response = await fetch(`${target}/api-docs.json`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server may still be connecting to PostgreSQL.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Backend did not become ready within 10 seconds");
}

function startBackend() {
  const server = spawn(process.execPath, [path.join("dist", "server.js")], {
    cwd: backendRoot,
    env: {
      ...process.env,
      PORT: targetPort.toString(),
      NODE_ENV: "stress",
    },
    stdio: ["ignore", "pipe", "ignore"],
  });

  server.stdout?.on("data", (chunk) => process.stdout.write(`[backend] ${chunk}`));
  return server;
}

async function stopBackend(server: ChildProcess | undefined) {
  if (!server || server.exitCode !== null) {
    return;
  }

  server.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => server.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
  ]);

  if (server.exitCode === null) {
    server.kill("SIGKILL");
  }
}

function fixtureEnvironment(fixture: StressFixture, users: number) {
  return {
    ...process.env,
    STRESS_TARGET: target,
    STRESS_USERS: users.toString(),
    STRESS_CONCURRENCY_REQUESTS: users.toString(),
    STRESS_IDEMPOTENCY_REQUESTS: users.toString(),
    STRESS_TOKEN: fixture.token,
    STRESS_EMAIL: fixture.email,
    STRESS_CUSTOMER_ID: fixture.customerNumber,
    STRESS_PASSWORD: fixture.password,
    STRESS_LOAD_SOURCE_ID: fixture.loadSourceId,
    STRESS_LOAD_DESTINATION_ID: fixture.loadDestinationId,
    STRESS_CONCURRENCY_SOURCE_ID: fixture.concurrencySourceId,
    STRESS_CONCURRENCY_DESTINATION_ID: fixture.concurrencyDestinationId,
    STRESS_IDEMPOTENCY_SOURCE_ID: fixture.idempotencySourceId,
    STRESS_IDEMPOTENCY_DESTINATION_ID: fixture.idempotencyDestinationId,
    STRESS_UNAUTHORIZED_SOURCE_ID: fixture.unauthorizedSourceId,
    STRESS_IDEMPOTENCY_KEY: fixture.idempotencyKey,
  };
}

function configForMode(mode: Mode) {
  const fileNames: Record<Mode, string> = {
    load: "load-test.js",
    concurrency: "concurrency-transfer.js",
    idempotency: "idempotency.js",
    invalid: "invalid-cases.js",
  };
  return path.join(__dirname, fileNames[mode]);
}

async function databaseSnapshot(): Promise<DatabaseSnapshot> {
  const stats = await pool.query<{
    numbackends: number;
    deadlocks: string;
    xact_rollback: string;
  }>(
    `SELECT numbackends, deadlocks::text, xact_rollback::text
     FROM pg_stat_database
     WHERE datname = current_database()`
  );
  const locks = await pool.query<{ waiting: string }>(
    `SELECT COUNT(*)::text AS waiting
     FROM pg_stat_activity
     WHERE datname = current_database()
       AND wait_event_type = 'Lock'`
  );
  const maxConnections = await pool.query<{ setting: string }>(
    "SELECT setting FROM pg_settings WHERE name = 'max_connections'"
  );
  const extension = await pool.query<{ installed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
     ) AS installed`
  );

  return {
    connections: Number(stats.rows[0]?.numbackends ?? 0),
    maxConnections: Number(maxConnections.rows[0]?.setting ?? 0),
    waitingLocks: Number(locks.rows[0]?.waiting ?? 0),
    deadlocks: Number(stats.rows[0]?.deadlocks ?? 0),
    rollbacks: Number(stats.rows[0]?.xact_rollback ?? 0),
    slowQueryVisibility: extension.rows[0]?.installed
      ? "pg_stat_statements available"
      : "not available",
  };
}

async function accountSnapshot(accountId: string): Promise<AccountSnapshot> {
  const result = await pool.query<{
    current_balance: string;
    available_balance: string;
  }>(
    `SELECT current_balance::text, available_balance::text
     FROM accounts WHERE account_id = $1`,
    [accountId]
  );

  if (!result.rows[0]) {
    throw new Error(`Stress fixture account ${accountId} is missing`);
  }

  return {
    currentBalance: Number(result.rows[0].current_balance),
    availableBalance: Number(result.rows[0].available_balance),
  };
}

async function financialFootprint(accountIds: string[]) {
  const result = await pool.query<{
    transaction_count: string;
    ledger_count: string;
  }>(
    `SELECT
       COUNT(DISTINCT t.transaction_id)::text AS transaction_count,
       COUNT(le.ledger_entry_id)::text AS ledger_count
     FROM transactions t
     LEFT JOIN ledger_entries le ON le.transaction_id = t.transaction_id
     WHERE t.source_account_id = ANY($1::bigint[])
        OR t.destination_account_id = ANY($1::bigint[])`,
    [accountIds]
  );

  return {
    transactions: Number(result.rows[0]?.transaction_count ?? 0),
    ledgerEntries: Number(result.rows[0]?.ledger_count ?? 0),
  };
}

async function verifyConcurrency(fixture: StressFixture) {
  const transfers = await pool.query<{
    transfer_count: string;
    transferred: string;
    malformed: string;
  }>(
    `SELECT
       COUNT(*)::text AS transfer_count,
       COALESCE(SUM(t.amount), 0)::text AS transferred,
       COUNT(*) FILTER (
         WHERE (SELECT COUNT(*) FROM ledger_entries le WHERE le.transaction_id = t.transaction_id) <> 2
            OR (SELECT COUNT(*) FROM ledger_entries le
                WHERE le.transaction_id = t.transaction_id
                  AND le.entry_type = 'DEBIT'
                  AND le.account_id = t.source_account_id
                  AND le.amount = t.amount) <> 1
            OR (SELECT COUNT(*) FROM ledger_entries le
                WHERE le.transaction_id = t.transaction_id
                  AND le.entry_type = 'CREDIT'
                  AND le.account_id = t.destination_account_id
                  AND le.amount = t.amount) <> 1
       )::text AS malformed
     FROM transactions t
     WHERE t.transaction_type = 'TRANSFER'
       AND t.status = 'COMPLETED'
       AND t.source_account_id = $1
       AND t.destination_account_id = $2`,
    [fixture.concurrencySourceId, fixture.concurrencyDestinationId]
  );
  const source = await accountSnapshot(fixture.concurrencySourceId);
  const destination = await accountSnapshot(fixture.concurrencyDestinationId);
  const transferred = Number(transfers.rows[0]?.transferred ?? 0);
  const count = Number(transfers.rows[0]?.transfer_count ?? 0);
  const malformed = Number(transfers.rows[0]?.malformed ?? 0);
  const expectedSource = 10_000 - transferred;

  if (
    source.currentBalance < 0 ||
    source.availableBalance < 0 ||
    source.currentBalance !== expectedSource ||
    source.availableBalance !== expectedSource ||
    destination.currentBalance !== transferred ||
    destination.availableBalance !== transferred ||
    count > 20 ||
    malformed !== 0
  ) {
    throw new Error("Concurrent transfer verification failed");
  }

  return {
    successfulTransfers: count,
    transferred,
    sourceFinalBalance: source.currentBalance,
    destinationFinalBalance: destination.currentBalance,
    malformedTransfers: malformed,
    doubleSpending: false,
  };
}

async function verifyIdempotency(fixture: StressFixture) {
  const records = await pool.query<{
    record_count: string;
    transaction_count: string;
    ledger_count: string;
  }>(
    `SELECT
       COUNT(DISTINCT ir.idempotency_id)::text AS record_count,
       COUNT(DISTINCT ir.transaction_id)::text AS transaction_count,
       COUNT(le.ledger_entry_id)::text AS ledger_count
     FROM idempotency_records ir
     LEFT JOIN ledger_entries le ON le.transaction_id = ir.transaction_id
     WHERE ir.user_id = $1 AND ir.idempotency_key = $2`,
    [fixture.userId, fixture.idempotencyKey]
  );
  const source = await accountSnapshot(fixture.idempotencySourceId);
  const destination = await accountSnapshot(fixture.idempotencyDestinationId);
  const result = {
    idempotencyRecords: Number(records.rows[0]?.record_count ?? 0),
    financialTransactions: Number(records.rows[0]?.transaction_count ?? 0),
    ledgerEntries: Number(records.rows[0]?.ledger_count ?? 0),
    sourceFinalBalance: source.currentBalance,
    destinationFinalBalance: destination.currentBalance,
  };

  if (
    result.idempotencyRecords !== 1 ||
    result.financialTransactions !== 1 ||
    result.ledgerEntries !== 2 ||
    result.sourceFinalBalance !== 900 ||
    result.destinationFinalBalance !== 100
  ) {
    throw new Error("Idempotency verification failed");
  }

  return result;
}

function counter(report: any, name: string): number {
  return Number(report?.aggregate?.counters?.[name] ?? 0);
}

function summarizeArtillery(report: any, users: number) {
  const latency = report?.aggregate?.summaries?.["http.response_time"] ?? {};
  const total = counter(report, "http.requests");
  const successful = counter(report, "stress.responses.successful");
  const failed = counter(report, "stress.responses.failed");

  return {
    totalRequests: total,
    successfulRequests: successful,
    failedRequests: failed,
    successRate: total ? Number(((successful / total) * 100).toFixed(2)) : 0,
    errorRate: total ? Number(((failed / total) * 100).toFixed(2)) : 0,
    requestsPerSecond: Number(
      report?.aggregate?.rates?.["http.request_rate"] ?? 0
    ),
    averageLatencyMs: Number(latency.mean ?? 0),
    p95LatencyMs: Number(latency.p95 ?? 0),
    p99LatencyMs: Number(latency.p99 ?? 0),
    peakConcurrentUsers: users,
    httpStatusCodes: Object.fromEntries(
      Object.entries(report?.aggregate?.counters ?? {})
        .filter(([name]) => name.startsWith("http.codes."))
        .map(([name, value]) => [name.slice("http.codes.".length), Number(value)])
    ),
    databaseErrors: counter(report, "stress.database_errors"),
    transferFailures: counter(report, "stress.transfer_failures"),
    validationFailures: counter(report, "stress.validation_failures"),
    artilleryScenarioFailures: counter(report, "vusers.failed"),
  };
}

async function runArtillery(
  mode: Mode,
  users: number,
  fixture: StressFixture,
  outputPath: string
) {
  const artilleryBin = path.join(
    backendRoot,
    "node_modules",
    "artillery",
    "bin",
    "run"
  );
  const args = [artilleryBin, "run", configForMode(mode), "--output", outputPath];

  await new Promise<void>((resolve, reject) => {
    const processHandle = spawn(process.execPath, args, {
      cwd: backendRoot,
      env: fixtureEnvironment(fixture, users),
      stdio: "inherit",
    });

    processHandle.once("error", reject);
    processHandle.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Artillery exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const mode = parseMode(process.argv[2]);
  const users = parseUsers(mode, process.argv[3]);
  let server: ChildProcess | undefined;

  try {
    await mkdir(resultsDirectory, { recursive: true });
    const fixture = await prepareStressFixture();
    const invalidAccounts = [
      fixture.loadSourceId,
      fixture.loadDestinationId,
      fixture.unauthorizedSourceId,
    ];
    const invalidBalancesBefore =
      mode === "invalid"
        ? await Promise.all(invalidAccounts.map(accountSnapshot))
        : undefined;
    const invalidFootprintBefore =
      mode === "invalid" ? await financialFootprint(invalidAccounts) : undefined;
    const databaseBefore = await databaseSnapshot();
    let peakConnections = databaseBefore.connections;
    let peakWaitingLocks = databaseBefore.waitingLocks;

    server = startBackend();
    await waitForServer(server);

    const sampler = setInterval(() => {
      void databaseSnapshot()
        .then((sample) => {
          peakConnections = Math.max(peakConnections, sample.connections);
          peakWaitingLocks = Math.max(peakWaitingLocks, sample.waitingLocks);
        })
        .catch(() => undefined);
    }, 100);

    const outputPath = path.join(
      resultsDirectory,
      `${mode}-${users}-${Date.now()}.json`
    );

    try {
      await runArtillery(mode, users, fixture, outputPath);
    } finally {
      clearInterval(sampler);
    }

    const databaseAfter = await databaseSnapshot();
    const report = JSON.parse(await readFile(outputPath, "utf8"));
    const summary: Record<string, unknown> = {
      mode,
      ...summarizeArtillery(report, users),
      database: {
        peakConnections,
        maxConnections: databaseAfter.maxConnections,
        peakWaitingLocks,
        newDeadlocks: databaseAfter.deadlocks - databaseBefore.deadlocks,
        newRollbacks: databaseAfter.rollbacks - databaseBefore.rollbacks,
        slowQueryVisibility: databaseAfter.slowQueryVisibility,
      },
    };

    if (mode === "concurrency") {
      summary.concurrencyVerification = await verifyConcurrency(fixture);
    }

    if (mode === "idempotency") {
      summary.idempotencyVerification = await verifyIdempotency(fixture);
    }

    if (mode === "invalid") {
      const balancesAfter = await Promise.all(
        invalidAccounts.map(accountSnapshot)
      );
      const footprintAfter = await financialFootprint(invalidAccounts);
      const rollbackPreserved =
        JSON.stringify(invalidBalancesBefore) === JSON.stringify(balancesAfter) &&
        JSON.stringify(invalidFootprintBefore) === JSON.stringify(footprintAfter);

      if (!rollbackPreserved) {
        throw new Error("Invalid requests changed balances or ledger state");
      }

      summary.invalidCaseVerification = {
        rollbackPreserved,
        balancesBefore: invalidBalancesBefore,
        balancesAfter,
        footprintBefore: invalidFootprintBefore,
        footprintAfter,
      };
    }

    const integrity = await runBankingIntegrityCheck();
    summary.integrityViolations = integrity.violations.length;

    if (!integrity.passed) {
      throw new Error(
        `Banking integrity checker found ${integrity.violations.length} violation groups`
      );
    }

    console.log("\nSTRESS_TEST_SUMMARY");
    console.log(JSON.stringify(summary, null, 2));
    console.log(`Raw Artillery report: ${outputPath}`);

    if (
      Number(summary.databaseErrors) > 0 ||
      Number(summary.validationFailures) > 0 ||
      Number(summary.artilleryScenarioFailures) > 0
    ) {
      throw new Error("Stress run completed with unexpected API failures");
    }
  } finally {
    await stopBackend(server);
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Stress test failed:", error);
  process.exitCode = 1;
});
