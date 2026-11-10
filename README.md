# PocketFlow

**Life doesn't follow a budget. PocketFlow adapts.**

A working personal finance MVP centered on Money GPS: deterministic recovery routes that preserve essential commitments and explain the tradeoffs. Built with React, TypeScript, Vite, Tailwind, Express and PostgreSQL. No AI service, bank connection or API key is required.

## Plan and architecture

- [Product specification and acceptance criteria](docs/PRODUCT.md)
- [Architecture, financial model, security and API contracts](docs/ARCHITECTURE.md)
- [Milestone roadmap and launch requirements](docs/ROADMAP.md)

## Run locally

Requires Node 22+ and npm. From the checkout:

```sh
npm ci
npm run dev
```

Vite uses port 5173 and proxies `/api` to Express on 3001. Wait for both processes to start; `/api/health` returns `{"status":"ok"}` after the database is initialized. Register an account in the application. There are no default accounts, passwords or seeded financial records.

Local data persists in `.data/pocketflow`, using PGlite, an embedded PostgreSQL runtime. This directory and `.env` are ignored by Git. Treat this directory as private financial data. Use `DATA_DIR` to choose a different local database. Set environment variables in the shell or your process manager; `.env.example` documents names and `.env` is not loaded automatically.

## What works

- Email/password registration, login and logout; hashed passwords and expiring server-side sessions.
- Manual wallets, received income and expense CRUD, notes, dates, category/date filtering and search.
- Monthly or custom budget periods, essential/locked allocations, planned purchases and dated bills.
- Expected income editing and explicit receipt; delayed/missing income never inflates cash.
- Savings goals, actual earmarked funds and separate future contributions.
- Live overview, bill visibility and a conservative cash-based projection.
- Money GPS: current-plan shortfall detection, expense simulation, distinct balanced/purchase/savings/combined strategies, exact confirmation, atomic application and recovery history.
- Undo of the latest recovery while its version is still current. A simulated expense is removed along with its budget adjustments when undone.
- Responsive desktop/mobile layouts, keyboard-accessible dialogs, empty/error/loading states and reduced-motion support.

To explore Money GPS, add a wallet and fully fund a plan with flexible spending, an optional reserved purchase, an optional savings contribution and protected essentials. In Money GPS, simulate an expense smaller than the wallet balance. Compare the actual calculated routes, then confirm one. The cash expense and budget adjustment are saved together. If an expense has already been recorded, use **Review my current plan** to avoid recording it twice.

## Checks

```sh
npm test
npm run build
npm run format:check
npm run test:e2e
```

Unit tests cover exact money, overspending, insufficient funds, protected budgets, delayed/reduced income, competing goals, bills, repeated replanning, undo and period changes. API integration tests use a real embedded PostgreSQL database and cover authentication, CSRF/origin enforcement, ownership, optimistic concurrency and disk persistence.

Browser tests create isolated accounts and use `/tmp/pocketflow-browser-db`, not your development database. They exercise the complete workflow at desktop and mobile sizes, test for horizontal overflow and run axe accessibility checks. Stop development servers on ports 5173/3001 before running them. They use `/usr/bin/chromium`; set `CHROMIUM_PATH` to your installed Chromium executable elsewhere. Screenshots are saved under ignored `test-results/`.

Validated in the current cloud instance: 18 financial unit tests, 5 API integration tests and 2 browser journeys passed. The journeys include registration, route comparison, explicit application, undo, transaction creation/editing/deletion and persistence, at 1440px and 390px. Axe found no WCAG A/AA violations on the four tested screens. Clean `npm ci`, production build, formatting and the production-dependency audit passed (zero reported vulnerabilities). The compiled server also passed database health, client serving, registration and authenticated write/read smoke checks. These checks do not certify every accessibility criterion or production deployment.

## Deployment

```sh
npm ci
npm run build
NODE_ENV=production DATABASE_URL='postgresql://…' APP_ORIGIN='https://your-domain.example' npm start
```

Inject credentials securely through the host; do not commit them. Production requires ordinary PostgreSQL and HTTPS. The server serves the built client and API from one origin. Preserve TLS verification for managed PostgreSQL and configure CA trust as required by your provider. The current schema bootstrap requires database creation privileges for tables/indexes; use a controlled migration identity before broad production rollout. The app exposes `/api/health` for a database-backed health check.

## Current boundaries

This is a locally validated MVP, not a deployed financial service. External managed PostgreSQL and production HTTPS infrastructure require deployment validation. Email verification/password reset, account export/deletion, a backup/restore drill and independent security review remain launch work. Recurrence frequency is stored and shown, but automatic recurring entries and reminders are not implemented. Currency is PHP; forecasts deliberately exclude pending income. Each user's financial aggregate currently supports 10,000 transactions, 200 active allocations and 500 recovery decisions; a normalized transaction ledger is the next step for larger histories.

No real funds move. User confirmation changes the financial plan and, for a simulated expense, records the manual transaction.
