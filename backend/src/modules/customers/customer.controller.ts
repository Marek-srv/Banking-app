import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import { createCustomerSchema } from "./customer.schema";
import { createCustomer, getMyProfile } from "./customer.service";

export async function createCustomerController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = createCustomerSchema.parse(req.body);
    const customer = await createCustomer(
      BigInt(req.user!.userId),
      data,
      getAuditContext(req)
    );
    return res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}

export async function getMyProfileController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const customer = await getMyProfile(BigInt(req.user!.userId));
    return res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
}
