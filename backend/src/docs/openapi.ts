const bearerSecurity = [{ bearerAuth: [] }];

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" },
    },
  },
});

const commonErrors = {
  "400": errorResponse("Invalid request"),
  "401": errorResponse("Authentication required"),
  "403": errorResponse("Access denied"),
  "404": errorResponse("Resource not found"),
  "409": errorResponse("Business rule conflict"),
  "429": errorResponse("Rate limit exceeded"),
};

const successResponse = (description = "Success") => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/SuccessResponse" },
    },
  },
});

const jsonBody = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } },
});

const idParameter = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[1-9][0-9]*$" },
});

const paginationParameters = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
];

const idempotencyParameter = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  schema: { type: "string", minLength: 8, maxLength: 128 },
  description: "User-scoped key that makes retries return the original result.",
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Banking Backend V1 API",
    version: "1.0.0",
    description: "Local Banking Backend V1. Financial writes are transactional and ledger-backed.",
  },
  servers: [{ url: "http://localhost:3000" }],
  tags: [
    "Auth",
    "Customers",
    "Accounts",
    "Beneficiaries",
    "Transactions",
    "Transfers",
    "Cards",
    "Branches",
    "ATMs",
    "Employees",
    "Admin",
    "Assistant",
  ].map((name) => ({ name })),
  paths: {
    "/api/v1/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Start customer registration and send an email OTP",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/RegistrationStart" }),
        responses: { "201": successResponse("Pending registration created"), ...commonErrors },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with Customer ID",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/CustomerLoginCredentials" }),
        responses: { "200": successResponse("JWT issued"), ...commonErrors },
      },
    },
    "/api/v1/auth/verify-otp": {
      post: {
        tags: ["Auth"],
        summary: "Verify a newly registered email with a six-digit OTP",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/VerifyOtp" }),
        responses: { "200": successResponse("Email verified and short-lived registration token issued"), ...commonErrors },
      },
    },
    "/api/v1/auth/complete-registration": {
      post: {
        tags: ["Auth"],
        summary: "Create the verified user and customer atomically",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/CompleteRegistration" }),
        responses: { "201": successResponse("Customer ID issued; no login token is returned"), ...commonErrors },
      },
    },
    "/api/v1/auth/resend-otp": {
      post: {
        tags: ["Auth"],
        summary: "Invalidate the previous OTP and send a new one when eligible",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/ResendOtp" }),
        responses: { "200": successResponse("Generic resend result"), ...commonErrors },
      },
    },
    "/api/v1/auth/recovery/customer-id/request": {
      post: {
        tags: ["Auth"],
        summary: "Request a Customer ID recovery OTP",
        description: "Always returns a generic response to limit account enumeration.",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/CustomerIdRecoveryRequest" }),
        responses: { "200": successResponse("Generic recovery result"), ...commonErrors },
      },
    },
    "/api/v1/auth/recovery/customer-id/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify the recovery OTP and reveal the Customer ID",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/CustomerIdRecoveryVerify" }),
        responses: { "200": successResponse("Customer ID recovered"), ...commonErrors },
      },
    },
    "/api/v1/auth/recovery/password/request": {
      post: {
        tags: ["Auth"],
        summary: "Request a password-reset OTP",
        description: "Returns only a masked email and a generic delivery result.",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/PasswordRecoveryRequest" }),
        responses: { "200": successResponse("Generic recovery result"), ...commonErrors },
      },
    },
    "/api/v1/auth/recovery/password/verify": {
      post: {
        tags: ["Auth"],
        summary: "Verify the password-reset OTP",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/PasswordRecoveryVerify" }),
        responses: { "200": successResponse("Short-lived reset authorization issued"), ...commonErrors },
      },
    },
    "/api/v1/auth/recovery/password/reset": {
      post: {
        tags: ["Auth"],
        summary: "Set a new password using one-time reset authorization",
        security: [],
        requestBody: jsonBody({ $ref: "#/components/schemas/PasswordRecoveryReset" }),
        responses: { "200": successResponse("Password reset"), ...commonErrors },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Invalidate all current JWTs for the logged-in user",
        security: bearerSecurity,
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/customers": {
      post: {
        tags: ["Customers"],
        summary: "Create the authenticated user's customer profile",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateCustomer" }),
        responses: { "201": successResponse("Customer created"), ...commonErrors },
      },
    },
    "/api/v1/customers/me": {
      get: {
        tags: ["Customers"],
        summary: "Get the authenticated customer's profile",
        security: bearerSecurity,
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/accounts": {
      get: {
        tags: ["Accounts"],
        summary: "List owned accounts",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: { "200": successResponse(), ...commonErrors },
      },
      post: {
        tags: ["Accounts"],
        summary: "Create an account for the authenticated customer",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          required: ["accountType"],
          properties: { accountType: { type: "string", enum: ["SAVINGS", "CURRENT"] } },
          additionalProperties: false,
        }),
        responses: { "201": successResponse("Account created"), ...commonErrors },
      },
    },
    "/api/v1/accounts/{accountId}": {
      get: {
        tags: ["Accounts"],
        summary: "Get an owned account",
        security: bearerSecurity,
        parameters: [idParameter("accountId")],
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/accounts/{accountId}/statement": {
      get: {
        tags: ["Accounts"],
        summary: "Download an owned account statement",
        security: bearerSecurity,
        parameters: [
          idParameter("accountId"),
          { name: "from", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "to", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "format", in: "query", required: false, schema: { type: "string", enum: ["pdf", "csv"], default: "pdf" } },
        ],
        responses: {
          "200": {
            description: "Generated statement file",
            headers: { "Content-Disposition": { schema: { type: "string" } } },
            content: {
              "application/pdf": { schema: { type: "string", format: "binary" } },
              "text/csv": { schema: { type: "string" } },
            },
          },
          ...commonErrors,
        },
      },
    },
    "/api/v1/beneficiaries": {
      get: {
        tags: ["Beneficiaries"],
        summary: "List owned active beneficiaries",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: { "200": successResponse(), ...commonErrors },
      },
      post: {
        tags: ["Beneficiaries"],
        summary: "Create a beneficiary",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateBeneficiary" }),
        responses: { "201": successResponse("Beneficiary created"), ...commonErrors },
      },
    },
    "/api/v1/beneficiaries/{beneficiaryId}": {
      delete: {
        tags: ["Beneficiaries"],
        summary: "Soft-delete an owned beneficiary",
        security: bearerSecurity,
        parameters: [idParameter("beneficiaryId")],
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/transactions": {
      get: {
        tags: ["Transactions"],
        summary: "List owned transactions",
        security: bearerSecurity,
        parameters: [
          ...paginationParameters,
          { name: "type", in: "query", schema: { type: "string", enum: ["TRANSFER", "DEPOSIT", "WITHDRAWAL", "REVERSAL"] } },
          { name: "status", in: "query", schema: { type: "string", enum: ["INITIATED", "PROCESSING", "COMPLETED", "FAILED"] } },
          { name: "from", in: "query", schema: { type: "string", format: "date" } },
          { name: "to", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/transactions/{transactionId}": {
      get: {
        tags: ["Transactions"],
        summary: "Get an owned transaction with details, history, and owned ledger rows",
        security: bearerSecurity,
        parameters: [idParameter("transactionId")],
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/transactions/{transactionId}/receipt": {
      get: {
        tags: ["Transactions"],
        summary: "Download a receipt for an owned transaction",
        security: bearerSecurity,
        parameters: [idParameter("transactionId")],
        responses: {
          "200": {
            description: "Generated PDF receipt",
            headers: { "Content-Disposition": { schema: { type: "string" } } },
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
          },
          ...commonErrors,
        },
      },
    },
    "/api/v1/transactions/deposit": {
      post: {
        tags: ["Transactions"],
        summary: "Deposit into an owned account",
        security: bearerSecurity,
        parameters: [idempotencyParameter],
        requestBody: jsonBody({ $ref: "#/components/schemas/CashOperation" }),
        responses: { "201": successResponse("Deposit completed"), ...commonErrors },
      },
    },
    "/api/v1/transactions/withdraw": {
      post: {
        tags: ["Transactions"],
        summary: "Withdraw from an owned account",
        security: bearerSecurity,
        parameters: [idempotencyParameter],
        requestBody: jsonBody({ $ref: "#/components/schemas/CashOperation" }),
        responses: { "201": successResponse("Withdrawal completed"), ...commonErrors },
      },
    },
    "/api/v1/transactions/{transactionId}/reverse": {
      post: {
        tags: ["Transactions"],
        summary: "Reverse an eligible completed owned transaction",
        security: bearerSecurity,
        parameters: [idParameter("transactionId")],
        responses: { "201": successResponse("Reversal completed"), ...commonErrors },
      },
    },
    "/api/v1/transfers": {
      post: {
        tags: ["Transfers"],
        summary: "Transfer between active accounts",
        security: bearerSecurity,
        parameters: [idempotencyParameter],
        requestBody: jsonBody({ $ref: "#/components/schemas/Transfer" }),
        responses: { "201": successResponse("Transfer completed"), ...commonErrors },
      },
    },
    "/api/v1/cards": {
      get: {
        tags: ["Cards"],
        summary: "List owned cards",
        security: bearerSecurity,
        parameters: paginationParameters,
        responses: { "200": successResponse(), ...commonErrors },
      },
      post: {
        tags: ["Cards"],
        summary: "Create a synthetic masked card",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateCard" }),
        responses: { "201": successResponse("Card created"), ...commonErrors },
      },
    },
    "/api/v1/cards/{cardId}": {
      get: {
        tags: ["Cards"],
        summary: "Get an owned card",
        security: bearerSecurity,
        parameters: [idParameter("cardId")],
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/cards/{cardId}/block": {
      patch: {
        tags: ["Cards"], summary: "Block an owned card", security: bearerSecurity,
        parameters: [idParameter("cardId")], responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/cards/{cardId}/unblock": {
      patch: {
        tags: ["Cards"], summary: "Unblock an owned card", security: bearerSecurity,
        parameters: [idParameter("cardId")], responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/branches": {
      get: {
        tags: ["Branches"], summary: "List branches with ATM summaries", security: bearerSecurity,
        parameters: paginationParameters, responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/branches/{branchId}": {
      get: {
        tags: ["Branches"], summary: "Get a branch", security: bearerSecurity,
        parameters: [idParameter("branchId")], responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/atms": {
      get: {
        tags: ["ATMs"], summary: "List ATMs", security: bearerSecurity,
        parameters: paginationParameters, responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/atms/{atmId}": {
      get: {
        tags: ["ATMs"], summary: "Get an ATM with branch information", security: bearerSecurity,
        parameters: [idParameter("atmId")], responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/employees": {
      get: {
        tags: ["Employees"], summary: "List employees (EMPLOYEE or ADMIN)", security: bearerSecurity,
        parameters: paginationParameters, responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/employees/{employeeId}": {
      get: {
        tags: ["Employees"], summary: "Get employee (EMPLOYEE or ADMIN)", security: bearerSecurity,
        parameters: [idParameter("employeeId")], responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/admin/employees": {
      post: {
        tags: ["Admin"], summary: "Create an employee", security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/CreateEmployee" }),
        responses: { "201": successResponse("Employee created"), ...commonErrors },
      },
    },
    "/api/v1/admin/employees/{employeeId}/status": {
      patch: {
        tags: ["Admin"], summary: "Update employee status", security: bearerSecurity,
        parameters: [idParameter("employeeId")],
        requestBody: jsonBody({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ACTIVE", "INACTIVE"] } } }),
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/admin/customers": {
      get: {
        tags: ["Admin"], summary: "List customers", security: bearerSecurity,
        parameters: paginationParameters, responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/admin/customers/{customerId}/status": {
      patch: {
        tags: ["Admin"], summary: "Update customer and login status", security: bearerSecurity,
        parameters: [idParameter("customerId")],
        requestBody: jsonBody({ type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ACTIVE", "INACTIVE", "SUSPENDED"] } } }),
        responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/admin/accounts": {
      get: {
        tags: ["Admin"], summary: "List accounts", security: bearerSecurity,
        parameters: paginationParameters, responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/admin/accounts/{accountId}/freeze": {
      patch: {
        tags: ["Admin"], summary: "Freeze an account", security: bearerSecurity,
        parameters: [idParameter("accountId")], responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/admin/accounts/{accountId}/unfreeze": {
      patch: {
        tags: ["Admin"], summary: "Unfreeze an account", security: bearerSecurity,
        parameters: [idParameter("accountId")], responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/admin/transactions": {
      get: {
        tags: ["Admin"], summary: "List transactions", security: bearerSecurity,
        parameters: paginationParameters, responses: { "200": successResponse(), ...commonErrors },
      },
    },
    "/api/v1/assistant/query": {
      post: {
        tags: ["Assistant"],
        summary: "Ask a read-only question about the authenticated customer's banking activity",
        description: "Trusted backend analytics calculate the result. Ollama only explains the approved result and receives no SQL or ledger access.",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/AssistantQuery" }),
        responses: {
          "200": successResponse("Concise banking analytics answer"),
          "503": errorResponse("The configured local Ollama service is unavailable"),
          ...commonErrors,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      SuccessResponse: {
        type: "object",
        required: ["success", "data"],
        properties: { success: { type: "boolean", example: true }, data: {} },
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", example: false },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: { code: { type: "string" }, message: { type: "string" }, details: {} },
          },
        },
      },
      RegistrationStart: {
        type: "object",
        required: ["firstName", "lastName", "dateOfBirth", "mobile", "email"],
        additionalProperties: false,
        properties: {
          firstName: { type: "string", minLength: 2, maxLength: 100 },
          lastName: { type: "string", minLength: 2, maxLength: 100 },
          dateOfBirth: { type: "string", format: "date" },
          mobile: { type: "string", pattern: "^[6-9][0-9]{9}$" },
          email: { type: "string", format: "email" },
        },
      },
      CustomerLoginCredentials: {
        type: "object", required: ["customerId", "password"], additionalProperties: false,
        properties: {
          customerId: { type: "string", minLength: 1, maxLength: 30, example: "CUST00001234" },
          password: { type: "string", format: "password", minLength: 1, maxLength: 128, example: "Password@123" },
        },
      },
      VerifyOtp: {
        type: "object", required: ["email", "otp"], additionalProperties: false,
        properties: { email: { type: "string", format: "email" }, otp: { type: "string", pattern: "^[0-9]{6}$" } },
      },
      ResendOtp: {
        type: "object", required: ["email"], additionalProperties: false,
        properties: { email: { type: "string", format: "email" } },
      },
      CompleteRegistration: {
        type: "object",
        required: ["registrationToken", "password", "confirmPassword"],
        additionalProperties: false,
        properties: {
          registrationToken: { type: "string", pattern: "^[a-f0-9]{64}$" },
          password: { type: "string", format: "password", minLength: 12, maxLength: 128 },
          confirmPassword: { type: "string", format: "password", minLength: 12, maxLength: 128 },
        },
      },
      CustomerIdRecoveryRequest: {
        type: "object", required: ["email", "dateOfBirth"], additionalProperties: false,
        properties: {
          email: { type: "string", format: "email" },
          dateOfBirth: { type: "string", format: "date" },
        },
      },
      CustomerIdRecoveryVerify: {
        type: "object", required: ["email", "dateOfBirth", "otp"], additionalProperties: false,
        properties: {
          email: { type: "string", format: "email" },
          dateOfBirth: { type: "string", format: "date" },
          otp: { type: "string", pattern: "^[0-9]{6}$" },
        },
      },
      PasswordRecoveryRequest: {
        type: "object", required: ["customerId"], additionalProperties: false,
        properties: { customerId: { type: "string", minLength: 1, maxLength: 30, example: "CUST00001234" } },
      },
      PasswordRecoveryVerify: {
        type: "object", required: ["customerId", "otp"], additionalProperties: false,
        properties: {
          customerId: { type: "string", minLength: 1, maxLength: 30, example: "CUST00001234" },
          otp: { type: "string", pattern: "^[0-9]{6}$" },
        },
      },
      PasswordRecoveryReset: {
        type: "object", required: ["customerId", "resetToken", "newPassword"], additionalProperties: false,
        properties: {
          customerId: { type: "string", minLength: 1, maxLength: 30, example: "CUST00001234" },
          resetToken: { type: "string", pattern: "^[a-f0-9]{64}$" },
          newPassword: { type: "string", format: "password", minLength: 12, maxLength: 128 },
        },
      },
      CreateCustomer: {
        type: "object", required: ["branchId", "firstName", "lastName"], additionalProperties: false,
        properties: { branchId: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, phone: { type: "string" }, dateOfBirth: { type: "string", format: "date" }, gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] }, address: { type: "string" }, city: { type: "string" }, state: { type: "string" }, country: { type: "string", default: "India" }, postalCode: { type: "string" } },
      },
      CreateBeneficiary: {
        type: "object", required: ["beneficiaryName", "beneficiaryAccountNo"], additionalProperties: false,
        properties: { beneficiaryName: { type: "string" }, beneficiaryAccountNo: { type: "string", pattern: "^[0-9]{6,20}$" }, bankName: { type: "string" }, bankCode: { type: "string" }, nickname: { type: "string" } },
      },
      CashOperation: {
        type: "object", required: ["accountId", "amount"], additionalProperties: false,
        properties: { accountId: { type: "string" }, amount: { type: "number", minimum: 0, exclusiveMinimum: true } },
      },
      Transfer: {
        type: "object", required: ["sourceAccountId", "destinationAccountId", "amount"], additionalProperties: false,
        properties: { sourceAccountId: { type: "string" }, destinationAccountId: { type: "string" }, amount: { type: "number", minimum: 0, exclusiveMinimum: true } },
      },
      CreateCard: {
        type: "object", required: ["accountId", "cardType"], additionalProperties: false,
        properties: { accountId: { type: "string" }, cardType: { type: "string", enum: ["DEBIT", "CREDIT"] } },
      },
      CreateEmployee: {
        type: "object", required: ["branchId", "employeeNumber", "firstName", "lastName"], additionalProperties: false,
        properties: { branchId: { type: "string" }, employeeNumber: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, position: { type: "string" }, phone: { type: "string" }, email: { type: "string", format: "email" }, gender: { type: "string", enum: ["MALE", "FEMALE", "OTHER"] }, hireDate: { type: "string", format: "date" }, qualification: { type: "string" } },
      },
      AssistantQuery: {
        type: "object",
        required: ["question"],
        additionalProperties: false,
        properties: {
          question: {
            type: "string",
            minLength: 3,
            maxLength: 300,
            example: "Where did I spend the most this month?",
          },
        },
      },
    },
  },
};
