import { Router } from "express";
import {
  authenticate,
  authorizeRoles,
} from "../../middleware/auth.middleware";
import {
  getEmployeeController,
  listEmployeesController,
} from "./employee.controller";

const router = Router();

router.use(authenticate, authorizeRoles("EMPLOYEE", "ADMIN"));
router.get("/", listEmployeesController);
router.get("/:employeeId", getEmployeeController);

export default router;
