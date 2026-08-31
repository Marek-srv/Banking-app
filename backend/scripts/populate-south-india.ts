import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma";
import { Prisma } from "../src/generated/prisma/client";
import { pool } from "../src/config/db";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createLoanRequest, reviewLoanRequest, approveLoanRequest, disburseLoan, listEmis, payEmi, prepayLoan, markOverdueEmis } from "../src/modules/loans/loan.service";
import { createCardRequest, reviewCardRequest, approveCardRequest, rejectCardRequest } from "../src/modules/cards/card-request.service";

const SEED_EMAIL_DOMAIN = "seed.pi-bank.test";
const NOW = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;

const branches = [
  { code: "PIBK0000001", name: "π Bank Chennai Marina Branch", address: "18 Kamarajar Salai, Triplicane", city: "Chennai", state: "Tamil Nadu", postalCode: "600005", phone: "04440002001" },
  { code: "PIBK0000002", name: "π Bank Bengaluru Indiranagar Branch", address: "42 100 Feet Road, Indiranagar", city: "Bengaluru", state: "Karnataka", postalCode: "560038", phone: "08040001001" },
  { code: "PIBK0000003", name: "π Bank Hyderabad Jubilee Hills Branch", address: "12 Road No. 36, Jubilee Hills", city: "Hyderabad", state: "Telangana", postalCode: "500033", phone: "04040003001" },
  { code: "PIBK0000004", name: "π Bank Kochi Panampilly Nagar Branch", address: "27 Main Avenue, Panampilly Nagar", city: "Kochi", state: "Kerala", postalCode: "682036", phone: "04844004001" },
  { code: "PIBK0000005", name: "π Bank Coimbatore Race Course Branch", address: "35 Race Course Road", city: "Coimbatore", state: "Tamil Nadu", postalCode: "641018", phone: "04224005001" },
] as const;

const customers = [
  ["Arjun", "Reddy", "1991-04-12", "M"],
  ["Priya", "Nair", "1993-09-25", "F"],
  ["Karthik", "Iyer", "1988-02-18", "M"],
  ["Ananya", "Rao", "1996-07-08", "F"],
  ["Vijay", "Kumar", "1985-11-30", "M"],
  ["Meera", "Menon", "1990-05-14", "F"],
  ["Sanjay", "Krishnan", "1992-12-03", "M"],
  ["Divya", "Shetty", "1995-03-21", "F"],
  ["Naveen", "Gowda", "1989-08-16", "M"],
  ["Lakshmi", "Narayanan", "1987-06-27", "F"],
] as const;

const customerAddresses = [
  ["24, Seabreeze Apartments", "Besant Nagar", "Chennai", "Tamil Nadu", "600090"],
  ["71, Fern Residency", "Indiranagar", "Bengaluru", "Karnataka", "560038"],
  ["8-2-293, Deccan Heights", "Jubilee Hills", "Hyderabad", "Telangana", "500033"],
  ["15, Coconut Grove", "Panampilly Nagar", "Kochi", "Kerala", "682036"],
  ["36, Cotton Garden Enclave", "Race Course", "Coimbatore", "Tamil Nadu", "641018"],
  ["19, Temple View Residency", "Mylapore", "Chennai", "Tamil Nadu", "600004"],
  ["44, Jacaranda Court", "Jayanagar", "Bengaluru", "Karnataka", "560041"],
  ["6-3-1090, Pearl Residency", "Somajiguda", "Hyderabad", "Telangana", "500082"],
  ["22, Backwater Gardens", "Kadavanthra", "Kochi", "Kerala", "682020"],
  ["58, Siruvani Homes", "Saibaba Colony", "Coimbatore", "Tamil Nadu", "641011"],
] as const;

const employeeNames = [
  ["Ramesh", "Kulkarni"], ["Geetha", "Srinivasan"], ["Manoj", "Pawar"], ["Deepa", "Raman"], ["Ashok", "Kumar"],
  ["Balaji", "Sundaram"], ["Revathi", "Murugan"], ["Prakash", "Venkatesh"], ["Shalini", "Raj"], ["Ganesh", "Iyer"],
  ["Satish", "Rao"], ["Madhavi", "Reddy"], ["Vinod", "Kumar"], ["Padma", "Devi"], ["Ravi", "Teja"],
  ["Biju", "Joseph"], ["Anitha", "Nair"], ["Thomas", "George"], ["Sreelatha", "Menon"], ["Ajith", "Pillai"],
  ["Senthil", "Kumar"], ["Janani", "Ramesh"], ["Aravind", "Rajendran"], ["Vidhya", "Shankar"], ["Muthukumar", "Selvan"],
] as const;

