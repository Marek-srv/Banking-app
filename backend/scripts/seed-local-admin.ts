import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma";
import { pool } from "../src/config/db";

const ADMIN_EMAIL = "admin.local@seed.pi-bank.test";
const ADMIN_CUSTOMER_ID = "ADMINLOCAL0001";
const ADMIN_PASSWORD = "PiBank@Admin001";

async function main() {
  const existingLocalAdmin = await prisma.users.findUnique({ where: { email: ADMIN_EMAIL }, include: { customers: true } });
  if (existingLocalAdmin) {
    if (existingLocalAdmin.role !== "ADMIN" || !existingLocalAdmin.customers) throw new Error("Local admin identifier is already used by an incompatible record");
    console.log(JSON.stringify({ created: false, customerId: existingLocalAdmin.customers.customer_number, email: existingLocalAdmin.email }, null, 2));
    return;
  }
  const existingAdmins = await prisma.users.count({ where: { role: "ADMIN" } });
  if (existingAdmins > 0) {
    throw new Error(`An ADMIN already exists (${existingAdmins}); no local admin was created or modified.`);
  }
  const branch = await prisma.branches.findFirst({ where: { branch_code: { in: ["DIGITAL001", "PIBLR001"] } }, orderBy: { branch_code: "asc" } });
  if (!branch) throw new Error("No legitimate onboarding branch is available for the local admin identity");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const result = await prisma.$transaction(async (transaction) => {
    const user = await transaction.users.create({ data: { email: ADMIN_EMAIL, password_hash: passwordHash, role: "ADMIN", status: "ACTIVE", email_verified: true, email_verified_at: new Date() } });
    const customer = await transaction.customers.create({ data: {
      user_id: user.user_id, branch_id: branch.branch_id, customer_number: ADMIN_CUSTOMER_ID,
      first_name: "Local", last_name: "Administrator", date_of_birth: new Date("1990-01-01T00:00:00.000Z"),
      phone: "9000000099", email: ADMIN_EMAIL, city: branch.city, state: branch.state, country: "India",
      kyc_status: "VERIFIED", customer_status: "ACTIVE",
    } });
    return { created: true, customerId: customer.customer_number, email: user.email };
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); await pool.end(); });
