import { NextFunction, Request, Response } from "express";
import { getAuditContext } from "../../middleware/audit.middleware";
import {
  loginSchema,
  registerSchema,
  resendOtpSchema,
  verifyOtpSchema,
  customerIdRecoveryRequestSchema,
  customerIdRecoveryVerifySchema,
  passwordRecoveryRequestSchema,
  passwordRecoveryVerifySchema,
  passwordRecoveryResetSchema,
  completeRegistrationSchema,
} from "./auth.schema";
import {
  login,
  logout,
  register,
  resendEmailOtp,
  verifyEmailOtp,
  completeRegistration,
} from "./auth.service";
import { AuthRequest } from "../../middleware/auth.middleware";
import {
  requestCustomerIdRecovery,
  requestPasswordRecovery,
  resetRecoveredPassword,
  verifyCustomerIdRecovery,
  verifyPasswordRecovery,
} from "./recovery.service";

export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await register(data);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function completeRegistrationController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = completeRegistrationSchema.parse(req.body);
    const result = await completeRegistration(
      data.registrationToken,
      data.password,
      getAuditContext(req)
    );
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function verifyOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = verifyOtpSchema.parse(req.body);
    const result = await verifyEmailOtp(data.email, data.otp);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function resendOtpController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = resendOtpSchema.parse(req.body);
    const result = await resendEmailOtp(data.email);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    await logout(BigInt(req.user!.userId), getAuditContext(req));
    return res.json({ success: true, data: { message: "Logged out" } });
  } catch (error) {
    next(error);
  }
}

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await login(
      data.customerId,
      data.password,
      getAuditContext(req)
    );
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function requestCustomerIdRecoveryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = customerIdRecoveryRequestSchema.parse(req.body);
    return res.json({
      success: true,
      data: await requestCustomerIdRecovery(data.email, data.dateOfBirth),
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyCustomerIdRecoveryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = customerIdRecoveryVerifySchema.parse(req.body);
    return res.json({
      success: true,
      data: await verifyCustomerIdRecovery(
        data.email,
        data.dateOfBirth,
        data.otp,
        getAuditContext(req)
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function requestPasswordRecoveryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = passwordRecoveryRequestSchema.parse(req.body);
    return res.json({
      success: true,
      data: await requestPasswordRecovery(data.customerId),
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPasswordRecoveryController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = passwordRecoveryVerifySchema.parse(req.body);
    return res.json({
      success: true,
      data: await verifyPasswordRecovery(data.customerId, data.otp),
    });
  } catch (error) {
    next(error);
  }
}

export async function resetRecoveredPasswordController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = passwordRecoveryResetSchema.parse(req.body);
    return res.json({
      success: true,
      data: await resetRecoveredPassword(
        data.customerId,
        data.resetToken,
        data.newPassword,
        getAuditContext(req)
      ),
    });
  } catch (error) {
    next(error);
  }
}