const positions = ["Branch Manager", "Customer Service Officer", "Relationship Manager", "Operations Officer", "Cashier"] as const;
const merchants = [
  ["Swiggy", "Food & Dining"], ["Amazon India", "Shopping"], ["Indian Oil", "Fuel"],
  ["DMart", "Groceries"], ["Uber", "Transport"], ["Airtel", "Utilities"],
  ["Pharmacy", "Healthcare"], ["Local Restaurant", "Food & Dining"],
] as const;

type SeedAccount = {
  accountId: bigint;
  accountNumber: string;
  customerIndex: number;
  accountType: "SAVINGS" | "CURRENT";
};

type SeedEvent = {
  type: "DEPOSIT" | "WITHDRAWAL" | "CARD_PAYMENT" | "ATM_WITHDRAWAL" | "TRANSFER";
  sourceAccountId?: bigint;
  destinationAccountId?: bigint;
  amount: number;
  timestamp: Date;
  description: string;
  merchant?: string;
  category: string;
};

function seedDate(daysAgo: number, hour: number, minute: number): Date {
  const date = new Date(NOW.getTime() - daysAgo * DAY_MS);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function emailFor(index: number): string {
  const [firstName, lastName] = customers[index]!;
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${String(index + 1).padStart(2, "0")}@${SEED_EMAIL_DOMAIN}`;
}

function passwordFor(index: number): string {
  return `PiBank@Test${String(index + 1).padStart(3, "0")}`;
}

async function createCompletedTransaction(
  transaction: Prisma.TransactionClient,
  event: SeedEvent,
  sequence: number,
  balances: Map<bigint, Prisma.Decimal>
) {
  const amount = new Prisma.Decimal(event.amount);
  const sourceBefore = event.sourceAccountId === undefined ? undefined : balances.get(event.sourceAccountId);
  const destinationBefore = event.destinationAccountId === undefined ? undefined : balances.get(event.destinationAccountId);

  if (event.sourceAccountId !== undefined && (!sourceBefore || sourceBefore.lessThan(amount))) {
    throw new Error(`Insufficient seed balance for account ${event.sourceAccountId.toString()}`);
  }
  if (event.destinationAccountId !== undefined && !destinationBefore) {
    throw new Error(`Missing seed balance for account ${event.destinationAccountId.toString()}`);
  }

  const completedAt = new Date(event.timestamp.getTime() + 60_000);
  const bankingTransaction = await transaction.transactions.create({
    data: {
      reference_number: `SEED-${event.type.slice(0, 3)}-${String(sequence).padStart(6, "0")}`,
      transaction_type: event.type,
      source_account_id: event.sourceAccountId ?? null,
      destination_account_id: event.destinationAccountId ?? null,
      amount,
      currency: "INR",
      status: "COMPLETED",
      initiated_at: event.timestamp,
      completed_at: completedAt,
      created_at: event.timestamp,
    },
  });

  await transaction.transaction_details.create({
    data: {
      transaction_id: bankingTransaction.transaction_id,
      description: event.description,
      merchant_payee: event.merchant ?? null,
      transaction_category: event.category,
      notes: "Synthetic local demonstration data",
      created_at: event.timestamp,
    },
  });
  await transaction.transaction_status_history.create({
    data: {
      transaction_id: bankingTransaction.transaction_id,
      status: "COMPLETED",
      description: `${event.type} completed`,
      created_at: completedAt,
    },
  });

  if (event.sourceAccountId !== undefined && sourceBefore) {
    const sourceAfter = sourceBefore.minus(amount);
    await transaction.ledger_entries.create({
      data: {
        transaction_id: bankingTransaction.transaction_id,
        account_id: event.sourceAccountId,
        entry_type: "DEBIT",
        amount,
        balance_before: sourceBefore,
        balance_after: sourceAfter,
        created_at: completedAt,
      },
    });
    balances.set(event.sourceAccountId, sourceAfter);
  }

  if (event.destinationAccountId !== undefined && destinationBefore) {
    const destinationAfter = destinationBefore.plus(amount);
    await transaction.ledger_entries.create({
      data: {
        transaction_id: bankingTransaction.transaction_id,
        account_id: event.destinationAccountId,
        entry_type: "CREDIT",
        amount,
        balance_before: destinationBefore,
        balance_after: destinationAfter,
        created_at: completedAt,
      },
    });
    balances.set(event.destinationAccountId, destinationAfter);
  }
}

async function main() {
  const existingRows = await prisma.users.count();
  if (existingRows > 0 || await prisma.branches.count() > 0) throw new Error("Realistic seed requires an empty local application database. No rows were changed.");

  const passwordHashes = await Promise.all(
    customers.map((_, index) => bcrypt.hash(passwordFor(index), 12))
  );
  const adminPassword = "PiBank@LocalAdmin26";
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const result = await prisma.$transaction(async (transaction) => {
    const createdBranches = [];
    for (let index = 0; index < branches.length; index++) {
      const branch = branches[index]!;
      createdBranches.push(await transaction.branches.create({
        data: {
          branch_code: branch.code,
          branch_name: branch.name,
          address: branch.address,
          city: branch.city,
          state: branch.state,
          country: "India",
          postal_code: branch.postalCode,
          phone: branch.phone,
          email: `${branch.code.toLowerCase()}@${SEED_EMAIL_DOMAIN}`,
          operating_hours: "Monday-Saturday 09:30-16:30",
        },
      }));
    }

    const adminUser = await transaction.users.create({ data: { email: `admin@${SEED_EMAIL_DOMAIN}`, password_hash: adminHash, role: "ADMIN", status: "ACTIVE", email_verified: true, email_verified_at: NOW } });
    await transaction.customers.create({ data: { user_id: adminUser.user_id, branch_id: createdBranches[0]!.branch_id, customer_number: "ADMINLOCAL0001", first_name: "Local", last_name: "Administrator", email: `admin@${SEED_EMAIL_DOMAIN}`, customer_status: "ACTIVE", kyc_status: "VERIFIED", kyc_verified_at: NOW, approved_at: NOW } });

    let employeeCount = 0;
    let atmCount = 0;
    for (let branchIndex = 0; branchIndex < createdBranches.length; branchIndex++) {
      const branch = createdBranches[branchIndex]!;
      let managerId: bigint | undefined;
      for (let roleIndex = 0; roleIndex < positions.length; roleIndex++) {
        const employeeIndex = branchIndex * positions.length + roleIndex;
        const [firstName, lastName] = employeeNames[employeeIndex]!;
        const employee = await transaction.employees.create({
          data: {
            branch_id: branch.branch_id,
            employee_number: `PIEMP${String(employeeIndex + 1).padStart(4, "0")}`,
            first_name: firstName,
            last_name: lastName,
            position: positions[roleIndex],
            phone: `8${String(100000000 + employeeIndex).padStart(9, "0")}`,
            email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${employeeIndex + 1}@${SEED_EMAIL_DOMAIN}`,
            gender: roleIndex % 2 === 0 ? "MALE" : "FEMALE",
            hire_date: new Date(Date.UTC(2018 + (employeeIndex % 6), employeeIndex % 12, 1 + (employeeIndex % 20))),
            qualification: "Graduate in Banking and Finance",
            status: "ACTIVE",
          },
        });
        if (roleIndex === 0) managerId = employee.employee_id;
        employeeCount++;
      }
      await transaction.branches.update({
        where: { branch_id: branch.branch_id },
        data: { manager_id: managerId },
      });

      for (let atmIndex = 0; atmIndex < 2; atmIndex++) {
        await transaction.atms.create({
          data: {
            branch_id: branch.branch_id,
            atm_code: `PIATM${String(branchIndex + 1).padStart(2, "0")}${atmIndex + 1}`,
            location: `${branches[branchIndex]!.city} ${atmIndex === 0 ? "Central Branch Lobby" : "Railway Station Road"}`,
            status: "ACTIVE",
            operating_hours: "24x7",
            supported_transactions: "Cash Withdrawal, Balance Enquiry, Mini Statement",
          },
        });
        atmCount++;
      }
    }

    const createdCustomers = [];
    const accounts: SeedAccount[] = [];

    for (let customerIndex = 0; customerIndex < customers.length; customerIndex++) {
      const [firstName, lastName, dateOfBirth, gender] = customers[customerIndex]!;
      const branch = createdBranches[customerIndex % createdBranches.length]!;
      const [addressLine1, addressLine2, city, state, postalCode] = customerAddresses[customerIndex]!;
      const email = emailFor(customerIndex);
      const user = await transaction.users.create({
        data: {
          email,
          password_hash: passwordHashes[customerIndex]!,
          role: "CUSTOMER",
          status: "ACTIVE",
          email_verified: true,
          email_verified_at: NOW,
        },
      });
      const customer = await transaction.customers.create({
        data: {
          user_id: user.user_id,
          branch_id: branch.branch_id,
          customer_number: `CUSTSOUTH${String(customerIndex + 1).padStart(4, "0")}`,
          first_name: firstName,
          last_name: lastName,
          date_of_birth: new Date(`${dateOfBirth}T00:00:00.000Z`),
          gender: gender === "M" ? "MALE" : "FEMALE",
          phone: `9${String(731420000 + customerIndex * 137).padStart(9, "0")}`,
          email,
          address: `${addressLine1}, ${addressLine2}`,
          city,
          state,
          country: "India",
          postal_code: postalCode,
          kyc_status: "VERIFIED",
          kyc_verified_at: NOW,
          kyc_verified_by: adminUser.user_id,
          customer_status: "ACTIVE",
          approved_at: NOW,
          approved_by: adminUser.user_id,
        },
      });
      createdCustomers.push(customer);
      await transaction.customer_kyc_status_history.create({ data: { customer_id: customer.customer_id, previous_status: "PENDING", new_status: "VERIFIED", changed_by: adminUser.user_id, reason: "Synthetic local KYC verification" } });
      await transaction.audit_logs.createMany({ data: [
        { user_id: adminUser.user_id, action: "CUSTOMER_APPROVED", entity: "CUSTOMER", entity_id: customer.customer_id, ip_address: "127.0.0.1", reason: "Synthetic local approval" },
        { user_id: adminUser.user_id, action: "KYC_VERIFIED", entity: "KYC", entity_id: customer.customer_id, ip_address: "127.0.0.1", reason: "Synthetic local verification" },
      ] });

      const accountCount = [1, 3, 6, 7, 9].includes(customerIndex) ? 2 : 1;
      for (let accountIndex = 0; accountIndex < accountCount; accountIndex++) {
        const accountType = accountIndex === 0 ? "SAVINGS" as const : "CURRENT" as const;
        const account = await transaction.accounts.create({
          data: {
            account_number: `PI${String(customerIndex + 1).padStart(4, "0")}${String(accountIndex + 1).padStart(2, "0")}00000001`,
            customer_id: customer.customer_id,
            branch_id: branch.branch_id,
            account_type: accountType,
            account_subtype: accountType === "SAVINGS" ? "REGULAR" : "STANDARD",
            ifsc_code: branch.branch_code,
            currency: "INR",
            current_balance: 0,
            available_balance: 0,
            account_status: "ACTIVE",
            opened_at: seedDate(10, 7, customerIndex),
          },
        });
        accounts.push({ accountId: account.account_id, accountNumber: account.account_number, customerIndex, accountType });
      }
    }

    let beneficiaryCount = 0;
    for (let customerIndex = 0; customerIndex < createdCustomers.length; customerIndex++) {
      const customer = createdCustomers[customerIndex]!;
      for (const offset of [1, 2]) {
        const beneficiaryIndex = (customerIndex + offset) % createdCustomers.length;
        const beneficiaryCustomer = createdCustomers[beneficiaryIndex]!;
        const beneficiaryAccount = accounts.find((account) => account.customerIndex === beneficiaryIndex)!;
        const [firstName, lastName] = customers[beneficiaryIndex]!;
        const beneficiaryBranch = branches[beneficiaryIndex % branches.length]!;
        await transaction.beneficiaries.create({
          data: {
            customer_id: customer.customer_id,
            beneficiary_name: `${firstName} ${lastName}`,
            beneficiary_account_no: beneficiaryAccount.accountNumber,
            bank_name: "Pi Bank",
            bank_code: beneficiaryBranch.code,
            nickname: firstName,
            status: "ACTIVE",
          },
        });
        beneficiaryCount++;
      }
    }

    const balances = new Map<bigint, Prisma.Decimal>();
    const events: SeedEvent[] = [];
    for (const account of accounts) {
      balances.set(account.accountId, new Prisma.Decimal(0));
      const accountOrdinal = accounts.filter((candidate) => candidate.customerIndex === account.customerIndex).findIndex((candidate) => candidate.accountId === account.accountId);
      events.push({
        type: "DEPOSIT",
        destinationAccountId: account.accountId,
        amount: account.accountType === "SAVINGS" ? 400_000 + account.customerIndex * 10_000 : 125_000 + account.customerIndex * 5_000,
        timestamp: seedDate(29, 8 + accountOrdinal, account.customerIndex),
        description: "Opening balance funding",
        category: "Banking",
      });
    }

    for (let customerIndex = 0; customerIndex < customers.length; customerIndex++) {
      const primary = accounts.find((account) => account.customerIndex === customerIndex)!;
      for (let operationIndex = 0; operationIndex < 8; operationIndex++) {
        const [merchant, category] = merchants[operationIndex]!;
        const isDeposit = operationIndex === 2 || operationIndex === 5;
        const isAtm = operationIndex === 1 || operationIndex === 6;
        const type = isDeposit ? "DEPOSIT" : isAtm ? "ATM_WITHDRAWAL" : operationIndex === 3 ? "WITHDRAWAL" : "CARD_PAYMENT";
        const amount = isDeposit
          ? 9_000 + customerIndex * 125 + operationIndex * 300
          : 650 + ((customerIndex * 173 + operationIndex * 317) % 4_200);
        events.push({
          type,
          sourceAccountId: isDeposit ? undefined : primary.accountId,
          destinationAccountId: isDeposit ? primary.accountId : undefined,
          amount,
          timestamp: seedDate(9 - operationIndex, 10 + (customerIndex % 8), (customerIndex * 3 + operationIndex) % 60),
          description: isDeposit ? "Cash deposit at branch" : isAtm ? "ATM cash withdrawal" : type === "WITHDRAWAL" ? "Cash withdrawal at branch" : `Payment to ${merchant}`,
          merchant: type === "CARD_PAYMENT" ? merchant : undefined,
          category: isDeposit ? "Income" : isAtm || type === "WITHDRAWAL" ? "Cash Withdrawal" : category,
        });
      }
    }

    for (let customerIndex = 0; customerIndex < customers.length; customerIndex++) {
      const destinationIndex = (customerIndex + 1) % customers.length;
      const source = accounts.find((account) => account.customerIndex === customerIndex)!;
      const destination = accounts.find((account) => account.customerIndex === destinationIndex)!;
      const [beneficiaryFirst, beneficiaryLast] = customers[destinationIndex]!;
      events.push({
        type: "TRANSFER",
        sourceAccountId: source.accountId,
        destinationAccountId: destination.accountId,
        amount: 2_500 + customerIndex * 175,
        timestamp: seedDate(1, 12 + (customerIndex % 7), customerIndex * 2),
        description: `Transfer to ${beneficiaryFirst} ${beneficiaryLast}`,
        merchant: `${beneficiaryFirst} ${beneficiaryLast}`,
        category: "Transfers",
      });
    }

    events.sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    for (let sequence = 0; sequence < events.length; sequence++) {
      await createCompletedTransaction(transaction, events[sequence]!, sequence + 1, balances);
    }

    for (const account of accounts) {
      const balance = balances.get(account.accountId)!;
      await transaction.accounts.update({
        where: { account_id: account.accountId },
        data: { current_balance: balance, available_balance: balance, updated_at: NOW },
      });
    }

    return {
      customers: createdCustomers.length,
      accounts: accounts.length,
      transactions: events.length,
      beneficiaries: beneficiaryCount,
      branches: createdBranches.length,
      employees: employeeCount,
      atms: atmCount,
      adminUserId: adminUser.user_id,
      createdCustomers,
      accounts,
      adminPassword,
    };
  }, { maxWait: 20_000, timeout: 180_000 });

  const auditContext = { ipAddress: "127.0.0.1" };
  const loanPlans = [
    { customerIndex: 2, amount: 200_000, months: 24, loanType: "PERSONAL", loanSubtype: "UNSECURED_PERSONAL", purpose: "Home furnishing and personal expenses" },
    { customerIndex: 3, amount: 500_000, months: 36, loanType: "VEHICLE", loanSubtype: "NEW_VEHICLE", purpose: "Purchase of a family vehicle" },
    { customerIndex: 5, amount: 400_000, months: 48, loanType: "EDUCATION", loanSubtype: "HIGHER_EDUCATION", purpose: "Postgraduate education expenses" },
    { customerIndex: 7, amount: 1_200_000, months: 60, loanType: "HOME", loanSubtype: "HOME_PURCHASE", purpose: "Home purchase down-payment support" },
    { customerIndex: 8, amount: 300_000, months: 24, loanType: "PERSONAL", loanSubtype: "UNSECURED_PERSONAL", purpose: "Planned household renovation" },
    { customerIndex: 9, amount: 600_000, months: 48, loanType: "VEHICLE", loanSubtype: "NEW_VEHICLE", purpose: "Purchase of an electric vehicle" },
  ] as const;

  for (const plan of loanPlans) {
    const customer = result.createdCustomers[plan.customerIndex]!;
    const created = await createLoanRequest(customer.user_id, { requestedAmount: plan.amount, durationMonths: plan.months, loanType: plan.loanType, loanSubtype: plan.loanSubtype, purpose: plan.purpose }, auditContext);
    await reviewLoanRequest(result.adminUserId, created.loan_request_id, auditContext);
    const approved = await approveLoanRequest(result.adminUserId, created.loan_request_id, { approvedAmount: plan.amount, approvedDurationMonths: plan.months, adminNote: "Approved for synthetic localhost dataset" }, auditContext);
    await disburseLoan(result.adminUserId, approved.loan.loan_id, auditContext);
    const source = result.accounts.find((account) => account.customerIndex === plan.customerIndex && account.accountType === (plan.customerIndex === 3 || plan.customerIndex === 9 ? "CURRENT" : "SAVINGS"))!;
    if (plan.customerIndex === 3) {
      const emis = await listEmis(customer.user_id, approved.loan.loan_id);
      for (const emi of emis.slice(0, 3)) await payEmi(customer.user_id, approved.loan.loan_id, emi.emi_schedule_id, source.accountId, auditContext);
    } else if (plan.customerIndex === 5) {
      await prepayLoan(customer.user_id, approved.loan.loan_id, source.accountId, 25_000, auditContext);
    } else if (plan.customerIndex === 7) {
      const emis = await listEmis(customer.user_id, approved.loan.loan_id);
      const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await prisma.loan_emi_schedules.update({ where: { emi_schedule_id: emis[0]!.emi_schedule_id }, data: { due_date: yesterday } });
      await markOverdueEmis(approved.loan.loan_id);
    } else if (plan.customerIndex === 8) {
      await prepayLoan(customer.user_id, approved.loan.loan_id, source.accountId, 250_000, auditContext);
    } else if (plan.customerIndex === 9) {
      const emis = await listEmis(customer.user_id, approved.loan.loan_id);
      await payEmi(customer.user_id, approved.loan.loan_id, emis[0]!.emi_schedule_id, source.accountId, auditContext);
    }
  }

  await createLoanRequest(result.createdCustomers[0]!.user_id, { requestedAmount: 150_000, durationMonths: 12, loanType: "PERSONAL", loanSubtype: "UNSECURED_PERSONAL", purpose: "Pending local review demonstration" }, auditContext);

  for (let customerIndex = 0; customerIndex < 8; customerIndex++) {
    const customer = result.createdCustomers[customerIndex]!;
    const account = result.accounts.find((candidate) => candidate.customerIndex === customerIndex && candidate.accountType === "SAVINGS")!;
    const cardRequest = await createCardRequest(customer.user_id, { accountId: account.accountId, cardType: "DEBIT", cardVariant: "CLASSIC", notes: "Synthetic debit card application" }, auditContext);
    await reviewCardRequest(result.adminUserId, cardRequest.card_request_id, auditContext);
    await approveCardRequest(result.adminUserId, cardRequest.card_request_id, auditContext);
  }
  for (let customerIndex = 0; customerIndex < 4; customerIndex++) {
    const customer = result.createdCustomers[customerIndex]!;
    const account = result.accounts.find((candidate) => candidate.customerIndex === customerIndex && candidate.accountType === "SAVINGS")!;
    const cardRequest = await createCardRequest(customer.user_id, { accountId: account.accountId, cardType: "CREDIT", cardVariant: "PLATINUM", notes: "Synthetic credit card application" }, auditContext);
    await reviewCardRequest(result.adminUserId, cardRequest.card_request_id, auditContext);
    await approveCardRequest(result.adminUserId, cardRequest.card_request_id, auditContext);
  }
  const pendingCardAccount = result.accounts.find((candidate) => candidate.customerIndex === 8 && candidate.accountType === "SAVINGS")!;
  await createCardRequest(result.createdCustomers[8]!.user_id, { accountId: pendingCardAccount.accountId, cardType: "DEBIT", notes: "Pending card request demonstration" }, auditContext);
  const rejectedCardAccount = result.accounts.find((candidate) => candidate.customerIndex === 9 && candidate.accountType === "SAVINGS")!;
  const rejectedCard = await createCardRequest(result.createdCustomers[9]!.user_id, { accountId: rejectedCardAccount.accountId, cardType: "DEBIT", notes: "Rejected card request demonstration" }, auditContext);
  await reviewCardRequest(result.adminUserId, rejectedCard.card_request_id, auditContext);
  await rejectCardRequest(result.adminUserId, rejectedCard.card_request_id, "Synthetic eligibility demonstration", auditContext);

  const requestSpecs = [
    { customerIndex: 1, status: "APPROVED" as const, approved: true },
    { customerIndex: 4, status: "PENDING" as const, approved: false },
    { customerIndex: 0, status: "REJECTED" as const, approved: false },
  ];
  for (const spec of requestSpecs) {
    const customer = result.createdCustomers[spec.customerIndex]!;
    const approvedAccount = spec.approved ? result.accounts.find((account) => account.customerIndex === spec.customerIndex && account.accountType === "CURRENT") : undefined;
    const accountRequest = await prisma.account_requests.create({ data: { customer_id: customer.customer_id, account_type: "CURRENT", account_subtype: "STANDARD", preferred_branch_id: customer.branch_id, purpose: "Synthetic account request history", requested_per_transaction_limit: 75_000, requested_daily_transfer_limit: 150_000, status: spec.status, reviewed_by: spec.status === "PENDING" ? null : result.adminUserId, reviewed_at: spec.status === "PENDING" ? null : NOW, approved_account_id: approvedAccount?.accountId, approved_branch_id: approvedAccount ? customer.branch_id : null, rejection_reason: spec.status === "REJECTED" ? "Synthetic documentation scenario" : null } });
    await prisma.request_status_history.create({ data: { request_type: "ACCOUNT_OPENING", request_id: accountRequest.account_request_id, previous_status: null, new_status: spec.status, changed_by: spec.status === "PENDING" ? customer.user_id : result.adminUserId, reason: "Synthetic request history" } });
  }

  const loginDirectory = resolve(process.cwd(), "../frontend/people/login");
  await mkdir(loginDirectory, { recursive: true });
  const credentialLines = ["========================================", "π BANK LOCAL TEST LOGINS", "========================================", "", "ADMIN", "", "Admin ID/Username:", "ADMINLOCAL0001", "Password:", result.adminPassword, "", "----------------------------------------", ""];
  customers.forEach(([firstName, lastName], index) => credentialLines.push(`CUSTOMER ${index + 1}`, "", `Name: ${firstName} ${lastName}`, `Customer ID: CUSTSOUTH${String(index + 1).padStart(4, "0")}`, `Email: ${emailFor(index)}`, `Password: ${passwordFor(index)}`, "", "----------------------------------------", ""));
  await writeFile(resolve(loginDirectory, "generated_logins.txt"), `${credentialLines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });

  console.log(JSON.stringify({ customers: result.customers, depositAccounts: result.accounts.length, baseTransactions: result.transactions, beneficiaries: result.beneficiaries, branches: result.branches, employees: result.employees, atms: result.atms, loans: loanPlans.length, approvedCards: 12 }, null, 2));
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
