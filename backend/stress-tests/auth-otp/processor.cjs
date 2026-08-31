"use strict";

const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");
require("dotenv").config({ path: path.resolve(__dirname, "..", "..", ".env") });

const backendRoot = path.resolve(__dirname, "..", "..");
const captureFile = path.join(__dirname, ".otp-capture.jsonl");
const metadataFile = path.join(__dirname, ".run-metadata.json");
const target = "http://localhost:3104";
const testEmailPattern = "otp-stress-%@example.test";
const password = "OtpStressPassword123!";

let backendProcess;

function createPool() {
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
}

async function removeSyntheticUsers(pool, startedAt) {
  await pool.query(
    `DELETE FROM pending_registrations
     WHERE email LIKE $1
       AND ($2::timestamp IS NULL OR created_at >= $2::timestamp)`,
    [testEmailPattern, startedAt]
  );
  const users = await pool.query(
    `SELECT u.user_id::text
     FROM users u
     WHERE u.email LIKE $1
       AND ($2::timestamp IS NULL OR u.created_at >= $2::timestamp)
    `,
    [testEmailPattern, startedAt]
  );
  const ids = users.rows.map((row) => row.user_id);

  if (ids.length === 0) {
    return;
  }

  await pool.query("DELETE FROM audit_logs WHERE user_id = ANY($1::bigint[])", [ids]);
  await pool.query(
    "DELETE FROM email_verification_otps WHERE user_id = ANY($1::bigint[])",
    [ids]
  );
  await pool.query(
    "DELETE FROM idempotency_records WHERE user_id = ANY($1::bigint[])",
    [ids]
  );
  await pool.query("DELETE FROM customers WHERE user_id = ANY($1::bigint[])", [ids]);
  await pool.query("DELETE FROM users WHERE user_id = ANY($1::bigint[])", [ids]);
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (backendProcess?.exitCode !== null) {
      throw new Error(`OTP stress backend exited with ${backendProcess.exitCode}`);
    }

    try {
      const response = await fetch(`${target}/api-docs.json`);
      if (response.ok) {
        return;
      }
    } catch {
      // The isolated backend is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("OTP stress backend did not start within 15 seconds");
}

function stopBackend(pid) {
  if (!pid) {
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // It may already have stopped.
  }
}

function beforeTest(context, _events, next) {
  void (async () => {
    await fsp.mkdir(__dirname, { recursive: true });
    await Promise.all([
      fsp.rm(captureFile, { force: true }),
      fsp.rm(metadataFile, { force: true }),
    ]);

    const pool = createPool();
    try {
      await removeSyntheticUsers(pool, null);
    } finally {
      await pool.end();
    }

    const startedAt = new Date();
    backendProcess = spawn(process.execPath, [path.join("dist", "server.js")], {
      cwd: backendRoot,
      env: {
        ...process.env,
        PORT: "3104",
        NODE_ENV: "test",
        OTP_STRESS_CAPTURE_FILE: captureFile,
      },
      stdio: "ignore",
    });
    await fsp.writeFile(
      metadataFile,
      JSON.stringify({ pid: backendProcess.pid, startedAt: startedAt.toISOString() }),
      { encoding: "utf8", mode: 0o600 }
    );
    await waitForBackend();
    context.vars.otpStressStartedAt = startedAt.toISOString();
  })().then(() => next(), next);
}

function generateSyntheticUser(context, _events, next) {
  const unique = `${Date.now()}-${randomUUID()}`;
  context.vars.email = `otp-stress-${unique}@example.test`;
  context.vars.password = password;
  next();
}

async function latestCapturedOtp(email, previousOtp) {
  for (let attempt = 0; attempt < 100; attempt++) {
    let contents = "";
    try {
      contents = await fsp.readFile(captureFile, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    const matches = contents
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((entry) => entry.email === email && entry.otp !== previousOtp);

    if (matches.length > 0) {
      return matches[matches.length - 1].otp;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Timed out waiting for captured OTP for ${email}`);
}

function readInitialOtp(context, _events, next) {
  void latestCapturedOtp(context.vars.email).then((otp) => {
    context.vars.oldOtp = otp;
    context.vars.wrongOtp = otp === "000000" ? "999999" : "000000";
  }).then(() => next(), next);
}

function readResentOtp(context, _events, next) {
  void latestCapturedOtp(context.vars.email, context.vars.oldOtp)
    .then((otp) => {
      context.vars.newOtp = otp;
    })
    .then(() => next(), next);
}

function trackAndExpect(expectedStatus) {
  return (requestParams, response, _context, events, next) => {
    const status = response.statusCode;
    events.emit("counter", "otp.responses.total", 1);
    events.emit(
      "counter",
      status >= 200 && status < 300
        ? "otp.responses.successful"
        : "otp.responses.failed",
      1
    );

    if (status >= 500) {
      events.emit("counter", "otp.unexpected_500", 1);
    }

    if (status !== expectedStatus) {
      events.emit("counter", "otp.validation_failures", 1);
      next(
        new Error(
          `Expected HTTP ${expectedStatus}, received ${status} for ${requestParams.url}`
        )
      );
      return;
    }

    next();
  };
}

function captureField(expectedStatus, responseField, contextVariable) {
  const validate = trackAndExpect(expectedStatus);
  return (requestParams, response, context, events, next) => {
    validate(requestParams, response, context, events, (error) => {
      if (error) return next(error);
      try {
        const payload = JSON.parse(response.body);
        const value = payload?.data?.[responseField];
        if (!value) return next(new Error(`Missing ${responseField} in ${requestParams.url} response`));
        context.vars[contextVariable] = value;
        next();
      } catch (parseError) {
        next(parseError);
      }
    });
  };
}

async function validateDatabase(pool, startedAt) {
  const users = await pool.query(
    `SELECT
       COUNT(*)::int AS total_users,
       COUNT(DISTINCT email)::int AS unique_emails,
       COUNT(*) FILTER (WHERE email_verified = TRUE)::int AS verified_users,
       COUNT(*) FILTER (
         WHERE email_verified = TRUE AND email_verified_at IS NULL
       )::int AS verified_without_timestamp
     FROM users
     WHERE email LIKE $1 AND created_at >= $2`,
    [testEmailPattern, startedAt]
  );
  const pendingState = await pool.query(
    `SELECT
       COUNT(*)::int AS total_pending,
       COUNT(*) FILTER (WHERE otp_attempts > 0)::int AS otps_with_failed_attempts,
       COUNT(*) FILTER (WHERE otp_used_at IS NULL)::int AS unused_otps,
       COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed
     FROM pending_registrations
     WHERE email LIKE $1 AND created_at >= $2`,
    [testEmailPattern, startedAt]
  );
  const customers = await pool.query(
    `SELECT COUNT(*)::int AS total_customers
     FROM customers c JOIN users u ON u.user_id = c.user_id
     WHERE u.email LIKE $1 AND u.created_at >= $2`,
    [testEmailPattern, startedAt]
  );
  const userState = users.rows[0];
  const pending = pendingState.rows[0];
  const result = {
    totalUsers: Number(userState.total_users),
    uniqueEmails: Number(userState.unique_emails),
    verifiedUsers: Number(userState.verified_users),
    verifiedWithoutTimestamp: Number(userState.verified_without_timestamp),
    totalCustomers: Number(customers.rows[0].total_customers),
    totalPending: Number(pending.total_pending),
    otpsWithFailedAttempts: Number(pending.otps_with_failed_attempts),
    unusedOtps: Number(pending.unused_otps),
    completedPending: Number(pending.completed),
  };

  if (
    result.totalUsers !== 35 ||
    result.uniqueEmails !== 35 ||
    result.verifiedUsers !== 35 ||
    result.verifiedWithoutTimestamp !== 0 ||
    result.totalCustomers !== 35 ||
    result.totalPending !== 35 ||
    result.otpsWithFailedAttempts !== 35 ||
    result.unusedOtps !== 0 ||
    result.completedPending !== 35
  ) {
    throw new Error(`OTP post-test database validation failed: ${JSON.stringify(result)}`);
  }

  return result;
}

function afterTest(_context, _events, next) {
  void (async () => {
    let metadata;
    try {
      metadata = JSON.parse(await fsp.readFile(metadataFile, "utf8"));
      const pool = createPool();
      try {
        const validation = await validateDatabase(pool, metadata.startedAt);
        console.log(`OTP_POST_TEST_CHECK ${JSON.stringify(validation)}`);
        await removeSyntheticUsers(pool, metadata.startedAt);
      } finally {
        await pool.end();
      }
    } finally {
      stopBackend(metadata?.pid ?? backendProcess?.pid);
      await Promise.all([
        fsp.rm(captureFile, { force: true }),
        fsp.rm(metadataFile, { force: true }),
      ]);
    }
  })().then(() => next(), next);
}

module.exports = {
  beforeTest,
  afterTest,
  generateSyntheticUser,
  readInitialOtp,
  readResentOtp,
  expect200: trackAndExpect(200),
  expect201: trackAndExpect(201),
  expect400: trackAndExpect(400),
  expect403: trackAndExpect(403),
  expect409: trackAndExpect(409),
  captureRegistrationToken: captureField(200, "registrationToken", "registrationToken"),
  captureCustomerId: captureField(201, "customerId", "customerId"),
};
