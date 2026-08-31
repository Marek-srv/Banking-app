import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middleware/auth.middleware";
import { cancelCardRequestController, createCardRequestController, listCustomerCardRequestsController } from "./card-request.controller";

const router = Router();
router.use(authenticate, authorizeRoles("CUSTOMER"));
router.post("/", createCardRequestController);
router.get("/", listCustomerCardRequestsController);
router.post("/:requestId/cancel", cancelCardRequestController);
export default router;
