# SharedSplit - Production-Ready Shared Expenses App

SharedSplit is a complete, production-ready Shared Expenses Management application (similar to Splitwise) designed specifically for handling messy real-world data imports with full explainability, robust audit logs, and debt simplification.

## Technology Stack

* **Frontend**: React, TypeScript, TailwindCSS, TanStack Query (React Query), React Router.
* **Backend**: Node.js, Express, TypeScript.
* **Database**: PostgreSQL (using Prisma configured for PostgreSQL).
* **Authentication**: JWT Auth.

---

## Folder Structure

```
splitwise-file/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # PostgreSQL models
│   │   └── seed.ts            # Seeds Aisha, Rohan, Priya, Meera, Dev, Sam
│   ├── src/
│   │   ├── server.ts          # Express Server entry
│   │   ├── config/
│   │   │   ├── prisma.ts      # Prisma Client exporter
│   │   │   └── services.ts    # Dependency Injection container
│   │   ├── repositories/      # Repository Layer (decoupled from ORM)
│   │   │   ├── interfaces/    # Interface declarations
│   │   │   └── prisma/        # Prisma implementations
│   │   ├── services/          # Service Layer (Business logic)
│   │   ├── controllers/       # Controller Layer (Express routes bindings)
│   │   ├── middleware/        # Global error & auth & validation middlewares
│   │   ├── validators/        # Zod input schemas
│   │   └── test/
│   │       └── run-tests.ts   # Core automated test suite
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.ts       # Axios client with JWT interceptor
│   │   ├── context/
│   │   │   └── AuthContext.tsx# Auth state & helper login hooks
│   │   ├── components/
│   │   │   ├── Layout.tsx     # Dashboard Sidebar layout shell
│   │   │   └── SettleUpModal.tsx # Settlement record modal
│   │   ├── pages/             # Login, Register, Dashboard, GroupDetail,
│   │   │   │                  # Expenses, Settlements, Balances (Ledger),
│   │   │   │                  # ImportCSV, ImportReview, ImportReport
│   │   ├── App.tsx            # Routes configurations
│   │   ├── index.css          # Tailwind & premium UI styling
│   │   └── main.tsx           # React bootstrap
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── package.json
└── docs/
    ├── SCOPE.md               # Feature & validation scope
    ├── DECISIONS.md           # Business rules and rounding decisions
    └── AI_USAGE.md            # AI prompt & fixes log
```

---

## Setup & Running Guide

### 1. Database & Environment Setup
Ensure you have a running PostgreSQL database (e.g. locally or on Neon).
Copy `backend/.env.example` to `backend/.env` and fill in:
* `DATABASE_URL` (your PostgreSQL connection string)
* `JWT_SECRET` (session token signing key)

### 2. Backend Installation & Seed
```bash
cd backend
npm install

# Build and generate Prisma client
npm run db:generate

# Run DB Migrations
npm run db:migrate

# Seed data (Aisha, Rohan, Priya, Meera, Dev, Sam, Apartment 402, sample bills)
npm run db:seed
```

### 3. Running Backend Tests
Ensure the math calculations and anomaly detectors work correctly:
```bash
npm run test
```

### 4. Running Backend Development Server
```bash
npm run dev
# Starts on port 4000
```

### 5. Frontend Installation & Running
```bash
cd ../frontend
npm install
npm run dev
# Starts on port 3000, proxies /api → http://localhost:4000
```

---

## Key Architecture Blueprints

### 1. Repository Pattern
All database queries are defined as TS Interfaces in `backend/src/repositories/interfaces/` and implemented with Prisma in `backend/src/repositories/prisma/`. This makes database queries mockable and modular.

### 2. Service Layer
Services in `backend/src/services/` contain all calculations:
* **Balance Service**: Calculates balance = `amount_paid - amount_owed` considering historical joined/left dates.
* **Split Service**: Rounds down to nearest paisa, allocating remainder to payer.
* **Debt Simplification**: Greedy algorithm matching debtors and creditors to compute minimal transfers.
* **Anomaly Service**: Runs 14 validators to flag import issues.

### 3. Anomaly Approvals & meera's rule
Duplicates are never automatically deleted. They appear in the `Import Review` screen as review items. The user must manually click `Approve` or `Reject` before they commit as expenses.

---

## ☁️ Deployment (Render & Vercel)

### Backend (Render Web Service)
Due to the migration from JavaScript to TypeScript, the backend is compiled into the `dist/` directory. Update your Render settings as follows:

1. **Root Directory**: `backend` (highly recommended to isolate the backend)
2. **Build Command**: `npm install && npm run build && npx prisma migrate deploy`
3. **Start Command**: `node dist/server.js`
4. **Environment Variables**:
   * `DATABASE_URL`: Your Neon/Render PostgreSQL connection string.
   * `JWT_SECRET`: A secure signing key.

*If you deploy from the repository root instead of setting the `backend` Root Directory, use:*
* **Build Command**: `npm install --prefix backend && npm run build --prefix backend`
* **Start Command**: `node backend/dist/server.js`

### Frontend (Vercel)
1. **Framework Preset**: `Vite` (or `Other`)
2. **Root Directory**: `frontend`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
