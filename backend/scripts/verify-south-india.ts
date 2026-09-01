import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";
import { prisma } from "../src/config/prisma";

const branchCodes = [
  "PIBK0000001",
  "PIBK0000002",
  "PIBK0000003",
  "PIBK0000004",
  "PIBK0000005",
];
const emailSuffix = "@seed.pi-bank.test";

async function scalarCount(query: string, parameters: unknown[] = []): Promise<number> {
  const result = await pool.query<{ count: number }>(query, parameters);
  return Number(result.rows[0]?.count ?? 0);
}

async function main() {
  const seededUserCount = await prisma.users.count({
    where: { email: { endsWith: emailSuffix } },
  });
  const seededAdminCount = await prisma.users.count({
    where: { email: { endsWith: emailSuffix }, role: "ADMIN" },
  });
  assert.equal(seededUserCount, 11, "Expected 10 customer users and 1 admin user");
  assert.equal(seededAdminCount, 1, "Expected exactly 1 seeded admin user");

  const seedUsers = await prisma.users.findMany({
    where: { email: { endsWith: emailSuffix }, role: "CUSTOMER" },
    include: { customers: true },
    orderBy: { email: "asc" },
  });
  assert.equal(seedUsers.length, 10, "Expected 10 seeded customer users");

  const adminUser = await prisma.users.findUnique({
    where: { email: "admin@seed.pi-bank.test" },
    include: { customers: true },
  });
  assert.ok(adminUser, "Expected one seeded admin user");
  assert.equal(adminUser.role, "ADMIN");
  assert.equal(adminUser.status, "ACTIVE");
  assert.equal(adminUser.email_verified, true);
  assert.ok(adminUser.email_verified_at);
  assert.ok(adminUser.customers);
  assert.equal(adminUser.customers.customer_number, "ADMINLOCAL0001");
  assert.equal(
    await bcrypt.compare("PiBank@LocalAdmin26", adminUser.password_hash),
    true,
    "Admin password mismatch"
  );

  for (const user of seedUsers) {
    assert.equal(user.status, "ACTIVE");
    assert.equal(user.role, "CUSTOMER");
    assert.equal(user.email_verified, true);
    assert.ok(user.email_verified_at);
    assert.ok(user.customers);
    assert.equal(user.customers.user_id, user.user_id);
    assert.match(user.customers.customer_number, /^CUSTSOUTH\d{4}$/);
    assert.equal(user.customers.customer_status, "ACTIVE");
    assert.equal(user.customers.kyc_status, "VERIFIED");

    const credentialIndex = Number(user.customers.customer_number.slice(-4));
    const password = `PiBank@Test${String(credentialIndex).padStart(3, "0")}`;
    assert.equal(await bcrypt.compare(password, user.password_hash), true, `Password mismatch for ${user.customers.customer_number}`);
  }
  assert.deepEqual(
    seedUsers.map((user) => user.customers!.customer_number).sort(),
    Array.from({ length: 10 }, (_, index) => `CUSTSOUTH${String(index + 1).padStart(4, "0")}`)
  );

  const customerIds = seedUsers.map((user) => user.customers!.customer_id);
  const seedAccounts = await prisma.accounts.findMany({
    where: { customer_id: { in: customerIds } },
    orderBy: { account_id: "asc" },
  });
  const depositAccounts = seedAccounts.filter(
    (account) => account.account_type === "SAVINGS" || account.account_type === "CURRENT"
  );
  const loanAccounts = seedAccounts.filter((account) => account.account_type === "LOAN");

  const transactionCount = await scalarCount("SELECT COUNT(*)::int AS count FROM transactions WHERE reference_number LIKE 'SEED-%'");
  const totalTransactionCount = await prisma.transactions.count({
    where: {
      OR: [
        { source_account_id: { in: seedAccounts.map((account) => account.account_id) } },
        { destination_account_id: { in: seedAccounts.map((account) => account.account_id) } },
      ],
    },
  });
  const seedBeneficiaries = await prisma.beneficiaries.findMany({
    where: { customer_id: { in: customerIds } },
    select: { customer_id: true },
  });
  const beneficiaryCount = seedBeneficiaries.length;
  const cardCount = await prisma.cards.count({ where: { account_id: { in: seedAccounts.map((account) => account.account_id) } } });
  const activeCardCount = await prisma.cards.count({
    where: {
      account_id: { in: seedAccounts.map((account) => account.account_id) },
      card_status: "ACTIVE",
    },
  });
  const loanCount = await prisma.loans.count({ where: { customer_id: { in: customerIds } } });
  const activeLoanCount = await prisma.loans.count({ where: { customer_id: { in: customerIds }, status: "ACTIVE" } });
  const overdueLoanCount = await prisma.loans.count({ where: { customer_id: { in: customerIds }, status: "OVERDUE" } });
  const foreclosedLoanCount = await prisma.loans.count({ where: { customer_id: { in: customerIds }, status: "FORECLOSED" } });
  const emiCount = await prisma.loan_emi_schedules.count({ where: { loans: { customer_id: { in: customerIds } } } });
  const pendingEmiCount = await prisma.loan_emi_schedules.count({ where: { loans: { customer_id: { in: customerIds } }, status: "PENDING" } });
  const paidEmiCount = await prisma.loan_emi_schedules.count({ where: { loans: { customer_id: { in: customerIds } }, status: "PAID" } });
  const overdueEmiCount = await prisma.loan_emi_schedules.count({ where: { loans: { customer_id: { in: customerIds } }, status: "OVERDUE" } });
  const cancelledEmiCount = await prisma.loan_emi_schedules.count({ where: { loans: { customer_id: { in: customerIds } }, status: "CANCELLED" } });
  const loanRequestCount = await prisma.loan_requests.count({ where: { customer_id: { in: customerIds } } });
  const approvedLoanRequestCount = await prisma.loan_requests.count({ where: { customer_id: { in: customerIds }, status: "APPROVED" } });
  const pendingLoanRequestCount = await prisma.loan_requests.count({ where: { customer_id: { in: customerIds }, status: "PENDING" } });
  const cardRequestCount = await prisma.card_requests.count({ where: { customer_id: { in: customerIds } } });
  const approvedCardRequestCount = await prisma.card_requests.count({ where: { customer_id: { in: customerIds }, status: "APPROVED" } });
  const pendingCardRequestCount = await prisma.card_requests.count({ where: { customer_id: { in: customerIds }, status: "PENDING" } });
  const rejectedCardRequestCount = await prisma.card_requests.count({ where: { customer_id: { in: customerIds }, status: "REJECTED" } });
  const accountRequestCount = await prisma.account_requests.count({ where: { customer_id: { in: customerIds } } });
  const approvedAccountRequestCount = await prisma.account_requests.count({ where: { customer_id: { in: customerIds }, status: "APPROVED" } });
  const pendingAccountRequestCount = await prisma.account_requests.count({ where: { customer_id: { in: customerIds }, status: "PENDING" } });
  const rejectedAccountRequestCount = await prisma.account_requests.count({ where: { customer_id: { in: customerIds }, status: "REJECTED" } });
  const invalidLoanAccountRows = await scalarCount(
    `SELECT COUNT(*)::int AS count
     FROM loans l
     JOIN accounts a ON a.account_id = l.account_id
     WHERE l.customer_id = ANY($1::bigint[])
       AND (a.account_type <> 'LOAN'
         OR a.available_balance <> 0
         OR a.current_balance <> l.outstanding_principal)`,
    [customerIds.map((customerId) => customerId.toString())]
  );
  const invalidLoanRequestLinks = await scalarCount(
    `SELECT COUNT(*)::int AS count
     FROM loan_requests lr
     LEFT JOIN loans l ON l.loan_request_id = lr.loan_request_id
     WHERE lr.customer_id = ANY($1::bigint[])
       AND ((lr.status = 'APPROVED' AND l.loan_id IS NULL)
         OR (lr.status <> 'APPROVED' AND l.loan_id IS NOT NULL))`,
    [customerIds.map((customerId) => customerId.toString())]
  );
  const invalidCardRequestLinks = await scalarCount(
    `SELECT COUNT(*)::int AS count
     FROM card_requests cr
     WHERE cr.customer_id = ANY($1::bigint[])
       AND ((cr.status = 'APPROVED' AND cr.approved_card_id IS NULL)
         OR (cr.status <> 'APPROVED' AND cr.approved_card_id IS NOT NULL))`,
    [customerIds.map((customerId) => customerId.toString())]
  );
  const invalidAccountRequestLinks = await scalarCount(
    `SELECT COUNT(*)::int AS count
     FROM account_requests ar
     WHERE ar.customer_id = ANY($1::bigint[])
       AND ((ar.status = 'APPROVED' AND ar.approved_account_id IS NULL)
         OR (ar.status <> 'APPROVED' AND ar.approved_account_id IS NOT NULL))`,
    [customerIds.map((customerId) => customerId.toString())]
  );
  const branchCount = await prisma.branches.count({ where: { branch_code: { in: branchCodes } } });
  const branchRows = await prisma.branches.findMany({ where: { branch_code: { in: branchCodes } }, select: { branch_id: true, branch_code: true, manager_id: true } });
  const branchIds = branchRows.map((branch) => branch.branch_id);
  const seedEmployees = await prisma.employees.findMany({ where: { branch_id: { in: branchIds } }, select: { branch_id: true } });
  const seedAtms = await prisma.atms.findMany({ where: { branch_id: { in: branchIds } }, select: { branch_id: true } });
  const employeeCount = seedEmployees.length;
  const atmCount = seedAtms.length;

  const diagnosticSummary = {
    users: seededUserCount,
    customers: seedUsers.length,
    admins: seededAdminCount,
    branches: branchCount,
    depositAccounts: depositAccounts.length,
    loanAccounts: loanAccounts.length,
    baseTransactions: transactionCount,
    totalTransactions: totalTransactionCount,
    beneficiaries: beneficiaryCount,
    cards: cardCount,
    loansByStatus: {
      ACTIVE: activeLoanCount,
      OVERDUE: overdueLoanCount,
      FORECLOSED: foreclosedLoanCount,
    },
    emisByStatus: {
      PENDING: pendingEmiCount,
      PAID: paidEmiCount,
      OVERDUE: overdueEmiCount,
      CANCELLED: cancelledEmiCount,
    },
    loanRequestsByStatus: {
      APPROVED: approvedLoanRequestCount,
      PENDING: pendingLoanRequestCount,
    },
    cardRequestsByStatus: {
      APPROVED: approvedCardRequestCount,
      PENDING: pendingCardRequestCount,
      REJECTED: rejectedCardRequestCount,
    },
    accountRequestsByStatus: {
      APPROVED: approvedAccountRequestCount,
      PENDING: pendingAccountRequestCount,
      REJECTED: rejectedAccountRequestCount,
    },
    employees: employeeCount,
    atms: atmCount,
  };
  console.log(JSON.stringify(diagnosticSummary, null, 2));

  assert.equal(seedAccounts.length, 21);
  assert.equal(depositAccounts.length, 15);
  assert.equal(loanAccounts.length, 6);
  for (const user of seedUsers) {
    const customer = user.customers!;
    const credentialIndex = Number(customer.customer_number.slice(-4));
    const expectedCount = [2, 4, 7, 8, 10].includes(credentialIndex) ? 2 : 1;
    const count = depositAccounts.filter((account) => account.customer_id === customer.customer_id).length;
    assert.equal(count, expectedCount, `Invalid deposit account count for ${customer.customer_number}`);
  }
  for (const account of depositAccounts) {
    assert.ok(account.current_balance.greaterThanOrEqualTo(10_000));
    assert.ok(account.current_balance.lessThanOrEqualTo(500_000));
    assert.equal(account.current_balance.equals(account.available_balance), true);
    assert.equal(account.currency, "INR");
    assert.ok(account.account_type === "SAVINGS" || account.account_type === "CURRENT");
  }
  for (const account of loanAccounts) {
    assert.equal(account.available_balance.equals(0), true);
    assert.equal(account.currency, "INR");
  }
  assert.equal(transactionCount, 105);
  assert.equal(totalTransactionCount, 117);
  assert.equal(beneficiaryCount, 20);
  assert.equal(cardCount, 12);
  assert.equal(activeCardCount, 12);
  assert.equal(loanCount, 6);
  assert.equal(activeLoanCount, 5);
  assert.equal(overdueLoanCount, 1);
  assert.equal(foreclosedLoanCount, 0);
  assert.equal(emiCount, 240);
  assert.equal(pendingEmiCount, 235);
  assert.equal(paidEmiCount, 4);
  assert.equal(overdueEmiCount, 1);
  assert.equal(cancelledEmiCount, 0);
  assert.equal(loanRequestCount, 7);
  assert.equal(approvedLoanRequestCount, 6);
  assert.equal(pendingLoanRequestCount, 1);
  assert.equal(cardRequestCount, 14);
  assert.equal(approvedCardRequestCount, 12);
  assert.equal(pendingCardRequestCount, 1);
  assert.equal(rejectedCardRequestCount, 1);
  assert.equal(accountRequestCount, 3);
  assert.equal(approvedAccountRequestCount, 1);
  assert.equal(pendingAccountRequestCount, 1);
  assert.equal(rejectedAccountRequestCount, 1);
  assert.equal(invalidLoanAccountRows, 0);
  assert.equal(invalidLoanRequestLinks, 0);
  assert.equal(invalidCardRequestLinks, 0);
  assert.equal(invalidAccountRequestLinks, 0);
  assert.equal(branchCount, 5);
  assert.deepEqual(branchRows.map((branch) => branch.branch_code).sort(), [...branchCodes].sort());
  assert.equal(employeeCount, 25);
  assert.equal(atmCount, 10);
  assert.equal(branchRows.every((branch) => branch.manager_id !== null), true);
  for (const branch of branchRows) {
    assert.equal(seedEmployees.filter((employee) => employee.branch_id === branch.branch_id).length, 5);
    assert.equal(seedAtms.filter((atm) => atm.branch_id === branch.branch_id).length, 2);
  }
  for (const user of seedUsers) {
    const customer = user.customers!;
    assert.equal(branchIds.includes(customer.branch_id), true);
    assert.equal(seedBeneficiaries.filter((beneficiary) => beneficiary.customer_id === customer.customer_id).length, 2);
  }

  const invalidLedgerRows = await scalarCount(
    `SELECT COUNT(*)::int AS count
     FROM ledger_entries le
     JOIN transactions t ON t.transaction_id = le.transaction_id
     WHERE le.account_id = ANY($1::bigint[])
       AND (le.amount <= 0 OR le.entry_type NOT IN ('DEBIT', 'CREDIT')
         OR (le.entry_type = 'DEBIT' AND le.balance_after <> le.balance_before - le.amount)
         OR (le.entry_type = 'CREDIT' AND le.balance_after <> le.balance_before + le.amount))`
    , [seedAccounts.map((account) => account.account_id.toString())]
  );
  const completedWithoutTimestamp = await scalarCount(
    `SELECT COUNT(*)::int AS count
     FROM transactions
     WHERE (source_account_id = ANY($1::bigint[]) OR destination_account_id = ANY($1::bigint[]))
       AND status = 'COMPLETED'
       AND completed_at IS NULL`,
    [seedAccounts.map((account) => account.account_id.toString())]
  );
  const unbalancedTransfers = await scalarCount(
    `SELECT COUNT(*)::int AS count FROM (
       SELECT t.transaction_id
       FROM transactions t
       JOIN ledger_entries le ON le.transaction_id = t.transaction_id
       WHERE t.reference_number LIKE 'SEED-%' AND t.transaction_type = 'TRANSFER' AND t.status = 'COMPLETED'
       GROUP BY t.transaction_id
       HAVING SUM(CASE WHEN le.entry_type = 'DEBIT' THEN le.amount ELSE 0 END)
            <> SUM(CASE WHEN le.entry_type = 'CREDIT' THEN le.amount ELSE 0 END)
          OR COUNT(*) FILTER (WHERE le.entry_type = 'DEBIT') <> 1
          OR COUNT(*) FILTER (WHERE le.entry_type = 'CREDIT') <> 1
     ) violations`
  );
  const latestBalanceMismatches = await scalarCount(
    `SELECT COUNT(*)::int AS count
     FROM accounts a
     JOIN LATERAL (
       SELECT le.balance_after
       FROM ledger_entries le
       WHERE le.account_id = a.account_id
       ORDER BY le.created_at DESC, le.ledger_entry_id DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE a.account_id = ANY($1::bigint[]) AND a.current_balance <> latest.balance_after`,
    [seedAccounts.map((account) => account.account_id.toString())]
  );
  const invalidCustomerTransactionCounts = await scalarCount(
    `SELECT COUNT(*)::int AS count FROM (
       SELECT c.customer_id, COUNT(DISTINCT t.transaction_id) AS transaction_count
       FROM customers c
       JOIN accounts a ON a.customer_id = c.customer_id
       LEFT JOIN transactions t
         ON (t.source_account_id = a.account_id OR t.destination_account_id = a.account_id)
        AND t.reference_number LIKE 'SEED-%'
       WHERE c.customer_id = ANY($1::bigint[])
       GROUP BY c.customer_id
       HAVING COUNT(DISTINCT t.transaction_id) < 10 OR COUNT(DISTINCT t.transaction_id) > 30
     ) violations`,
    [customerIds.map((customerId) => customerId.toString())]
  );
  assert.equal(invalidLedgerRows, 0);
  assert.equal(completedWithoutTimestamp, 0);
  assert.equal(unbalancedTransfers, 0);
  assert.equal(latestBalanceMismatches, 0);
  assert.equal(invalidCustomerTransactionCounts, 0);

  const apiChecks = [];
  for (const credentialIndex of [1, 5, 10]) {
    const customerId = `CUSTSOUTH${String(credentialIndex).padStart(4, "0")}`;
    const password = `PiBank@Test${String(credentialIndex).padStart(3, "0")}`;
    const loginResponse = await request(app).post("/api/v1/auth/login").send({ customerId, password });
    assert.equal(loginResponse.status, 200, `Login failed for ${customerId}`);
    assert.equal(typeof loginResponse.body.data?.token, "string");
    const token = loginResponse.body.data.token as string;

    const customerResponse = await request(app).get("/api/v1/customers/me").set("Authorization", `Bearer ${token}`);
    assert.equal(customerResponse.status, 200);
    assert.equal(customerResponse.body.data?.customer_number, customerId);

    const accountsResponse = await request(app).get("/api/v1/accounts").set("Authorization", `Bearer ${token}`);
    assert.equal(accountsResponse.status, 200);
    assert.ok(Array.isArray(accountsResponse.body.data));
    const customer = seedUsers.find((user) => user.customers?.customer_number === customerId)?.customers;
    assert.ok(customer, `Missing seeded customer ${customerId}`);
    const expectedAccountCount = seedAccounts.filter(
      (account) => account.customer_id === customer.customer_id
    ).length;
    assert.equal(accountsResponse.body.data.length, expectedAccountCount);
    apiChecks.push({ customerId, login: 200, customer: 200, accounts: 200 });
  }

  const adminLogin = await request(app).post("/api/v1/auth/login").send({
    customerId: "ADMINLOCAL0001",
    password: "PiBank@LocalAdmin26",
  });
  assert.equal(adminLogin.status, 200, "Admin login failed");
  assert.equal(adminLogin.body.data?.user?.role, "ADMIN");
  assert.equal(typeof adminLogin.body.data?.token, "string");

  const adminDashboard = await request(app)
    .get("/api/v1/admin/dashboard")
    .set("Authorization", `Bearer ${adminLogin.body.data.token}`);
  assert.equal(adminDashboard.status, 200, "Admin dashboard access failed");

  console.log(JSON.stringify({
    customers: seedUsers.length,
    adminUsers: 1,
    accounts: seedAccounts.length,
    depositAccounts: depositAccounts.length,
    loanAccounts: loanAccounts.length,
    transactions: transactionCount,
    totalTransactions: totalTransactionCount,
    beneficiaries: beneficiaryCount,
    cards: cardCount,
    loans: loanCount,
    emis: emiCount,
    loanRequests: loanRequestCount,
    cardRequests: cardRequestCount,
    accountRequests: accountRequestCount,
    branches: branchCount,
    employees: employeeCount,
    atms: atmCount,
    credentialsValidated: seedUsers.length,
    adminValidated: true,
    integrity: {
      invalidLedgerRows,
      completedWithoutTimestamp,
      unbalancedTransfers,
      latestBalanceMismatches,
      invalidCustomerTransactionCounts,
    },
    apiChecks,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
