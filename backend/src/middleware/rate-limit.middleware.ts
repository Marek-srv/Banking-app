import { rateLimit } from "express-rate-limit";

function rateLimitHandler(message: string) {
  return (_req: unknown, res: any) => {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
      },
    });
  };
}

const skipDuringTests = () => process.env.NODE_ENV === "test";

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipDuringTests,
  handler: rateLimitHandler("Too many registration attempts"),
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipDuringTests,
  handler: rateLimitHandler("Too many login attempts"),
});

export const resendOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipDuringTests,
  handler: rateLimitHandler("Too many OTP resend attempts"),
});

export const recoveryRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipDuringTests,
  handler: rateLimitHandler("Too many account recovery requests"),
});

export const recoveryVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipDuringTests,
  handler: rateLimitHandler("Too many account recovery verification attempts"),
});

export const transactionRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipDuringTests,
  handler: rateLimitHandler("Too many transaction requests"),
});

export const assistantRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipDuringTests,
  handler: rateLimitHandler("Too many assistant requests"),
});
