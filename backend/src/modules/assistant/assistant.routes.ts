import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { assistantRateLimiter } from "../../middleware/rate-limit.middleware";
import { queryAssistantController } from "./assistant.controller";

const router = Router();

router.use(authenticate);
router.post("/query", assistantRateLimiter, queryAssistantController);

export default router;
