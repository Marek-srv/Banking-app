import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getAtm, listAtms } from "./atm.service";
import { paginationQuerySchema } from "../../schemas/pagination.schema";

const atmIdSchema = z.coerce.bigint().positive();

export async function listAtmsController(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination = paginationQuerySchema.parse(_req.query);
    const atms = await listAtms(pagination);
    return res.json({
      success: true,
      data: atms.items,
      pagination: atms.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAtmController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const atmId = atmIdSchema.parse(req.params.atmId);
    return res.json({ success: true, data: await getAtm(atmId) });
  } catch (error) {
    next(error);
  }
}
