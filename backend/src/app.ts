// src/app.ts

import express from "express";
import cors from "cors";
import authRoutes from "./modules/auth/auth.routes";
import customerRoutes from "./modules/customers/customer.routes";
import accountRoutes from "./modules/accounts/account.routes";
import beneficiaryRoutes from "./modules/beneficiaries/beneficiary.routes";
import transactionRoutes from "./modules/transactions/transaction.routes";
import transferRoutes from "./modules/transfers/transfer.routes";
import cardRoutes from "./modules/cards/card.routes";
import cardRequestRoutes from "./modules/cards/card-request.routes";
import branchRoutes from "./modules/branches/branch.routes";
import atmRoutes from "./modules/atms/atm.routes";
import employeeRoutes from "./modules/employees/employee.routes";
import adminRoutes from "./modules/admin/admin.routes";
import assistantRoutes from "./modules/assistant/assistant.routes";
import accountRequestRoutes from "./modules/account-requests/account-request.routes";
import { closureRequestRouter, transferLimitRequestRouter } from "./modules/account-servicing/account-servicing.routes";
import { loanRequestRouter, loanRouter } from "./modules/loans/loan.routes";
import { errorMiddleware } from "./middleware/error.middleware";
import { AppError } from "./errors/app-error";
import { env } from "./config/env";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openapi";

const app = express();

app.set("json replacer", (_key: string, value: any) => {
  return typeof value === "bigint" ? value.toString() : value;
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.FRONTEND_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new AppError(403, "CORS_ORIGIN_DENIED", "Origin not allowed"));
    },
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Banking API is running",
  });
});

app.get("/api-docs.json", (_req, res) => res.json(openApiDocument));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/account-requests", accountRequestRoutes);
app.use("/api/v1/account-closure-requests", closureRequestRouter);
app.use("/api/v1/transfer-limit-requests", transferLimitRequestRouter);
app.use("/api/v1/loan-requests", loanRequestRouter);
app.use("/api/v1/loans", loanRouter);
app.use("/api/v1/beneficiaries", beneficiaryRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/transfers", transferRoutes);
app.use("/api/v1/cards", cardRoutes);
app.use("/api/v1/card-requests", cardRequestRoutes);
app.use("/api/v1/branches", branchRoutes);
app.use("/api/v1/atms", atmRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/assistant", assistantRoutes);

app.use((_req, _res, next) => {
  next(new AppError(404, "ROUTE_NOT_FOUND", "Route not found"));
});

app.use(errorMiddleware);

export default app;
