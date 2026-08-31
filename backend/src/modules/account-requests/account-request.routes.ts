import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middleware/auth.middleware";
import {
  cancelAccountRequestController,
  createAccountRequestController,
  listAccountRequestsController,
  updateAccountRequestController,
} from "./account-request.controller";

const router = Router();
router.use(authenticate, authorizeRoles("CUSTOMER"));
router.post("/", createAccountRequestController);
router.get("/", listAccountRequestsController);
router.patch("/:requestId", updateAccountRequestController);
router.post("/:requestId/cancel", cancelAccountRequestController);

export default router;
