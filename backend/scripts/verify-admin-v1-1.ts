import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";
import { cleanupTestData, completeTestRegistration } from "../tests/test-helpers";

const stamp = Date.now().toString(36).toUpperCase();
const adminCredentials = { customerId: "ADMINLOCAL0001", password: "PiBank@Admin001" };
const customerCredentials = { customerId: "CUSTSOUTH0001", password: "PiBank@Test001" };
const roleFixturePrefix = `v11role${Date.now().toString(36)}`;
const roleFixturePassword = "StrongPassword123!";

async function login(credentials: { customerId: string; password: string }) {
  const response = await request(app).post("/api/v1/auth/login").send(credentials);
  assert.equal(response.status, 200);
  return response.body.data.token as string;
}

async function cleanupOperationFixtures() {
  const branches = await pool.query<{ branch_id: string }>("SELECT branch_id::text FROM branches WHERE (branch_code LIKE 'V11A%' OR branch_code LIKE 'V11B%') AND NOT EXISTS (SELECT 1 FROM customers c WHERE c.branch_id=branches.branch_id) AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.branch_id=branches.branch_id)");
  const branchIds = branches.rows.map((row) => row.branch_id);
  if (branchIds.length) {
    await pool.query("UPDATE branches SET manager_id=NULL WHERE branch_id=ANY($1::bigint[])", [branchIds]);
    await pool.query("DELETE FROM atms WHERE branch_id=ANY($1::bigint[])", [branchIds]);
    await pool.query("DELETE FROM employees WHERE branch_id=ANY($1::bigint[])", [branchIds]);
    await pool.query("DELETE FROM branches WHERE branch_id=ANY($1::bigint[])", [branchIds]);
  }
  await pool.query("DELETE FROM accounts a USING customers c, users u WHERE a.customer_id=c.customer_id AND c.user_id=u.user_id AND u.email='admin.local@seed.pi-bank.test' AND a.account_status='CLOSED' AND a.current_balance=0 AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.account_id=a.account_id) AND NOT EXISTS (SELECT 1 FROM cards ca WHERE ca.account_id=a.account_id)");
}

