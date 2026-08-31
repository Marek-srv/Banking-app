import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getBranch, listBranches } from "./branch.service";
import { paginationQuerySchema } from "../../schemas/pagination.schema";

const branchIdSchema = z.coerce.bigint().positive();

export async function listBranchesController(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination = paginationQuerySchema.parse(_req.query);
    const branches = await listBranches(pagination);
    return res.json({
      success: true,
      data: branches.items,
      pagination: branches.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getBranchController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const branchId = branchIdSchema.parse(req.params.branchId);
    return res.json({ success: true, data: await getBranch(branchId) });
  } catch (error) {
    next(error);
  }
}
