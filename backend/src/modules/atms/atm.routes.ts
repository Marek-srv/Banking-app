import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { getAtmController, listAtmsController } from "./atm.controller";

const router = Router();

router.use(authenticate);
router.get("/", listAtmsController);
router.get("/:atmId", getAtmController);

export default router;
