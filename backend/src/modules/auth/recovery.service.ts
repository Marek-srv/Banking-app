import bcrypt from "bcrypt";
import { createHash, randomBytes, randomInt } from "crypto";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../config/prisma";
import { sendAccountRecoveryOtp } from "../../services/email.service";
import { AuditContext, createAuditLog } from "../../services/audit.service";

type RecoveryPurpose = "CUSTOMER_ID" | "PASSWORD_RESET";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const GENERIC_CUSTOMER_ID_MESSAGE =
  "If the details match an eligible account, a verification code has been sent.";
const GENERIC_PASSWORD_MESSAGE =
  "If the Customer ID is eligible, a verification code has been sent.";

interface LockedRecoveryOtp {
  recovery_otp_id: bigint;
  user_id: bigint;
  otp_hash: string;
  expires_at: Date;
  attempts: number;
  used_at: Date | null;
}

interface LockedResetToken {
  recovery_otp_id: bigint;
  user_id: bigint;
  used_at: Date | null;
  reset_token_expires_at: Date | null;
  reset_completed_at: Date | null;
}

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function maskedEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

async function createRecoveryOtp(
  userId: bigint,
  purpose: RecoveryPurpose,
  otpHash: string
) {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(${userId})::text
    `;
    await transaction.account_recovery_otps.updateMany({
      where: { user_id: userId, purpose, used_at: null },
      data: { used_at: new Date() },
    });
    await transaction.account_recovery_otps.create({
      data: {
        user_id: userId,
        purpose,
        otp_hash: otpHash,
        expires_at: new Date(Date.now() + OTP_EXPIRY_MS),
      },
    });
  });
}

async function burnComparableWork(otp: string) {
  await bcrypt.hash(otp, 10);
}

async function verifyRecoveryOtp(
  transaction: Prisma.TransactionClient,
  userId: bigint,
  purpose: RecoveryPurpose,
  otp: string,
  resetTokenHash?: string
) {
  const rows = await transaction.$queryRaw<LockedRecoveryOtp[]>`
    SELECT recovery_otp_id, user_id, otp_hash, expires_at, attempts, used_at
    FROM account_recovery_otps
    WHERE user_id = ${userId}
      AND purpose = ${purpose}
    ORDER BY recovery_otp_id DESC
    LIMIT 1
    FOR UPDATE
  `;
  const recoveryOtp = rows[0];

  if (
    !recoveryOtp ||
    recoveryOtp.used_at ||
    recoveryOtp.expires_at <= new Date()
  ) {
    return "INVALID" as const;
  }

  if (recoveryOtp.attempts >= MAX_OTP_ATTEMPTS) {
    return "ATTEMPTS_EXCEEDED" as const;
  }

  if (!(await bcrypt.compare(otp, recoveryOtp.otp_hash))) {
    const updated = await transaction.account_recovery_otps.update({
      where: { recovery_otp_id: recoveryOtp.recovery_otp_id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return updated.attempts >= MAX_OTP_ATTEMPTS
      ? ("ATTEMPTS_EXCEEDED" as const)
      : ("INVALID" as const);
  }

  await transaction.account_recovery_otps.update({
    where: { recovery_otp_id: recoveryOtp.recovery_otp_id },
    data: {
      used_at: new Date(),
      ...(resetTokenHash
        ? {
            reset_token_hash: resetTokenHash,
            reset_token_expires_at: new Date(
              Date.now() + RESET_TOKEN_EXPIRY_MS
            ),
          }
        : {}),
    },
  });

  return { recoveryOtpId: recoveryOtp.recovery_otp_id };
}

function throwVerificationError(result: "INVALID" | "ATTEMPTS_EXCEEDED") {
  if (result === "ATTEMPTS_EXCEEDED") {
    throw new Error("RECOVERY_OTP_ATTEMPTS_EXCEEDED");
  }
  throw new Error("INVALID_OR_EXPIRED_RECOVERY_OTP");
}

export async function requestCustomerIdRecovery(
  email: string,
  dateOfBirth: string
) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const customer = await prisma.customers.findFirst({
    where: {
      date_of_birth: new Date(`${dateOfBirth}T00:00:00.000Z`),
      customer_status: "ACTIVE",
      users: { email, status: "ACTIVE", email_verified: true },
    },
    select: { user_id: true, users: { select: { email: true } } },
  });

  if (customer) {
    await createRecoveryOtp(customer.user_id, "CUSTOMER_ID", otpHash);
    await sendAccountRecoveryOtp(customer.users.email, otp, "CUSTOMER_ID");
  }

  return { message: GENERIC_CUSTOMER_ID_MESSAGE };
}

export async function verifyCustomerIdRecovery(
  email: string,
  dateOfBirth: string,
  otp: string,
  auditContext: AuditContext
) {
  const customer = await prisma.customers.findFirst({
    where: {
      date_of_birth: new Date(`${dateOfBirth}T00:00:00.000Z`),
      customer_status: "ACTIVE",
      users: { email, status: "ACTIVE", email_verified: true },
    },
    select: { customer_id: true, customer_number: true, user_id: true },
  });

  if (!customer) {
    await burnComparableWork(otp);
    throw new Error("INVALID_OR_EXPIRED_RECOVERY_OTP");
  }

  const result = await prisma.$transaction(async (transaction) => {
    const verification = await verifyRecoveryOtp(
      transaction,
      customer.user_id,
      "CUSTOMER_ID",
      otp
    );
    if (typeof verification === "string") return verification;
    await createAuditLog(
      {
        ...auditContext,
        userId: customer.user_id,
        action: "CUSTOMER_ID_RECOVERED",
        entity: "CUSTOMER",
        entityId: customer.customer_id,
      },
      transaction
    );
    return verification;
  });

  if (typeof result === "string") throwVerificationError(result);
  return { customerId: customer.customer_number };
}

export async function requestPasswordRecovery(customerId: string) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const customer = await prisma.customers.findUnique({
    where: { customer_number: customerId },
    select: {
      customer_status: true,
      user_id: true,
      users: {
        select: { email: true, status: true, email_verified: true },
      },
    },
  });
  const eligible =
    customer?.customer_status === "ACTIVE" &&
    customer.users.status === "ACTIVE" &&
    customer.users.email_verified;

  if (eligible && customer) {
    await createRecoveryOtp(customer.user_id, "PASSWORD_RESET", otpHash);
    await sendAccountRecoveryOtp(
      customer.users.email,
      otp,
      "PASSWORD_RESET"
    );
  }

  return {
    message: GENERIC_PASSWORD_MESSAGE,
    maskedEmail:
      eligible && customer
        ? maskedEmail(customer.users.email)
        : "m***@e***.com",
  };
}

export async function verifyPasswordRecovery(
  customerId: string,
  otp: string
) {
  const customer = await prisma.customers.findUnique({
    where: { customer_number: customerId },
    select: {
      customer_status: true,
      user_id: true,
      users: { select: { status: true, email_verified: true } },
    },
  });

  if (
    !customer ||
    customer.customer_status !== "ACTIVE" ||
    customer.users.status !== "ACTIVE" ||
    !customer.users.email_verified
  ) {
    await burnComparableWork(otp);
    throw new Error("INVALID_OR_EXPIRED_RECOVERY_OTP");
  }

  const resetToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(resetToken);
  const result = await prisma.$transaction((transaction) =>
    verifyRecoveryOtp(
      transaction,
      customer.user_id,
      "PASSWORD_RESET",
      otp,
      tokenHash
    )
  );

  if (typeof result === "string") throwVerificationError(result);
  return { resetToken, expiresInSeconds: RESET_TOKEN_EXPIRY_MS / 1000 };
}

export async function resetRecoveredPassword(
  customerId: string,
  resetToken: string,
  newPassword: string,
  auditContext: AuditContext
) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const tokenHash = hashResetToken(resetToken);

  const completed = await prisma.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<LockedResetToken[]>`
      SELECT
        recovery_otp_id,
        account_recovery_otps.user_id,
        used_at,
        reset_token_expires_at,
        reset_completed_at
      FROM account_recovery_otps
      JOIN customers ON customers.user_id = account_recovery_otps.user_id
      WHERE customers.customer_number = ${customerId}
        AND purpose = 'PASSWORD_RESET'
        AND reset_token_hash = ${tokenHash}
      ORDER BY recovery_otp_id DESC
      LIMIT 1
      FOR UPDATE OF account_recovery_otps
    `;
    const recovery = rows[0];

    if (
      !recovery ||
      !recovery.used_at ||
      recovery.reset_completed_at ||
      !recovery.reset_token_expires_at ||
      recovery.reset_token_expires_at <= new Date()
    ) {
      return false;
    }

    await transaction.users.update({
      where: { user_id: recovery.user_id },
      data: {
        password_hash: passwordHash,
        failed_login_attempts: 0,
        locked_until: null,
        token_version: { increment: 1 },
      },
    });
    await transaction.account_recovery_otps.update({
      where: { recovery_otp_id: recovery.recovery_otp_id },
      data: { reset_completed_at: new Date() },
    });
    await createAuditLog(
      {
        ...auditContext,
        userId: recovery.user_id,
        action: "PASSWORD_RESET",
        entity: "USER",
        entityId: recovery.user_id,
      },
      transaction
    );
    return true;
  });

  if (!completed) throw new Error("INVALID_PASSWORD_RESET_TOKEN");
  return { message: "Password reset successfully" };
}
