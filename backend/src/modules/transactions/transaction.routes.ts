import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  depositController,
  getTransactionController,
  listTransactionsController,
  reverseTransactionController,
  withdrawController,
  downloadTransactionReceiptController,
} from "./transaction.controller";
import { transactionRateLimiter } from "../../middleware/rate-limit.middleware";

const router = Router();

router.use(authenticate);
router.post("/deposit", transactionRateLimiter, depositController);
router.post("/withdraw", transactionRateLimiter, withdrawController);
router.post(
  "/:transactionId/reverse",
  transactionRateLimiter,
  reverseTransactionController
);
router.get("/", listTransactionsController);
router.get("/:transactionId/receipt", downloadTransactionReceiptController);
router.get("/:transactionId", getTransactionController);

export default router;
