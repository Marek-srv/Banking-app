# π Bank

π Bank is a full-stack banking application built with React, Express, TypeScript, PostgreSQL, and Prisma. It includes customer onboarding, email OTP verification, account and card management, transfers backed by double-entry ledger records, downloadable statements and receipts, an administrative console, and an optional local AI banking assistant.

> This repository is intended for local development and demonstration. It has not been audited or certified for handling real money or production banking data.

## Features

### Customer banking

- Multi-step registration with email OTP verification
- Customer ID and password authentication using JWTs
- Customer ID and password recovery flows
- Dashboard with balances, recent activity, and charts
- Multiple account types and account opening
- Transaction history, filtering, details, and summaries
- Account-to-account transfers with idempotency support
- Beneficiary creation and management
- Card creation, status controls, and activity history
- Profile and security settings
- PDF account statements and transaction receipts
- Optional read-only assistant powered by a local Ollama model

### Administration

- Role-protected admin dashboard
- Customer, account, transaction, employee, branch, ATM, and card management
- Audit-log visibility
- Operational summaries and resource search/filtering

### Backend integrity and security

- Transactional, ledger-backed financial writes
- Row locking and balance validation for concurrent transfers
- Idempotency records for safely retried financial operations
- Password hashing with bcrypt
- JWT authentication and role-based authorization
- Zod request validation
- CORS allow-listing and endpoint rate limits
- Structured API errors and audit logging
- Integration, integrity, concurrency, invalid-input, and load tests

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query, Zustand, Axios, Tailwind CSS, Recharts |
| Backend | Node.js, Express 5, TypeScript, Zod, JWT, bcrypt, Nodemailer, PDFKit |
| Data | PostgreSQL, Prisma 7 with the PostgreSQL adapter |
| API documentation | OpenAPI 3.0 and Swagger UI |
| Testing | Node test runner, Supertest, Artillery |
| Optional AI | Ollama with `qwen2.5:0.5b` by default |

## Project structure

```text
banking-app/
├── backend/
│   ├── prisma/              # Prisma schema and SQL migrations
│   ├── scripts/             # Seed and verification utilities
│   ├── src/
│   │   ├── config/          # Environment, database, and Prisma setup
│   │   ├── docs/            # OpenAPI document
│   │   ├── middleware/      # Auth, audit, errors, and rate limiting
│   │   ├── modules/         # Domain controllers, routes, and services
│   │   └── services/        # Shared audit, email, document, and idempotency logic
│   ├── stress-tests/        # Artillery scenarios and integrity checks
│   └── tests/               # API and banking-integrity tests
├── frontend/
│   └── src/
│       ├── api/             # Typed API access by domain
│       ├── components/      # UI and feature components
│       ├── hooks/           # Authentication and data hooks
│       ├── pages/           # Customer and admin screens
│       ├── routes/          # Authentication/role guards
│       └── stores/          # Zustand authentication and registration state
└── README.md
```

## Prerequisites

