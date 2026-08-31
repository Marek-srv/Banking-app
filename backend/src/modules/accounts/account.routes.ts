import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  getAccountController,
  listAccountsController,
  downloadStatementController,
} from "./account.controller";

const router = Router();

router.use(authenticate);
router.get("/", listAccountsController);
router.get("/:accountId/statement", downloadStatementController);
router.get("/:accountId", getAccountController);

export default router;
