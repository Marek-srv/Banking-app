import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import {
  blockCardController,
  getCardController,
  listCardsController,
  unblockCardController,
} from "./card.controller";

const router = Router();

router.use(authenticate);
router.get("/", listCardsController);
router.get("/:cardId", getCardController);
router.patch("/:cardId/block", blockCardController);
router.patch("/:cardId/unblock", unblockCardController);

export default router;
