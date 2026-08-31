// src/modules/auth/auth.routes.ts

import { Router } from "express";
import {
  registerController,
  loginController,
  logoutController,
  resendOtpController,
  verifyOtpController,
  requestCustomerIdRecoveryController,
  verifyCustomerIdRecoveryController,
  requestPasswordRecoveryController,
  verifyPasswordRecoveryController,
  resetRecoveredPasswordController,
  completeRegistrationController,
} from "./auth.controller";
import { authenticate } from "../../middleware/auth.middleware";
import {
  loginRateLimiter,
  registerRateLimiter,
  resendOtpRateLimiter,
  recoveryRequestRateLimiter,
  recoveryVerifyRateLimiter,
} from "../../middleware/rate-limit.middleware";

const router = Router();

router.post("/register", registerRateLimiter, registerController);
router.post("/verify-otp", verifyOtpController);
router.post("/complete-registration", registerRateLimiter, completeRegistrationController);
router.post("/resend-otp", resendOtpRateLimiter, resendOtpController);
router.post("/login", loginRateLimiter, loginController);
router.post("/logout", authenticate, logoutController);
router.post(
  "/recovery/customer-id/request",
  recoveryRequestRateLimiter,
  requestCustomerIdRecoveryController
);
router.post(
  "/recovery/customer-id/verify",
  recoveryVerifyRateLimiter,
  verifyCustomerIdRecoveryController
);
router.post(
  "/recovery/password/request",
  recoveryRequestRateLimiter,
  requestPasswordRecoveryController
);
router.post(
  "/recovery/password/verify",
  recoveryVerifyRateLimiter,
  verifyPasswordRecoveryController
);
router.post(
  "/recovery/password/reset",
  recoveryVerifyRateLimiter,
  resetRecoveredPasswordController
);

export default router;