- Node.js 20 or newer (a current LTS release is recommended)
- npm
- PostgreSQL running locally or accessible over the network
- Optional: an SMTP account for real OTP email delivery
- Optional: [Ollama](https://ollama.com/) for the local assistant

## Local setup

### 1. Create the PostgreSQL database

Create a database and a PostgreSQL user with permission to create and alter objects in it. The default example configuration expects a database named `banking_db` on `localhost:5432`.

For example, from `psql` as a privileged local user:

```sql
CREATE DATABASE banking_db;
```

### 2. Configure the backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
```

Edit `backend/.env` and, at minimum, set:

```dotenv
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/banking_db
JWT_SECRET=replace_this_with_a_random_secret_of_at_least_32_characters
FRONTEND_ORIGIN=http://localhost:5173
```

The separate `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` values are used by the PostgreSQL pool and must describe the same database as `DATABASE_URL`.

For local development without an SMTP server, remove or comment out all `SMTP_*` values and set:

```dotenv
EMAIL_DEV_MODE=true
```

Development email mode prints OTP information locally instead of delivering email. It is explicitly rejected when `NODE_ENV=production`.

Apply migrations and generate the Prisma client:

```powershell
npx prisma migrate deploy
npx prisma generate
```

Populate branch/ATM reference data so registration has a valid onboarding branch:

```powershell
npm run seed:south-india
npm run seed:south-india:verify
```

Optionally create the local development administrator:

```powershell
npm run seed:local-admin
```

The seed script prints the created identity. Its current development-only defaults are defined in `backend/scripts/seed-local-admin.ts`; change them before using the script outside an isolated local environment.

### 3. Configure the frontend

Open another terminal:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
```

The default frontend configuration is:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

### 4. Start both applications

Backend terminal:

```powershell
cd backend
npm run dev
```

Frontend terminal:

```powershell
cd frontend
npm run dev
```

Open <http://localhost:5173>. The backend runs at <http://localhost:3000>.

## Environment variables

### Backend

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API port; defaults to `3000` |
| `NODE_ENV` | No | Runtime mode; defaults to `development` |
| `DATABASE_URL` | Yes | Prisma PostgreSQL connection URL |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Yes | PostgreSQL pool connection settings |
| `JWT_SECRET` | Yes | JWT signing secret; must be at least 32 characters |
| `FRONTEND_ORIGIN` | No | Comma-separated CORS origins; defaults to the Vite URL |
| `DEFAULT_ONBOARDING_BRANCH_CODE` | No | Branch assigned during onboarding; defaults to `DIGITAL001` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Conditional | Real email delivery; all SMTP values must be supplied together |
| `EMAIL_DEV_MODE` | No | Enables localhost-only OTP fallback; never valid in production |
| `OLLAMA_BASE_URL` | No | Ollama server URL; defaults to `http://localhost:11434` |
| `OLLAMA_MODEL` | No | Assistant model; defaults to `qwen2.5:0.5b` |
| `OLLAMA_TIMEOUT_MS` | No | Assistant timeout from 1,000 to 60,000 ms; defaults to `45000` |

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | Backend API prefix; defaults to `http://localhost:3000/api/v1` |

Never commit `.env` files or real credentials. The checked-in `.env.example` files are the configuration templates.

## API documentation

With the backend running:

- Swagger UI: <http://localhost:3000/api-docs>
- OpenAPI JSON: <http://localhost:3000/api-docs.json>
- Health/root response: <http://localhost:3000/>

All application endpoints are under `/api/v1`. The major resource groups are:

```text
/auth          /customers       /accounts        /beneficiaries
/transactions  /transfers       /cards           /branches
/atms          /employees       /admin           /assistant
```

Protected requests use the header `Authorization: Bearer <token>`. Supported financial write endpoints can accept an `Idempotency-Key` header so retrying the same operation does not duplicate it. See Swagger UI for current schemas, parameters, and response envelopes.

## Optional local banking assistant

The assistant is designed to be local and read-only. Install Ollama, then download the default lightweight model:

```powershell
ollama pull qwen2.5:0.5b
```

Keep Ollama running at the URL configured by `OLLAMA_BASE_URL`. To use another installed model, update `OLLAMA_MODEL` in `backend/.env`. Core banking features can run without Ollama; assistant requests will be unavailable if its service is not running.

## Common commands

### Backend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with TypeScript file watching |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm start` | Run the compiled API |
| `npm test` | Run the complete backend test suite serially |
| `npm run test:integration` | Run V1 API integration tests |
| `npm run test:integrity` | Run banking-integrity tests |
| `npm run seed:south-india` | Populate South India branches and ATMs |
| `npm run seed:south-india:verify` | Verify the reference-data seed |
| `npm run seed:local-admin` | Create one local administrator when none exists |
| `npm run admin:verify` | Verify the admin V1 behavior |
| `npm run admin:v1.1:verify` | Verify the extended admin behavior |

### Frontend

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create the production bundle |
| `npm run preview` | Serve the built frontend locally |

## Testing

Backend tests require a reachable PostgreSQL database configured through `backend/.env`. They exercise real banking flows and may create test records, so use a dedicated local/test database rather than a database containing valuable data.

```powershell
cd backend
npm test
```

Build both applications as a basic release check:

```powershell
cd backend
npm run build

cd ..\frontend
npm run build
```

## Stress and concurrency testing

The Artillery suite runs against a local compiled backend on port `3102`, creates deterministic synthetic fixtures, validates resulting database state, and writes reports beneath `backend/stress-tests/results/`.

Start with the low-load stage:

```powershell
cd backend
npm run build
npm run stress:typecheck
npm run stress:integrity
npm run stress:25
```

Additional commands include `stress:50`, `stress:100`, `stress:250`, `stress:500`, `stress:concurrency`, `stress:idempotency`, and `stress:invalid`. The 500-user stage is intentionally opt-in. Local rate limiting remains enabled, so HTTP 429 responses can be expected at high loads. Run `npm run stress:cleanup` to remove only the suite's named synthetic fixture data.

See `backend/stress-tests/README.md` for scenario details and safety notes.

## Production notes

Before considering a deployment:

- Use long, randomly generated secrets and a dedicated least-privilege database user.
- Configure TLS at the application gateway and use encrypted PostgreSQL connections.
- Set `NODE_ENV=production`, configure a real SMTP provider, and keep `EMAIL_DEV_MODE=false`.
- Restrict `FRONTEND_ORIGIN` to deployed frontend origins.
- Review token lifetime/storage, password policy, rate limits, OTP handling, logging, and retention requirements.
- Store secrets in a managed secret store rather than environment files on disk.
- Run database migrations as an explicit release step and back up the database first.
- Add frontend automated tests, security scanning, monitoring, alerting, and disaster-recovery procedures.
- Obtain an independent security review before handling personal, regulated, or financial data.

## Troubleshooting

**The backend exits with “Database connection failed”.** Confirm PostgreSQL is running and that both `DATABASE_URL` and the `DB_*` variables point to the same reachable database.

**The backend reports a missing environment variable.** Copy `backend/.env.example` to `backend/.env`; ensure `JWT_SECRET` is at least 32 characters.

**Registration cannot find an onboarding branch.** Run `npm run seed:south-india` and make sure `DEFAULT_ONBOARDING_BRANCH_CODE` identifies an active seeded branch.

**OTP email is not delivered.** Supply every `SMTP_*` variable together. For local development only, omit SMTP configuration and set `EMAIL_DEV_MODE=true`.

**The browser reports a CORS error.** Add the exact frontend origin to `FRONTEND_ORIGIN`. Multiple values are comma-separated.

**The frontend cannot reach the API.** Confirm the backend is on port 3000 and that `VITE_API_BASE_URL` ends with `/api/v1`; restart Vite after changing its `.env` file.

**The assistant is unavailable.** Confirm Ollama is running, the configured model has been pulled, and `OLLAMA_BASE_URL` is reachable from the backend process.

## License

No license file is currently included. Unless a license is added, the project should be treated as all rights reserved by its owner.
