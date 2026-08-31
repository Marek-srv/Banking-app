import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomInt } from "crypto";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import {
  AuditContext,
  createAuditLog,
} from "../../services/audit.service";
import { sendEmailVerificationOtp } from "../../services/email.service";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const REGISTRATION_TOKEN_EXPIRY_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const RE_REGISTRATION_COOLING_PERIOD_MS = 24 * 60 * 60 * 1000;

type StartRegistrationInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  mobile: string;
  email: string;
};

interface LockedPendingRegistration {
  pending_registration_id: bigint;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  mobile: string;
  email: string;
  otp_hash: string;
  otp_expires_at: Date;
  otp_attempts: number;
  otp_used_at: Date | null;
  email_verified_at: Date | null;
  registration_token_expires_at: Date | null;
  completed_at: Date | null;
}

function generateOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createOtpHash(otp: string) {
  return bcrypt.hash(otp, 10);
}

export async function register(input: StartRegistrationInput) {
  const existingUser = await prisma.users.findUnique({
    where: { email: input.email },
    select: {
      user_id: true,
      customers: {
        select: {
          customer_status: true,
          rejected_at: true,
          phone: true,
        },
      },
    },
  });

  if (existingUser) {
    const rejectedCustomer = existingUser.customers;
    if (
      rejectedCustomer?.customer_status !== "REJECTED" ||
      !rejectedCustomer.rejected_at ||
      rejectedCustomer.phone !== input.mobile
    ) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
    if (
      Date.now() - rejectedCustomer.rejected_at.getTime() <
      RE_REGISTRATION_COOLING_PERIOD_MS
    ) {
      throw new Error("REGISTRATION_COOLING_PERIOD");
    }
  }

  const otp = generateOtp();
  const otpHash = await createOtpHash(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await prisma.pending_registrations.upsert({
    where: { email: input.email },
    create: {
      first_name: input.firstName,
      last_name: input.lastName,
      date_of_birth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
      mobile: input.mobile,
      email: input.email,
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
    },
    update: {
      first_name: input.firstName,
      last_name: input.lastName,
      date_of_birth: new Date(`${input.dateOfBirth}T00:00:00.000Z`),
      mobile: input.mobile,
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      otp_attempts: 0,
      otp_used_at: null,
      email_verified_at: null,
      registration_token_hash: null,
      registration_token_expires_at: null,
      completed_at: null,
      updated_at: new Date(),
    },
  });

  await sendEmailVerificationOtp(input.email, otp);

  return {
    email: input.email,
    message: "Registration started. Check your email for the verification OTP.",
  };
}

export async function verifyEmailOtp(email: string, otp: string) {
  const registrationToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(registrationToken);
  const now = new Date();
  const tokenExpiresAt = new Date(now.getTime() + REGISTRATION_TOKEN_EXPIRY_MS);

  const verificationResult = await prisma.$transaction(async (transaction) => {
    const registrations = await transaction.$queryRaw<LockedPendingRegistration[]>`
      SELECT *
      FROM pending_registrations
      WHERE email = ${email}
      FOR UPDATE
    `;
    const pending = registrations[0];

    if (
      !pending ||
      pending.completed_at ||
      pending.email_verified_at ||
      pending.otp_used_at ||
      pending.otp_expires_at <= now
    ) {
      return "INVALID" as const;
    }

    if (pending.otp_attempts >= MAX_OTP_ATTEMPTS) {
      return "ATTEMPTS_EXCEEDED" as const;
    }

    const matches = await bcrypt.compare(otp, pending.otp_hash);
    if (!matches) {
      const updated = await transaction.pending_registrations.update({
        where: { pending_registration_id: pending.pending_registration_id },
        data: { otp_attempts: { increment: 1 }, updated_at: now },
        select: { otp_attempts: true },
      });
      return updated.otp_attempts >= MAX_OTP_ATTEMPTS
        ? ("ATTEMPTS_EXCEEDED" as const)
        : ("INVALID" as const);
    }

    await transaction.pending_registrations.update({
      where: { pending_registration_id: pending.pending_registration_id },
      data: {
        otp_used_at: now,
        email_verified_at: now,
        registration_token_hash: tokenHash,
        registration_token_expires_at: tokenExpiresAt,
        updated_at: now,
      },
    });
    return "VERIFIED" as const;
  });

  if (verificationResult === "INVALID") {
    throw new Error("INVALID_OR_EXPIRED_OTP");
  }
  if (verificationResult === "ATTEMPTS_EXCEEDED") {
    throw new Error("OTP_ATTEMPTS_EXCEEDED");
  }

  return {
    message: "Email verified successfully",
    registrationToken,
    expiresInSeconds: REGISTRATION_TOKEN_EXPIRY_MS / 1000,
  };
}

export async function resendEmailOtp(email: string) {
  const otp = generateOtp();
  const otpHash = await createOtpHash(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  const recipient = await prisma.$transaction(async (transaction) => {
    const registrations = await transaction.$queryRaw<LockedPendingRegistration[]>`
      SELECT *
      FROM pending_registrations
      WHERE email = ${email}
      FOR UPDATE
    `;
    const pending = registrations[0];

    if (!pending || pending.completed_at || pending.email_verified_at) {
      return null;
    }

    await transaction.pending_registrations.update({
      where: { pending_registration_id: pending.pending_registration_id },
      data: {
        otp_hash: otpHash,
        otp_expires_at: expiresAt,
        otp_attempts: 0,
        otp_used_at: null,
        registration_token_hash: null,
        registration_token_expires_at: null,
        updated_at: new Date(),
      },
    });
    return pending.email;
  });

  if (recipient) {
    await sendEmailVerificationOtp(recipient, otp);
  }

  return {
    message: "If the email is eligible for verification, a new OTP has been sent.",
  };
}

export async function completeRegistration(
  registrationToken: string,
  password: string,
  auditContext: AuditContext
) {
  const tokenHash = hashToken(registrationToken);
  const now = new Date();

  return prisma.$transaction(async (transaction) => {
    const registrations = await transaction.$queryRaw<LockedPendingRegistration[]>`
      SELECT *
      FROM pending_registrations
      WHERE registration_token_hash = ${tokenHash}
      FOR UPDATE
    `;
    const pending = registrations[0];

    if (!pending) {
      throw new Error("INVALID_REGISTRATION_TOKEN");
    }
    if (pending.completed_at) {
      throw new Error("REGISTRATION_ALREADY_COMPLETED");
    }
    if (
      !pending.email_verified_at ||
      !pending.otp_used_at ||
      !pending.registration_token_expires_at ||
      pending.registration_token_expires_at <= now
    ) {
      throw new Error("INVALID_REGISTRATION_TOKEN");
    }

    const existingUser = await transaction.users.findUnique({
      where: { email: pending.email },
      include: { customers: true },
    });
    const reusableRejectedCustomer = existingUser?.customers;
    if (
      existingUser &&
      (reusableRejectedCustomer?.customer_status !== "REJECTED" ||
        !reusableRejectedCustomer.rejected_at ||
        now.getTime() - reusableRejectedCustomer.rejected_at.getTime() <
          RE_REGISTRATION_COOLING_PERIOD_MS ||
        reusableRejectedCustomer.phone !== pending.mobile)
    ) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    const branch = await transaction.branches.findUnique({
      where: { branch_code: env.DEFAULT_ONBOARDING_BRANCH_CODE },
      select: { branch_id: true },
    });
    if (!branch) {
      throw new Error("ONBOARDING_BRANCH_NOT_FOUND");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    let user;
    let customer;
    let customerNumber: string;
    if (existingUser && reusableRejectedCustomer) {
      user = await transaction.users.update({
        where: { user_id: existingUser.user_id },
        data: {
          password_hash: passwordHash,
          email_verified: true,
          email_verified_at: now,
          status: "INACTIVE",
          failed_login_attempts: 0,
          locked_until: null,
          token_version: { increment: 1 },
          updated_at: now,
        },
      });
      customer = await transaction.customers.update({
        where: { customer_id: reusableRejectedCustomer.customer_id },
        data: {
          branch_id: branch.branch_id,
          first_name: pending.first_name,
          last_name: pending.last_name,
          date_of_birth: pending.date_of_birth,
          phone: pending.mobile,
          email: pending.email,
          customer_status: "PENDING_ADMIN_APPROVAL",
          kyc_status: "PENDING",
          updated_at: now,
        },
      });
      customerNumber = customer.customer_number;
    } else {
      user = await transaction.users.create({
        data: {
          email: pending.email,
          password_hash: passwordHash,
          email_verified: true,
          email_verified_at: now,
          status: "INACTIVE",
          role: "CUSTOMER",
        },
      });

      const sequence = await transaction.$queryRaw<Array<{ value: bigint }>>`
        SELECT nextval('customer_number_seq') AS value
      `;
      const sequenceValue = sequence[0]?.value;
      if (sequenceValue === undefined) {
        throw new Error("CUSTOMER_NUMBER_GENERATION_FAILED");
      }
      customerNumber = `CUST${sequenceValue.toString().padStart(8, "0")}`;
      customer = await transaction.customers.create({
        data: {
          user_id: user.user_id,
          branch_id: branch.branch_id,
          customer_number: customerNumber,
          first_name: pending.first_name,
          last_name: pending.last_name,
          date_of_birth: pending.date_of_birth,
          phone: pending.mobile,
          email: pending.email,
          customer_status: "PENDING_ADMIN_APPROVAL",
          kyc_status: "PENDING",
        },
      });
    }

    await transaction.pending_registrations.update({
      where: { pending_registration_id: pending.pending_registration_id },
      data: { completed_at: now, updated_at: now },
    });
    await createAuditLog(
      {
        ...auditContext,
        userId: user.user_id,
        action: "CUSTOMER_CREATED",
        entity: "CUSTOMER",
        entityId: customer.customer_id,
        ...(existingUser ? { metadata: { reapplication: true } } : {}),
      },
      transaction
    );

    return { customerId: customerNumber };
  }, { isolationLevel: "Serializable" });
}

export async function login(
  customerId: string,
  password: string,
  auditContext: AuditContext
) {
  const customer = await prisma.customers.findUnique({
    where: { customer_number: customerId },
    select: { customer_status: true, users: true },
  });
  const user = customer?.users;

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const now = new Date();
  if (user.locked_until && user.locked_until > now) {
    throw new Error("ACCOUNT_TEMPORARILY_LOCKED");
  }

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    const failureState = await prisma.users.update({
      where: { user_id: user.user_id },
      data: { failed_login_attempts: { increment: 1 } },
      select: { failed_login_attempts: true },
    });
    if (failureState.failed_login_attempts >= 5) {
      await prisma.users.update({
        where: { user_id: user.user_id },
        data: {
          failed_login_attempts: 0,
          locked_until: new Date(now.getTime() + 15 * 60 * 1000),
        },
      });
    }
    throw new Error("INVALID_CREDENTIALS");
  }

  if (!user.email_verified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  if (customer.customer_status === "PENDING_ADMIN_APPROVAL") {
    throw new Error("CUSTOMER_PENDING_ADMIN_APPROVAL");
  }
  if (customer.customer_status === "REJECTED") {
    throw new Error("CUSTOMER_REGISTRATION_REJECTED");
  }
  if (customer.customer_status === "BLOCKED") {
    throw new Error("CUSTOMER_BLOCKED");
  }
  if (
    customer.customer_status !== "ACTIVE" ||
    user.status !== "ACTIVE"
  ) {
    throw new Error("CUSTOMER_LOGIN_DISABLED");
  }

  const token = jwt.sign(
    {
      userId: user.user_id.toString(),
      role: user.role,
      tokenVersion: user.token_version,
    },
    env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  await prisma.$transaction(async (transaction) => {
    await transaction.users.update({
      where: { user_id: user.user_id },
      data: {
        last_login_at: new Date(),
        failed_login_attempts: 0,
        locked_until: null,
      },
    });
    await createAuditLog(
      {
        ...auditContext,
        userId: user.user_id,
        action: "LOGIN",
        entity: "USER",
        entityId: user.user_id,
      },
      transaction
    );
  });

  return {
    token,
    user: {
      userId: user.user_id.toString(),
      email: user.email,
      role: user.role,
    },
  };
}

export async function logout(userId: bigint, auditContext: AuditContext) {
  await prisma.$transaction(async (transaction) => {
    await transaction.users.update({
      where: { user_id: userId },
      data: { token_version: { increment: 1 } },
    });
    await createAuditLog(
      {
        ...auditContext,
        userId,
        action: "LOGOUT",
        entity: "USER",
        entityId: userId,
      },
      transaction
    );
  });
}
