import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/prisma";
import { pool } from "../src/config/db";

const adminCredentials = { customerId: "ADMINLOCAL0001", password: "PiBank@Admin001" };
const customerCredentials = { customerId: "CUSTSOUTH0001", password: "PiBank@Test001" };

async function main() {
  const adminLogin = await request(app).post("/api/v1/auth/login").send(adminCredentials);
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.body.data.user.role, "ADMIN");
  const adminToken = adminLogin.body.data.token as string;
  const auth = { Authorization: `Bearer ${adminToken}` };

  const customerLogin = await request(app).post("/api/v1/auth/login").send(customerCredentials);
  assert.equal(customerLogin.status, 200);
  const denied = await request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${customerLogin.body.data.token}`);
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, "FORBIDDEN");

  const dashboard = await request(app).get("/api/v1/admin/dashboard").set(auth);
  assert.equal(dashboard.status, 200);
  for (const field of ["totalCustomers", "totalAccounts", "totalBalance", "transactionsToday", "activeCards", "branches", "employees", "atms"]) assert.ok(field in dashboard.body.data);

  const customers = await request(app).get("/api/v1/admin/customers").query({ search: "CUSTSOUTH0002", page: 1, limit: 10 }).set(auth);
  assert.equal(customers.status, 200);
  assert.equal(customers.body.data.items.length, 1);
  assert.doesNotMatch(JSON.stringify(customers.body), /password_hash|passwordHash|token/i);
  const customer = customers.body.data.items[0];
  const customerDetail = await request(app).get(`/api/v1/admin/customers/${customer.customerId}`).set(auth);
  assert.equal(customerDetail.status, 200);
  assert.ok(customerDetail.body.data.accounts.length >= 1);

  const blocked = await request(app).patch(`/api/v1/admin/customers/${customer.customerId}/status`).set(auth).send({ status: "BLOCKED" });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.body.data.customer_status, "BLOCKED");
  const unblocked = await request(app).patch(`/api/v1/admin/customers/${customer.customerId}/status`).set(auth).send({ status: "ACTIVE" });
  assert.equal(unblocked.status, 200);

  const accountId = customerDetail.body.data.accounts[0].accountId as string;
  const accountBefore = await prisma.accounts.findUniqueOrThrow({ where: { account_id: BigInt(accountId) }, select: { current_balance: true, available_balance: true } });
  const frozen = await request(app).patch(`/api/v1/admin/accounts/${accountId}/freeze`).set(auth);
  assert.equal(frozen.status, 200);
  assert.equal(frozen.body.data.account_status, "FROZEN");
  const unfrozen = await request(app).patch(`/api/v1/admin/accounts/${accountId}/unfreeze`).set(auth);
  assert.equal(unfrozen.status, 200);
  const accountAfter = await prisma.accounts.findUniqueOrThrow({ where: { account_id: BigInt(accountId) }, select: { current_balance: true, available_balance: true } });
  assert.equal(accountAfter.current_balance.equals(accountBefore.current_balance), true);
  assert.equal(accountAfter.available_balance.equals(accountBefore.available_balance), true);

  const accounts = await request(app).get("/api/v1/admin/accounts").query({ search: "CUSTSOUTH0002" }).set(auth);
  assert.equal(accounts.status, 200);
  assert.ok(accounts.body.data.items.every((item: { maskedAccountNumber: string }) => item.maskedAccountNumber.startsWith("****")));
  const transactions = await request(app).get("/api/v1/admin/transactions").query({ page: 1, limit: 5 }).set(auth);
  assert.equal(transactions.status, 200);
  assert.ok(transactions.body.data.items.length > 0);
  const transactionDetail = await request(app).get(`/api/v1/admin/transactions/${transactions.body.data.items[0].transactionId}`).set(auth);
  assert.equal(transactionDetail.status, 200);
  assert.equal("ledger_entries" in transactionDetail.body.data, false);

  const employees = await request(app).get("/api/v1/admin/employees").query({ page: 1, limit: 5 }).set(auth);
  assert.equal(employees.status, 200);
  assert.ok(employees.body.data.items.length > 0);
  const employee = employees.body.data.items[0];
  const employeeOff = await request(app).patch(`/api/v1/admin/employees/${employee.employeeId}/status`).set(auth).send({ status: "INACTIVE" });
  assert.equal(employeeOff.status, 200);
  const employeeOn = await request(app).patch(`/api/v1/admin/employees/${employee.employeeId}/status`).set(auth).send({ status: "ACTIVE" });
  assert.equal(employeeOn.status, 200);

  const routes = ["branches", "atms", "cards", "audit-logs"];
  const routeResults: Record<string, number> = {};
  for (const route of routes) {
    const response = await request(app).get(`/api/v1/admin/${route}`).query({ page: 1, limit: 5 }).set(auth);
    assert.equal(response.status, 200, route);
    assert.ok(Array.isArray(response.body.data.items));
    routeResults[route] = response.body.data.items.length;
  }
  const audits = await request(app).get("/api/v1/admin/audit-logs").query({ search: "ACCOUNT_", page: 1, limit: 20 }).set(auth);
  assert.equal(audits.status, 200);
  assert.ok(audits.body.data.items.some((item: { action: string }) => item.action === "ACCOUNT_FROZEN"));
  assert.ok(audits.body.data.items.some((item: { action: string }) => item.action === "ACCOUNT_UNFROZEN"));

  console.log(JSON.stringify({ adminLogin: 200, customerAdminAccess: 403, dashboard: 200, customers: 200, customerDetails: 200, customerBlockUnblock: 200, accountFreezeUnfreeze: 200, transactions: 200, transactionDetails: 200, employees: 200, employeeStatus: 200, ...routeResults }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
