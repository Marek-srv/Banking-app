import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAuditContext } from "../../middleware/audit.middleware";
import {
  beneficiaryIdSchema,
  createBeneficiarySchema,
} from "./beneficiary.schema";
import {
  createBeneficiary,
  deleteBeneficiary,
  listBeneficiaries,
} from "./beneficiary.service";
import { paginationQuerySchema } from "../../schemas/pagination.schema";

export async function createBeneficiaryController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = createBeneficiarySchema.parse(req.body);
    const beneficiary = await createBeneficiary(
      BigInt(req.user!.userId),
      input,
      getAuditContext(req)
    );
    return res.status(201).json({ success: true, data: beneficiary });
  } catch (error) {
    next(error);
  }
}

export async function listBeneficiariesController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination = paginationQuerySchema.parse(req.query);
    const beneficiaries = await listBeneficiaries(
      BigInt(req.user!.userId),
      pagination
    );
    return res.json({
      success: true,
      data: beneficiaries.items,
      pagination: beneficiaries.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteBeneficiaryController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const beneficiaryId = beneficiaryIdSchema.parse(
      req.params.beneficiaryId
    );
    const beneficiary = await deleteBeneficiary(
      BigInt(req.user!.userId),
      beneficiaryId
    );
    return res.json({ success: true, data: beneficiary });
  } catch (error) {
    next(error);
  }
}
