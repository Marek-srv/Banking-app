import assert from "node:assert/strict";
import test, { after } from "node:test";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";
import {
  clearCapturedOtpsForTest,
  getCapturedOtpForTest,
} from "../src/services/email.service";
import { cleanupTestData } from "./test-helpers";

process.env.NODE_ENV = "test";

const prefix = `phase2${Date.now().toString(36)}`;
const password = "ApprovalFlow@123";
const primaryEmail = `${prefix}.primary@example.com`;
const rejectedEmail = `${prefix}.rejected@example.com`;

let adminToken = "";
let primaryCustomerId = "";
let primaryCustomerNumber = "";
let primaryToken = "";
let rejectedCustomerId = "";
let rejectedCustomerNumber = "";

after(async () => {
  clearCapturedOtpsForTest();
  await cleanupTestData(prefix);
  await pool.end();
});

async function getAdminToken() {
  if (adminToken) return adminToken;
  const response = await request(app).post("/api/v1/auth/login").send({
    customerId: "ADMINLOCAL0001",
    password: "PiBank@Admin001",
  });
  assert.equal(response.status, 200);
  adminToken = response.body.data.token as string;
  return adminToken;
}

async function completeOnboarding(email: string, mobile: string) {
  const started = await request(app).post("/api/v1/auth/register").send({
    firstName: "Phase",
    lastName: "Customer",
    dateOfBirth: "1994-04-14",
    mobile,
    email,
  });
  assert.equal(started.status, 201);
  const otp = getCapturedOtpForTest(email);
  assert.match(otp ?? "", /^\d{6}$/);

  const verified = await request(app)
    .post("/api/v1/auth/verify-otp")
    .send({ email, otp });
  assert.equal(verified.status, 200);

  const completed = await request(app)
    .post("/api/v1/auth/complete-registration")
    .send({
      registrationToken: verified.body.data.registrationToken,
      password,
      confirmPassword: password,
    });
  assert.equal(completed.status, 201);
  return completed.body.data.customerId as string;
}

test("1. existing registration and OTP completion succeeds", async () => {
  primaryCustomerNumber = await completeOnboarding(primaryEmail, "9123456781");
  assert.match(primaryCustomerNumber, /^CUST\d{8,}$/);
});

test("2. new customer is pending approval with pending KYC and appears in admin review", async () => {
  const record = await pool.query<{
    customer_id: string;
    customer_status: string;
    kyc_status: string;
    user_status: string;
  }>(
    `SELECT c.customer_id::text, c.customer_status::text, c.kyc_status::text,
            u.status AS user_status
     FROM customers c JOIN users u ON u.user_id = c.user_id
     WHERE c.customer_number = $1`,
    [primaryCustomerNumber]
  );
  assert.equal(record.rowCount, 1);
  assert.equal(record.rows[0]?.customer_status, "PENDING_ADMIN_APPROVAL");
  assert.equal(record.rows[0]?.kyc_status, "PENDING");
  assert.equal(record.rows[0]?.user_status, "INACTIVE");
  primaryCustomerId = record.rows[0]!.customer_id;

  const token = await getAdminToken();
  const list = await request(app)
    .get("/api/v1/admin/customers?status=PENDING_ADMIN_APPROVAL&page=1&limit=20")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.ok(list.body.data.items.some((item: any) => item.customerNumber === primaryCustomerNumber));

  const details = await request(app)
    .get(`/api/v1/admin/customers/${primaryCustomerId}`)
    .set("Authorization", `Bearer ${token}`);
  assert.equal(details.status, 200);
  assert.equal(details.body.data.customerStatus, "PENDING_ADMIN_APPROVAL");
  assert.equal(details.body.data.kycStatus, "PENDING");
  assert.equal(details.body.data.rejection.reason, null);
});

test("3. pending customer login is blocked", async () => {
  const response = await request(app).post("/api/v1/auth/login").send({
    customerId: primaryCustomerNumber,
    password,
  });
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "CUSTOMER_PENDING_ADMIN_APPROVAL");
  assert.equal(response.body.data?.token, undefined);
});

