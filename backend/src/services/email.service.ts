import { appendFile } from "node:fs/promises";
import nodemailer from "nodemailer";
import { env } from "../config/env";

const testOtpCapture = new Map<string, string>();

const transporter = env.SMTP
  ? nodemailer.createTransport({
      host: env.SMTP.host,
      port: env.SMTP.port,
      secure: env.SMTP.secure,
      auth: {
        user: env.SMTP.user,
        pass: env.SMTP.pass,
      },
    })
  : null;

type OtpEmailOptions = {
  subject: string;
  heading: string;
  developmentLabel: string;
  ignoreMessage: string;
};

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

function textTemplate(otp: string, options: OtpEmailOptions) {
  return [
    "π Bank",
    "",
    options.heading,
    "",
    "Your verification code is:",
    "",
    otp,
    "",
    "This code expires in 10 minutes.",
    "",
    options.ignoreMessage,
  ].join("\n");
}

function htmlTemplate(otp: string, options: OtpEmailOptions) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#F6F8FB;font-family:Inter,Arial,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F8FB;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E4E7EC;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#0B1F3A;padding:22px 28px;color:#FFFFFF;font-size:24px;font-weight:700;">π Bank</td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">
                <h1 style="margin:0;color:#0B1F3A;font-size:22px;line-height:30px;">${options.heading}</h1>
                <p style="margin:18px 0 0;font-size:14px;line-height:22px;color:#667085;">Your verification code is:</p>
                <div style="margin:18px 0;padding:18px;border-radius:12px;background:#EAF2FB;color:#0B63E5;font-size:30px;font-weight:700;letter-spacing:8px;text-align:center;">${otp}</div>
                <p style="margin:0;font-size:14px;line-height:22px;color:#172033;">This code expires in 10 minutes.</p>
                <p style="margin:20px 0 0;padding-top:20px;border-top:1px solid #E4E7EC;font-size:12px;line-height:19px;color:#667085;">${options.ignoreMessage}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function captureOtpForAutomatedRun(email: string, otp: string) {
  const nodeEnvironment = process.env.NODE_ENV ?? env.NODE_ENV;

  if (nodeEnvironment === "test") {
    testOtpCapture.set(email.toLowerCase(), otp);
    return true;
  }

  const localCaptureFile = process.env.OTP_STRESS_CAPTURE_FILE?.trim();
  if (localCaptureFile && ["development", "stress"].includes(nodeEnvironment)) {
    await appendFile(
      localCaptureFile,
      `${JSON.stringify({ email, otp, createdAt: new Date().toISOString() })}\n`,
      { encoding: "utf8", mode: 0o600 }
    );
    return true;
  }

  return false;
}

function logDevelopmentOtp(email: string, otp: string, label: string) {
  console.log(`[DEV ONLY] ${label} OTP for ${email}: ${otp}`);
}

async function sendOtp(email: string, otp: string, options: OtpEmailOptions) {
  const nodeEnvironment = process.env.NODE_ENV ?? env.NODE_ENV;
  if (await captureOtpForAutomatedRun(email, otp)) return;

  if (transporter && env.SMTP) {
    try {
      const result = await transporter.sendMail({
        from: env.SMTP.from,
        to: email,
        subject: options.subject,
        text: textTemplate(otp, options),
        html: htmlTemplate(otp, options),
      });
      const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
      const rejected = Array.isArray(result.rejected) ? result.rejected.length : 0;
      console.info(
        `[EMAIL] ${options.developmentLabel} delivery for ${maskEmail(email)}: accepted=${accepted}, rejected=${rejected}`
      );
      return;
    } catch {
      if (env.EMAIL_DEV_MODE && nodeEnvironment !== "production") {
        console.warn("[DEV ONLY] SMTP delivery failed; using the explicit EMAIL_DEV_MODE fallback.");
        logDevelopmentOtp(email, otp, options.developmentLabel);
        return;
      }

      throw new Error("EMAIL_DELIVERY_FAILED");
    }
  }

  if (env.EMAIL_DEV_MODE && nodeEnvironment !== "production") {
    logDevelopmentOtp(email, otp, options.developmentLabel);
    return;
  }

  throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");
}

export async function sendEmailVerificationOtp(email: string, otp: string) {
  return sendOtp(email, otp, {
    subject: "π Bank — Email Verification OTP",
    heading: "Verify your email",
    developmentLabel: "Email verification",
    ignoreMessage: "If you did not request this registration, ignore this email.",
  });
}

export async function sendAccountRecoveryOtp(
  email: string,
  otp: string,
  purpose: "CUSTOMER_ID" | "PASSWORD_RESET"
) {
  const customerIdRecovery = purpose === "CUSTOMER_ID";
  return sendOtp(email, otp, {
    subject: customerIdRecovery
      ? "π Bank — Customer ID Recovery OTP"
      : "π Bank — Password Reset OTP",
    heading: customerIdRecovery ? "Recover your Customer ID" : "Reset your password",
    developmentLabel: customerIdRecovery ? "Customer ID recovery" : "Password reset",
    ignoreMessage: "If you did not request this action, ignore this email.",
  });
}

export function getCapturedOtpForTest(email: string) {
  if ((process.env.NODE_ENV ?? env.NODE_ENV) !== "test") {
    throw new Error("OTP test capture is only available in test mode");
  }

  return testOtpCapture.get(email.toLowerCase());
}

export function clearCapturedOtpsForTest() {
  if ((process.env.NODE_ENV ?? env.NODE_ENV) === "test") testOtpCapture.clear();
}
