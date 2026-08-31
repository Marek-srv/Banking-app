import { NextFunction, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.middleware";
import { getEmployee, listEmployees } from "./employee.service";
import { paginationQuerySchema } from "../../schemas/pagination.schema";

const employeeIdSchema = z.coerce.bigint().positive();

export async function listEmployeesController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const pagination = paginationQuerySchema.parse(req.query);
    return res.json({
      success: true,
      data: await listEmployees(pagination),
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmployeeController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const employeeId = employeeIdSchema.parse(req.params.employeeId);
    return res.json({
      success: true,
      data: await getEmployee(employeeId),
    });
  } catch (error) {
    next(error);
  }
}
