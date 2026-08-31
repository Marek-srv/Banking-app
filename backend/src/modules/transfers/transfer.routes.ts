import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { createTransferController } from "./transfer.controller";
import { transactionRateLimiter } from "../../middleware/rate-limit.middleware";

const router = Router();

router.post(
  "/",
  authenticate,
  transactionRateLimiter,
  createTransferController
);

export default router;
