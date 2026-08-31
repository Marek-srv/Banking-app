import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  getBranchController,
  listBranchesController,
} from "./branch.controller";

const router = Router();

router.use(authenticate);
router.get("/", listBranchesController);
router.get("/:branchId", getBranchController);

export default router;
