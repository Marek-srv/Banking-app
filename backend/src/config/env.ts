import "dotenv/config";

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const nodeEnvironment = process.env.NODE_ENV ?? "development";

function booleanEnvironmentVariable(name: string, defaultValue: boolean) {
  const value = process.env[name]?.trim().toLowerCase();

  if (!value) return defaultValue;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`${name} must be either true or false`);
}

const emailDevelopmentMode = booleanEnvironmentVariable("EMAIL_DEV_MODE", false);

if (nodeEnvironment === "production" && emailDevelopmentMode) {
  throw new Error("EMAIL_DEV_MODE cannot be enabled in production");
}

function onboardingBranchCode() {
  const code = (process.env.DEFAULT_ONBOARDING_BRANCH_CODE ?? "DIGITAL001")
    .trim()
    .toUpperCase();

  if (!/^[A-Z0-9-]{3,20}$/.test(code)) {
    throw new Error("DEFAULT_ONBOARDING_BRANCH_CODE must be a valid branch code");
  }

  return code;
}

function smtpConfiguration() {
  const host = process.env.SMTP_HOST?.trim();
  const portValue = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const secure = booleanEnvironmentVariable("SMTP_SECURE", false);
  const values = [host, portValue, user, pass, from];
  const configuredValues = values.filter(Boolean).length;

  if (configuredValues > 0 && configuredValues < values.length) {
    throw new Error(
      "SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM must all be configured together"
    );
  }

  if (configuredValues === 0) return null;

  const port = Number(portValue);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port");
  }

  return Object.freeze({ host: host!, port, secure, user: user!, pass: pass!, from: from! });
}

function ollamaConfiguration() {
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:0.5b";

  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() ?? "http://localhost:11434";
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("OLLAMA_BASE_URL must be a valid URL");
  }

  if (!(["http:", "https:"] as string[]).includes(parsedUrl.protocol)) {
    throw new Error("OLLAMA_BASE_URL must use http or https");
  }

  const timeoutValue = process.env.OLLAMA_TIMEOUT_MS?.trim() ?? "45000";
  const timeoutMs = Number(timeoutValue);

  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new Error("OLLAMA_TIMEOUT_MS must be between 1000 and 60000");
  }

  return Object.freeze({
    baseUrl: parsedUrl.toString().replace(/\/$/, ""),
    model,
    timeoutMs,
  });
}

export const env = Object.freeze({
  JWT_SECRET: (() => {
    const secret = requireEnvironmentVariable("JWT_SECRET");

    if (secret.length < 32) {
      throw new Error("JWT_SECRET must contain at least 32 characters");
    }

    return secret;
  })(),
  FRONTEND_ORIGINS: (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  NODE_ENV: nodeEnvironment,
  EMAIL_DEV_MODE: emailDevelopmentMode,
  SMTP: smtpConfiguration(),
  OLLAMA: ollamaConfiguration(),
  DEFAULT_ONBOARDING_BRANCH_CODE: onboardingBranchCode(),
  LOAN_LATE_FEE: (() => {
    const value = Number(process.env.LOAN_LATE_FEE ?? "500");
    if (!Number.isFinite(value) || value < 0) throw new Error("LOAN_LATE_FEE must be a non-negative number");
    return value;
  })(),
});