test("4. admin marks KYC verified and history is appended", async () => {
  const response = await request(app)
    .patch(`/api/v1/admin/customers/${primaryCustomerId}/kyc`)
    .set("Authorization", `Bearer ${await getAdminToken()}`)
    .send({ status: "VERIFIED" });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.kyc_status, "VERIFIED");

  const history = await pool.query(
    `SELECT 1 FROM customer_kyc_status_history
     WHERE customer_id = $1 AND previous_status = 'PENDING' AND new_status = 'VERIFIED'`,
    [primaryCustomerId]
  );
  assert.equal(history.rowCount, 1);
});

test("5. admin approves customer after KYC verification", async () => {
  const response = await request(app)
    .post(`/api/v1/admin/customers/${primaryCustomerId}/approve`)
    .set("Authorization", `Bearer ${await getAdminToken()}`)
    .send({});
  assert.equal(response.status, 200);
  assert.equal(response.body.data.customer_status, "ACTIVE");
  assert.ok(response.body.data.approved_at);

  const audit = await pool.query(
    "SELECT 1 FROM audit_logs WHERE action = 'CUSTOMER_APPROVED' AND entity_id = $1",
    [primaryCustomerId]
  );
  assert.equal(audit.rowCount, 1);
});

test("6. approved active customer can login", async () => {
  const response = await request(app).post("/api/v1/auth/login").send({
    customerId: primaryCustomerNumber,
    password,
  });
  assert.equal(response.status, 200);
  primaryToken = response.body.data.token as string;
  assert.ok(primaryToken);
});

test("7. admin rejects another pending customer with a reason", async () => {
  rejectedCustomerNumber = await completeOnboarding(rejectedEmail, "9123456782");
  const record = await pool.query<{ customer_id: string }>(
    "SELECT customer_id::text FROM customers WHERE customer_number = $1",
    [rejectedCustomerNumber]
  );
  rejectedCustomerId = record.rows[0]!.customer_id;

  const response = await request(app)
    .post(`/api/v1/admin/customers/${rejectedCustomerId}/reject`)
    .set("Authorization", `Bearer ${await getAdminToken()}`)
    .send({ reason: "Identity details could not be validated" });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.customer_status, "REJECTED");
  assert.equal(response.body.data.rejection_reason, "Identity details could not be validated");
});

test("8. rejected customer login and cooling-period re-registration are blocked", async () => {
  const login = await request(app).post("/api/v1/auth/login").send({
    customerId: rejectedCustomerNumber,
    password,
  });
  assert.equal(login.status, 403);
  assert.equal(login.body.error.code, "CUSTOMER_REGISTRATION_REJECTED");

  const retry = await request(app).post("/api/v1/auth/register").send({
    firstName: "Phase",
    lastName: "Customer",
    dateOfBirth: "1994-04-14",
    mobile: "9123456782",
    email: rejectedEmail,
  });
  assert.equal(retry.status, 409);
  assert.equal(retry.body.error.code, "REGISTRATION_COOLING_PERIOD");
});

test("9. admin block and unblock works for an active customer", async () => {
  const blocked = await request(app)
    .post(`/api/v1/admin/customers/${primaryCustomerId}/block`)
    .set("Authorization", `Bearer ${await getAdminToken()}`)
    .send({ reason: "Focused Phase 2 security review" });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.body.data.customer_status, "BLOCKED");
  assert.equal(blocked.body.data.block_reason, "Focused Phase 2 security review");

  const unblocked = await request(app)
    .post(`/api/v1/admin/customers/${primaryCustomerId}/unblock`)
    .set("Authorization", `Bearer ${await getAdminToken()}`)
    .send({});
  assert.equal(unblocked.status, 200);
  assert.equal(unblocked.body.data.customer_status, "ACTIVE");

  const login = await request(app).post("/api/v1/auth/login").send({
    customerId: primaryCustomerNumber,
    password,
  });
  assert.equal(login.status, 200);
  primaryToken = login.body.data.token as string;
});

test("10. approved customer existing protected APIs remain available", async () => {
  for (const path of ["customers/me", "accounts", "transactions", "cards"]) {
    const response = await request(app)
      .get(`/api/v1/${path}`)
      .set("Authorization", `Bearer ${primaryToken}`);
    assert.equal(response.status, 200, path);
  }
});