async function main() {
  await cleanupOperationFixtures();
  const adminToken = await login(adminCredentials);
  const auth = { Authorization: `Bearer ${adminToken}` };
  const customerToken = await login(customerCredentials);
  const deniedCustomer = await request(app).post("/api/v1/admin/branches").set("Authorization", `Bearer ${customerToken}`).send({ branchCode: `DENY${stamp}`, branchName: "Denied Branch" });
  assert.equal(deniedCustomer.status, 403);

  const roleFixture = await completeTestRegistration(`${roleFixturePrefix}@example.com`, roleFixturePassword);
  await pool.query("UPDATE users SET role='EMPLOYEE', token_version=token_version+1 WHERE email=$1", [roleFixture.normalizedEmail]);
  const employeeToken = await login({ customerId: roleFixture.customerNumber, password: roleFixturePassword });
  const deniedEmployee = await request(app).post("/api/v1/admin/branches").set("Authorization", `Bearer ${employeeToken}`).send({ branchCode: `DENYEMP${stamp}`, branchName: "Denied Employee Branch" });
  assert.equal(deniedEmployee.status, 403);

  const branchA = await request(app).post("/api/v1/admin/branches").set(auth).send({ branchCode: `V11A${stamp}`, branchName: "Pi Bank V1.1 North", address: "11 Operations Road", city: "Mysuru", state: "Karnataka", postalCode: "570001", phone: "08214000111", email: `v11a.${stamp.toLowerCase()}@seed.pi-bank.test`, operatingHours: "09:30-16:30" });
  const branchB = await request(app).post("/api/v1/admin/branches").set(auth).send({ branchCode: `V11B${stamp}`, branchName: "Pi Bank V1.1 South", city: "Mysuru", state: "Karnataka" });
  assert.equal(branchA.status, 201); assert.equal(branchB.status, 201);
  const branchAId = branchA.body.data.branch_id as string; const branchBId = branchB.body.data.branch_id as string;
  const branchEdit = await request(app).patch(`/api/v1/admin/branches/${branchAId}`).set(auth).send({ branchName: "Pi Bank V1.1 Central", operatingHours: "09:00-17:00" });
  assert.equal(branchEdit.status, 200); assert.equal(branchEdit.body.data.branch_name, "Pi Bank V1.1 Central");
  assert.equal((await request(app).patch(`/api/v1/admin/branches/${branchAId}/status`).set(auth).send({ status: "INACTIVE" })).status, 200);
  assert.equal((await request(app).patch(`/api/v1/admin/branches/${branchAId}/status`).set(auth).send({ status: "ACTIVE" })).status, 200);

  const employee = await request(app).post("/api/v1/admin/employees").set(auth).send({ branchId: branchAId, employeeNumber: `V11EMP${stamp}`, firstName: "Anil", lastName: "Kumar", position: "Customer Service Officer", email: `v11emp.${stamp.toLowerCase()}@seed.pi-bank.test` });
  assert.equal(employee.status, 201);
  const employeeId = employee.body.data.employee_id as string;
  const employeeEdit = await request(app).patch(`/api/v1/admin/employees/${employeeId}`).set(auth).send({ branchId: branchBId, position: "Branch Manager", phone: "9000000789" });
  assert.equal(employeeEdit.status, 200); assert.equal(employeeEdit.body.data.branch_id, branchBId);
  assert.equal((await request(app).patch(`/api/v1/admin/employees/${employeeId}/status`).set(auth).send({ status: "INACTIVE" })).status, 200);
  assert.equal((await request(app).patch(`/api/v1/admin/employees/${employeeId}/status`).set(auth).send({ status: "ACTIVE" })).status, 200);
  const manager = await request(app).patch(`/api/v1/admin/branches/${branchBId}/manager`).set(auth).send({ managerId: employeeId });
  assert.equal(manager.status, 200); assert.equal(manager.body.data.manager_id, employeeId);

  const atm = await request(app).post("/api/v1/admin/atms").set(auth).send({ branchId: branchAId, atmCode: `V11ATM${stamp}`, location: "Mysuru Operations Centre", status: "ACTIVE", operatingHours: "24x7", supportedTransactions: "Cash Withdrawal, Balance Enquiry" });
  assert.equal(atm.status, 201);
  const atmId = atm.body.data.atm_id as string;
  const atmEdit = await request(app).patch(`/api/v1/admin/atms/${atmId}`).set(auth).send({ branchId: branchBId, location: "Mysuru Railway Station Road" });
  assert.equal(atmEdit.status, 200); assert.equal(atmEdit.body.data.branch_id, branchBId);
  for (const status of ["MAINTENANCE", "OUT_OF_SERVICE", "ACTIVE"]) assert.equal((await request(app).patch(`/api/v1/admin/atms/${atmId}/status`).set(auth).send({ status })).status, 200);

  const customer = await pool.query<{ customer_id: string }>("SELECT customer_id::text FROM customers WHERE customer_number='CUSTSOUTH0002'");
  const customerId = customer.rows[0]!.customer_id;
  assert.equal((await request(app).patch(`/api/v1/admin/customers/${customerId}/status`).set(auth).send({ status: "BLOCKED" })).status, 200);
  assert.equal((await request(app).patch(`/api/v1/admin/customers/${customerId}/status`).set(auth).send({ status: "ACTIVE" })).status, 200);
  const account = await pool.query<{ account_id: string }>("SELECT account_id::text FROM accounts a JOIN customers c ON c.customer_id=a.customer_id WHERE c.customer_number='CUSTSOUTH0002' ORDER BY account_id LIMIT 1");
  const accountId = account.rows[0]!.account_id;
  assert.equal((await request(app).patch(`/api/v1/admin/accounts/${accountId}/freeze`).set(auth)).status, 200);
  assert.equal((await request(app).patch(`/api/v1/admin/accounts/${accountId}/unfreeze`).set(auth)).status, 200);

  const zeroAccount = await request(app).post("/api/v1/accounts").set(auth).send({ accountType: "SAVINGS" });
  assert.equal(zeroAccount.status, 201);
  const zeroAccountId = zeroAccount.body.data.account_id as string;
  const closed = await request(app).patch(`/api/v1/admin/accounts/${zeroAccountId}/close`).set(auth);
  assert.equal(closed.status, 200); assert.equal(closed.body.data.account_status, "CLOSED");
  const closeFunded = await request(app).patch(`/api/v1/admin/accounts/${accountId}/close`).set(auth);
  assert.equal(closeFunded.status, 409); assert.equal(closeFunded.body.error.code, "ACCOUNT_CANNOT_CLOSE_WITH_BALANCE");

  const actions = ["BRANCH_CREATED", "BRANCH_UPDATED", "BRANCH_STATUS_CHANGED", "ATM_CREATED", "ATM_UPDATED", "ATM_STATUS_CHANGED", "EMPLOYEE_CREATED", "EMPLOYEE_UPDATED", "EMPLOYEE_STATUS_CHANGED", "CUSTOMER_BLOCKED", "CUSTOMER_UNBLOCKED", "ACCOUNT_FROZEN", "ACCOUNT_UNFROZEN", "ACCOUNT_CLOSED"];
  const audits = await pool.query<{ action: string }>("SELECT action FROM audit_logs WHERE user_id=(SELECT user_id FROM users WHERE email='admin.local@seed.pi-bank.test')");
  for (const action of actions) assert.ok(audits.rows.some((row) => row.action === action), `Missing audit ${action}`);

  await pool.query("UPDATE branches SET manager_id=NULL WHERE branch_id=$1", [branchBId]);
  await pool.query("DELETE FROM atms WHERE atm_id=$1", [atmId]);
  await pool.query("DELETE FROM employees WHERE employee_id=$1", [employeeId]);
  await pool.query("DELETE FROM branches WHERE branch_id=ANY($1::bigint[])", [[branchAId, branchBId]]);
  await pool.query("DELETE FROM accounts WHERE account_id=$1", [zeroAccountId]);

  console.log(JSON.stringify({ branchCreateEdit: "PASS", managerAssignment: "PASS", atmCreateUpdateStatus: "PASS", employeeCreateUpdateMoveStatus: "PASS", customerBlockUnblock: "PASS", accountFreezeUnfreezeCloseRules: "PASS", customerAdminDenied: 403, employeeAdminDenied: 403, audits: "PASS" }, null, 2));
}

main().catch(async (error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await cleanupOperationFixtures().catch(() => undefined); await cleanupTestData(roleFixturePrefix).catch(() => undefined); await pool.end(); });
