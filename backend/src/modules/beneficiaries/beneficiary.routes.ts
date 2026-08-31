import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  createBeneficiaryController,
  deleteBeneficiaryController,
  listBeneficiariesController,
} from "./beneficiary.controller";

const router = Router();

router.use(authenticate);
router.post("/", createBeneficiaryController);
router.get("/", listBeneficiariesController);
router.delete("/:beneficiaryId", deleteBeneficiaryController);

export default router;
