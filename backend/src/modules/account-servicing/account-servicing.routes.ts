import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middleware/auth.middleware";
import { cancelClosureRequestController, cancelTransferLimitRequestController, createClosureRequestController, createTransferLimitRequestController, listClosureRequestsController, listTransferLimitRequestsController } from "./account-servicing.controller";

export const closureRequestRouter = Router();
closureRequestRouter.use(authenticate, authorizeRoles("CUSTOMER"));
closureRequestRouter.post("/", createClosureRequestController);
closureRequestRouter.get("/", listClosureRequestsController);
closureRequestRouter.post("/:requestId/cancel", cancelClosureRequestController);

export const transferLimitRequestRouter = Router();
transferLimitRequestRouter.use(authenticate, authorizeRoles("CUSTOMER"));
transferLimitRequestRouter.post("/", createTransferLimitRequestController);
transferLimitRequestRouter.get("/", listTransferLimitRequestsController);
transferLimitRequestRouter.post("/:requestId/cancel", cancelTransferLimitRequestController);
