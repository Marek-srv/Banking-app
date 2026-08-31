import { NextFunction, Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { assistantQuerySchema } from "./assistant.schema";
import { queryAssistant } from "./assistant.service";

export async function queryAssistantController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const input = assistantQuerySchema.parse(req.body);
    const result = await queryAssistant(BigInt(req.user!.userId), input.question);
    return res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
