import assert from "node:assert/strict";
import test, { after } from "node:test";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";
import {
  clearCapturedOtpsForTest,
  getCapturedOtpForTest,
} from "../src/services/email.service";
import { activateCompletedTestCustomer, cleanupTestData, startTestRegistration } from "./test-helpers";

process.env.NODE_ENV = "test";

after(async () => {
  clearCapturedOtpsForTest();
  await pool.end();
});

const prefix = `otp${Date.now().toString(36)}`;
const password = "StrongPassword123!";

function differentOtp(otp: string) {
  return otp === "000000" ? "999999" : "000000";
}

async function verify(email: string, otp: string) {
  return request(app).post("/api/v1/auth/verify-otp").send({ email, otp });
}

async function complete(registrationToken: string, suppliedPassword = password) {
  return request(app)
    .post("/api/v1/auth/complete-registration")
    .send({
      registrationToken,
      password: suppliedPassword,
      confirmPassword: suppliedPassword,
    });
}

test("pending onboarding creates exactly one verified user and customer", async () => {
  try {
    const primary = await startTestRegistration(`${prefix}.Primary@Example.com`);
    const pending = await pool.query<{
      otp_hash: string;
      otp_attempts: number;
      email_verified_at: Date | null;
      completed_at: Date | null;
    }>(
      `SELECT otp_hash, otp_attempts, email_verified_at, completed_at
       FROM pending_registrations WHERE email = $1`,
      [primary.normalizedEmail]
    );
    assert.equal(pending.rowCount, 1);
    assert.notEqual(pending.rows[0]?.otp_hash, primary.otp);
    assert.equal(await bcrypt.compare(primary.otp, pending.rows[0]!.otp_hash), true);
    assert.equal(pending.rows[0]?.email_verified_at, null);
    assert.equal(
      (await pool.query("SELECT 1 FROM users WHERE email = $1", [primary.normalizedEmail])).rowCount,
      0
    );

    const wrong = await verify(primary.normalizedEmail, differentOtp(primary.otp));
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error.code, "INVALID_OR_EXPIRED_OTP");

    const verified = await verify(primary.normalizedEmail, primary.otp);
    assert.equal(verified.status, 200);
    const registrationToken = verified.body.data.registrationToken as string;
    assert.match(registrationToken, /^[a-f0-9]{64}$/);
    assert.equal(
      (await pool.query("SELECT 1 FROM users WHERE email = $1", [primary.normalizedEmail])).rowCount,
      0
    );

    const reusedOtp = await verify(primary.normalizedEmail, primary.otp);
    assert.equal(reusedOtp.status, 400);

    const mismatchedPasswords = await request(app)
      .post("/api/v1/auth/complete-registration")
      .send({
        registrationToken,
        password,
        confirmPassword: "DifferentPassword123!",
      });
    assert.equal(mismatchedPasswords.status, 400);

    const completed = await complete(registrationToken);
    assert.equal(completed.status, 201);
    const customerId = completed.body.data.customerId as string;
    assert.match(customerId, /^CUST\d{8,}$/);

    const created = await pool.query<{
      user_id: string;
      email_verified: boolean;
      email_verified_at: Date | null;
      customer_count: string;
      customer_number: string;
      branch_code: string;
    }>(
      `SELECT
         u.user_id::text,
         u.email_verified,
         u.email_verified_at,
         COUNT(c.customer_id)::text AS customer_count,
         MAX(c.customer_number) AS customer_number,
         MAX(b.branch_code) AS branch_code
       FROM users u
       JOIN customers c ON c.user_id = u.user_id
       JOIN branches b ON b.branch_id = c.branch_id
       WHERE u.email = $1
       GROUP BY u.user_id, u.email_verified, u.email_verified_at`,
      [primary.normalizedEmail]
    );
    assert.equal(created.rowCount, 1);
    assert.equal(created.rows[0]?.email_verified, true);
    assert.ok(created.rows[0]?.email_verified_at);
    assert.equal(created.rows[0]?.customer_count, "1");
    assert.equal(created.rows[0]?.customer_number, customerId);
    assert.equal(
      created.rows[0]?.branch_code,
      (process.env.DEFAULT_ONBOARDING_BRANCH_CODE ?? "DIGITAL001").trim().toUpperCase()
    );

    const completionRetry = await complete(registrationToken);
    assert.equal(completionRetry.status, 409);
    assert.equal(completionRetry.body.error.code, "REGISTRATION_ALREADY_COMPLETED");
    const duplicateCounts = await pool.query<{ users: string; customers: string }>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE email = $1)::text AS users,
         (SELECT COUNT(*) FROM customers c JOIN users u ON u.user_id = c.user_id WHERE u.email = $1)::text AS customers`,
      [primary.normalizedEmail]
    );
    assert.deepEqual(duplicateCounts.rows[0], { users: "1", customers: "1" });

    await activateCompletedTestCustomer(primary.normalizedEmail);

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ customerId, password });
    assert.equal(login.status, 200);
    assert.ok(login.body.data.token);
    const profile = await request(app)
      .get("/api/v1/customers/me")
      .set("Authorization", `Bearer ${login.body.data.token}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.customer_number, customerId);

    const expired = await startTestRegistration(`${prefix}.expired@example.com`);
    await pool.query(
      "UPDATE pending_registrations SET otp_expires_at = timezone('UTC', now()) - interval '1 second' WHERE email = $1",
      [expired.normalizedEmail]
    );
    assert.equal((await verify(expired.normalizedEmail, expired.otp)).status, 400);

    const attempts = await startTestRegistration(`${prefix}.attempts@example.com`);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      assert.equal((await verify(attempts.normalizedEmail, differentOtp(attempts.otp))).status, 400);
    }
    const fifth = await verify(attempts.normalizedEmail, differentOtp(attempts.otp));
    assert.equal(fifth.status, 429);
    assert.equal(fifth.body.error.code, "OTP_ATTEMPTS_EXCEEDED");
    assert.equal((await verify(attempts.normalizedEmail, attempts.otp)).status, 429);

    const resend = await startTestRegistration(`${prefix}.resend@example.com`);
    const resent = await request(app)
      .post("/api/v1/auth/resend-otp")
      .send({ email: resend.normalizedEmail });
    assert.equal(resent.status, 200);
    const newOtp = getCapturedOtpForTest(resend.normalizedEmail);
    assert.match(newOtp ?? "", /^\d{6}$/);
    assert.notEqual(newOtp, resend.otp);
    assert.equal((await verify(resend.normalizedEmail, resend.otp)).status, 400);
    assert.equal((await verify(resend.normalizedEmail, newOtp!)).status, 200);
  } finally {
    await cleanupTestData(prefix);
  }
});
