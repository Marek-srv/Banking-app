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
import { cleanupTestData, completeTestRegistration } from "./test-helpers";

process.env.NODE_ENV = "test";

after(async () => {
  clearCapturedOtpsForTest();
  await pool.end();
});

const prefix = `recovery${Date.now().toString(36)}`;
const email = `${prefix}.primary@example.com`;
const dateOfBirth = "1992-06-18";
const originalPassword = "OriginalPassword123!";
const newPassword = "ReplacementPassword456!";
let customerId = "";

function differentOtp(otp: string) {
  return otp === "000000" ? "999999" : "000000";
}

async function registerVerifiedCustomer() {
  const completed = await completeTestRegistration(email, originalPassword);
  customerId = completed.customerNumber;
}

async function requestCustomerIdOtp() {
  return request(app)
    .post("/api/v1/auth/recovery/customer-id/request")
    .send({ email, dateOfBirth });
}

async function requestPasswordOtp() {
  return request(app)
    .post("/api/v1/auth/recovery/password/request")
    .send({ customerId });
}

test("customer ID and password recovery enforce secure OTP rules", async () => {
  try {
    await registerVerifiedCustomer();

    const customerIdRequest = await requestCustomerIdOtp();
    assert.equal(customerIdRequest.status, 200);
    const firstCustomerIdOtp = getCapturedOtpForTest(email);
    assert.match(firstCustomerIdOtp ?? "", /^\d{6}$/);

    const storedOtp = await pool.query<{ otp_hash: string; active_count: string }>(
      `SELECT
         otp_hash,
         COUNT(*) FILTER (WHERE used_at IS NULL)::text AS active_count
       FROM account_recovery_otps
       WHERE user_id = (SELECT user_id FROM users WHERE email = $1)
         AND purpose = 'CUSTOMER_ID'
       GROUP BY otp_hash
       ORDER BY MAX(recovery_otp_id) DESC
       LIMIT 1`,
      [email]
    );
    assert.notEqual(storedOtp.rows[0]?.otp_hash, firstCustomerIdOtp);
    assert.equal(
      await bcrypt.compare(firstCustomerIdOtp!, storedOtp.rows[0]!.otp_hash),
      true
    );
    assert.equal(storedOtp.rows[0]?.active_count, "1");

    const genericUnknown = await request(app)
      .post("/api/v1/auth/recovery/customer-id/request")
      .send({ email: `${prefix}.unknown@example.com`, dateOfBirth });
    assert.equal(genericUnknown.status, 200);
    assert.equal(
      genericUnknown.body.data.message,
      customerIdRequest.body.data.message
    );

    const wrongCustomerIdOtp = await request(app)
      .post("/api/v1/auth/recovery/customer-id/verify")
      .send({
        email,
        dateOfBirth,
        otp: differentOtp(firstCustomerIdOtp!),
      });
    assert.equal(wrongCustomerIdOtp.status, 400);
    assert.equal(
      wrongCustomerIdOtp.body.error.code,
      "INVALID_OR_EXPIRED_RECOVERY_OTP"
    );

    const resendCustomerId = await requestCustomerIdOtp();
    assert.equal(resendCustomerId.status, 200);
    const resentCustomerIdOtp = getCapturedOtpForTest(email);
    assert.match(resentCustomerIdOtp ?? "", /^\d{6}$/);
    assert.notEqual(resentCustomerIdOtp, firstCustomerIdOtp);

    const oldOtpAfterResend = await request(app)
      .post("/api/v1/auth/recovery/customer-id/verify")
      .send({ email, dateOfBirth, otp: firstCustomerIdOtp });
    assert.equal(oldOtpAfterResend.status, 400);

    const recoveredCustomerId = await request(app)
      .post("/api/v1/auth/recovery/customer-id/verify")
      .send({ email, dateOfBirth, otp: resentCustomerIdOtp });
    assert.equal(recoveredCustomerId.status, 200);
    assert.equal(recoveredCustomerId.body.data.customerId, customerId);

    const reusedCustomerIdOtp = await request(app)
      .post("/api/v1/auth/recovery/customer-id/verify")
      .send({ email, dateOfBirth, otp: resentCustomerIdOtp });
    assert.equal(reusedCustomerIdOtp.status, 400);

    await requestCustomerIdOtp();
    const expiredCustomerIdOtp = getCapturedOtpForTest(email);
    await pool.query(
      `UPDATE account_recovery_otps
       SET expires_at = timezone('UTC', now()) - interval '1 second'
       WHERE recovery_otp_id = (
         SELECT recovery_otp_id
         FROM account_recovery_otps
         WHERE user_id = (SELECT user_id FROM users WHERE email = $1)
           AND purpose = 'CUSTOMER_ID'
         ORDER BY recovery_otp_id DESC
         LIMIT 1
       )`,
      [email]
    );
    const expiredCustomerIdResponse = await request(app)
      .post("/api/v1/auth/recovery/customer-id/verify")
      .send({ email, dateOfBirth, otp: expiredCustomerIdOtp });
    assert.equal(expiredCustomerIdResponse.status, 400);

    await requestCustomerIdOtp();
    const limitedCustomerIdOtp = getCapturedOtpForTest(email)!;
    const invalidLimitedOtp = differentOtp(limitedCustomerIdOtp);
    for (let attempt = 1; attempt <= 4; attempt++) {
      const response = await request(app)
        .post("/api/v1/auth/recovery/customer-id/verify")
        .send({ email, dateOfBirth, otp: invalidLimitedOtp });
      assert.equal(response.status, 400);
    }
    const fifthAttempt = await request(app)
      .post("/api/v1/auth/recovery/customer-id/verify")
      .send({ email, dateOfBirth, otp: invalidLimitedOtp });
    assert.equal(fifthAttempt.status, 429);
    assert.equal(
      fifthAttempt.body.error.code,
      "RECOVERY_OTP_ATTEMPTS_EXCEEDED"
    );
    const correctAfterLimit = await request(app)
      .post("/api/v1/auth/recovery/customer-id/verify")
      .send({ email, dateOfBirth, otp: limitedCustomerIdOtp });
    assert.equal(correctAfterLimit.status, 429);

    const passwordRequest = await requestPasswordOtp();
    assert.equal(passwordRequest.status, 200);
    assert.notEqual(passwordRequest.body.data.maskedEmail, email);
    assert.match(passwordRequest.body.data.maskedEmail, /\*+@example\.com$/);
    const passwordOtp = getCapturedOtpForTest(email);
    assert.match(passwordOtp ?? "", /^\d{6}$/);

    const unknownPasswordRequest = await request(app)
      .post("/api/v1/auth/recovery/password/request")
      .send({ customerId: `${prefix}-UNKNOWN`.toUpperCase() });
    assert.equal(unknownPasswordRequest.status, 200);
    assert.equal(
      unknownPasswordRequest.body.data.message,
      passwordRequest.body.data.message
    );

    const wrongPasswordOtp = await request(app)
      .post("/api/v1/auth/recovery/password/verify")
      .send({ customerId, otp: differentOtp(passwordOtp!) });
    assert.equal(wrongPasswordOtp.status, 400);

    const passwordVerification = await request(app)
      .post("/api/v1/auth/recovery/password/verify")
      .send({ customerId, otp: passwordOtp });
    assert.equal(passwordVerification.status, 200);
    const resetToken = passwordVerification.body.data.resetToken as string;
    assert.match(resetToken, /^[a-f0-9]{64}$/);

    const reusedPasswordOtp = await request(app)
      .post("/api/v1/auth/recovery/password/verify")
      .send({ customerId, otp: passwordOtp });
    assert.equal(reusedPasswordOtp.status, 400);

    const reset = await request(app)
      .post("/api/v1/auth/recovery/password/reset")
      .send({ customerId, resetToken, newPassword });
    assert.equal(reset.status, 200);

    const reusedResetToken = await request(app)
      .post("/api/v1/auth/recovery/password/reset")
      .send({ customerId, resetToken, newPassword: originalPassword });
    assert.equal(reusedResetToken.status, 400);
    assert.equal(
      reusedResetToken.body.error.code,
      "INVALID_PASSWORD_RESET_TOKEN"
    );

    const oldPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ customerId, password: originalPassword });
    assert.equal(oldPasswordLogin.status, 401);

    const newPasswordLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ customerId, password: newPassword });
    assert.equal(newPasswordLogin.status, 200);

    const activeRecoveryOtps = await pool.query<{ active_count: string }>(
      `SELECT COUNT(*)::text AS active_count
       FROM account_recovery_otps
       WHERE user_id = (SELECT user_id FROM users WHERE email = $1)
         AND used_at IS NULL
         AND attempts < 5
         AND expires_at > timezone('UTC', now())`,
      [email]
    );
    assert.equal(activeRecoveryOtps.rows[0]?.active_count, "0");
  } finally {
    await cleanupTestData(prefix);
  }
});
