import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  createCustomerController,
  getMyProfileController,
} from "./customer.controller";

const router = Router();

router.post("/", authenticate, createCustomerController);
router.get("/me", authenticate, getMyProfileController);

export default router;