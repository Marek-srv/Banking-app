import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app";
import { pool } from "../src/config/db";
import { prisma } from "../src/config/prisma";

const customerPassword = (index: number) => `PiBank@Test${String(index).padStart(3, "0")}`;

async function main() {
  const counts = (await pool.query(`
    SELECT
      (SELECT count(*)::int FROM users WHERE role='ADMIN') admins,
      (SELECT count(*)::int FROM users WHERE role='CUSTOMER') customers,
      (SELECT count(*)::int FROM branches) branches,
      (SELECT count(*)::int FROM accounts WHERE account_type='SAVINGS') savings,
      (SELECT count(*)::int FROM accounts WHERE account_type='CURRENT') current_accounts,
      (SELECT count(*)::int FROM accounts WHERE account_type='LOAN') loan_accounts,
      (SELECT count(*)::int FROM loans) loans,
      (SELECT count(*)::int FROM loan_emi_schedules) emis,
      (SELECT count(*)::int FROM cards) cards,
      (SELECT count(*)::int FROM card_requests) card_requests,
      (SELECT count(*)::int FROM beneficiaries) beneficiaries,
      (SELECT count(*)::int FROM transactions) transactions,
      (SELECT count(*)::int FROM ledger_entries) ledger_entries,
      (SELECT count(*)::int FROM employees) employees,
      (SELECT count(*)::int FROM atms) atms
  `)).rows[0];
  assert.deepEqual({ admins: counts.admins, customers: counts.customers, branches: counts.branches, savings: counts.savings, current: counts.current_accounts, loanAccounts: counts.loan_accounts, loans: counts.loans, cards: counts.cards, cardRequests: counts.card_requests, beneficiaries: counts.beneficiaries, employees: counts.employees, atms: counts.atms }, { admins: 1, customers: 10, branches: 5, savings: 10, current: 5, loanAccounts: 6, loans: 6, cards: 12, cardRequests: 14, beneficiaries: 20, employees: 25, atms: 10 });

  const activeCustomers = await pool.query("SELECT count(*)::int count FROM customers c JOIN users u ON u.user_id=c.user_id WHERE u.role='CUSTOMER' AND c.customer_status='ACTIVE' AND c.kyc_status='VERIFIED' AND u.email_verified=true");
  assert.equal(activeCustomers.rows[0].count, 10);
  const addresses = await pool.query("SELECT count(*)::int count FROM customers c JOIN users u ON u.user_id=c.user_id WHERE u.role='CUSTOMER' AND c.address IS NOT NULL AND c.city IS NOT NULL AND c.state IS NOT NULL AND c.country='India' AND c.postal_code IS NOT NULL");
  assert.equal(addresses.rows[0].count, 10);

  const adminLogin = await request(app).post("/api/v1/auth/login").send({ customerId: "ADMINLOCAL0001", password: "PiBank@LocalAdmin26" });
  assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.body));
  const customerLogins: Array<{ customerId: string; token: string }> = [];
  for (let index = 1; index <= 10; index += 1) {
    const customerId = `CUSTSOUTH${String(index).padStart(4, "0")}`;
    const login = await request(app).post("/api/v1/auth/login").send({ customerId, password: customerPassword(index) });
    assert.equal(login.status, 200, `${customerId}: ${JSON.stringify(login.body)}`);
    assert.match(login.body.data.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    customerLogins.push({ customerId, token: login.body.data.token });
  }
  const profile = await request(app).get("/api/v1/customers/me").set({ Authorization: `Bearer ${customerLogins[0]!.token}` });
  assert.equal(profile.status, 200, JSON.stringify(profile.body));
  assert.equal(profile.body.data.customer_number, "CUSTSOUTH0001");
  assert.match(profile.body.data.address, /Besant Nagar/);
  assert.equal(profile.body.data.city, "Chennai");
  assert.equal(profile.body.data.state, "Tamil Nadu");
  assert.equal(profile.body.data.country, "India");
  assert.equal(profile.body.data.postal_code, "600090");

  const badLedger = await pool.query(`SELECT count(*)::int count FROM ledger_entries WHERE amount<=0 OR entry_type NOT IN ('DEBIT','CREDIT') OR balance_after<>CASE WHEN entry_type='DEBIT' THEN balance_before-amount ELSE balance_before+amount END`);
  assert.equal(badLedger.rows[0].count, 0);
  const balanceMismatch = await pool.query(`WITH latest AS (SELECT DISTINCT ON (account_id) account_id,balance_after FROM ledger_entries ORDER BY account_id,created_at DESC,ledger_entry_id DESC) SELECT count(*)::int count FROM accounts a JOIN latest l USING(account_id) WHERE a.current_balance<>l.balance_after`);
  assert.equal(balanceMismatch.rows[0].count, 0);
  const loanMismatch = await pool.query(`SELECT count(*)::int count FROM loans l JOIN accounts a ON a.account_id=l.account_id WHERE a.account_type<>'LOAN' OR a.current_balance<>l.outstanding_principal OR a.available_balance<>0`);
  assert.equal(loanMismatch.rows[0].count, 0);
  const pollutedLoanIncome = await pool.query(`SELECT count(*)::int count FROM transactions t JOIN accounts a ON a.account_id=t.destination_account_id WHERE t.transaction_type='LOAN_DISBURSEMENT' AND a.account_type<>'LOAN'`);
  assert.equal(pollutedLoanIncome.rows[0].count, 0);
  const cardWorkflow = await pool.query(`SELECT count(*) FILTER(WHERE status='APPROVED')::int approved,count(*) FILTER(WHERE status='PENDING')::int pending,count(*) FILTER(WHERE status='REJECTED')::int rejected,count(*) FILTER(WHERE status='APPROVED' AND approved_card_id IS NULL)::int approved_without_card,count(*) FILTER(WHERE status<>'APPROVED' AND approved_card_id IS NOT NULL)::int invalid_card FROM card_requests`);
  assert.deepEqual(cardWorkflow.rows[0], { approved: 12, pending: 1, rejected: 1, approved_without_card: 0, invalid_card: 0 });
  const loanCards = await pool.query(`SELECT count(*)::int count FROM cards c JOIN accounts a ON a.account_id=c.account_id WHERE a.account_type='LOAN'`);
  assert.equal(loanCards.rows[0].count, 0);

  console.log(JSON.stringify({ counts, addressProfile: { customerNumber: profile.body.data.customer_number, address: profile.body.data.address, city: profile.body.data.city, state: profile.body.data.state, country: profile.body.data.country, postalCode: profile.body.data.postal_code }, loginChecks: { admin: 1, customers: customerLogins.length }, integrity: { badLedgerRows: 0, accountBalanceMismatches: 0, loanBalanceMismatches: 0, loanCards: 0 }, cardWorkflow: cardWorkflow.rows[0] }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
