# Architecture and contracts

## Components

React/TypeScript/Vite + Tailwind on the client; Express on Node 22+; PostgreSQL persistence. `shared/` owns schemas, integer money, ledger calculations, commands and Money GPS, with no React or database imports. The server authenticates, validates and atomically saves commands; the client displays calculations and obtains explicit consent. No AI services or API keys.

Local development uses PGlite (embedded PostgreSQL) persisted under `.data/`; setting `DATABASE_URL` selects `pg` and ordinary PostgreSQL with the same schema. This avoids a mandatory container for development. Production refuses embedded storage and requires `APP_ORIGIN` over HTTPS. The external PostgreSQL path requires deployment integration validation.

## Data and concurrency

Relational `users` and `sessions` tables own identity and expiring sessions. `portfolios` contains one versioned, schema-validated JSONB financial aggregate per user. It includes wallets, dated transactions, active/archived periods, allocations, expected income, goals and recovery decisions. This deliberately keeps a small personal ledger and recovery application atomic, without distributed transactions. An optimistic `UPDATE ... WHERE version = expectedVersion` prevents lost writes across tabs. A conflict requires a refresh and new route review. For high-volume ledgers, migrate transactions/history to indexed child tables; no microservices are needed. Bound collection sizes and request limits constrain the current aggregate.

## Financial model

All amounts are safe integer minor units, with bounded inputs. `wallet balance = opening + received income − expenses` across all dates up to today. Future-dated ledger entries are rejected; expected income is a separate collection. `remaining allocation = max(0, limit − period expenses linked to that allocation)`. Each reservation exists once. Bills and purchases are types of allocation. Actual saved funds are earmarks inside wallet cash, not additional cash; subtract them once. `projected position = cash − actual savings − remaining allocations`. A negative result is a real uncovered plan. Overruns are reported separately; an existing cash cushion can absorb an overrun.

Recovery calculates the gap after an optional simulated cash expense. Balanced uses flexible general categories; purchase-first uses reserved optional purchases then flexible categories; savings-first uses adjustable future contributions then flexible categories. A final combined strategy is available when resources across families are required. Reductions never exceed remaining unspent reservations, never touch essential/locked items, and never reduce below actual spending. Stable proportional integer distribution uses largest remainder with ID tie breaks. Identical adjustment sets are deduplicated. Ranking follows predictable strategy order rather than claiming a universal best financial choice. Infeasibility returns the residual gap and does not create an applicable route.

A confirmed simulated expense is recorded atomically alongside the route; cuts alone never increase actual cash. Delayed/missing expected income never removes cash that was never received. The forecast exposes upcoming due dates and a conservative current-cash baseline rather than promising future income. Goal delay is estimated in contribution cycles, explicitly labeled an estimate.

## HTTP API

All API responses are JSON. `POST /api/auth/register`, `/login`; `GET /api/auth/me`; `POST /api/auth/logout`. Authentication sets an HttpOnly SameSite=Lax cookie with a random 256-bit token, whose SHA-256 digest is stored server-side. Production cookies are Secure. Passwords use Node scrypt with random salts and timing-safe comparison; authentication attempts are rate limited. State changes require an exact allowed Origin, JSON content type and a session CSRF token. User IDs are always derived from sessions, never accepted from commands.

`GET /api/portfolio` returns `{ state, version }`. `POST /api/commands` takes `{ version, command }`; shared discriminated schemas define command payloads. `POST /api/recovery/preview` takes a disruption and returns the current version plus deterministic routes. `applyRecovery` includes that version, disruption and route ID; the server recalculates and applies only a matching feasible route. `undoRecovery` enforces latest-decision/version guards. All write errors preserve the prior document.

## Deployment and operations

Build once with `npm run build`; `npm start` serves the API and built client from a single origin. A separate Vercel frontend must proxy `/api` to that origin; do not weaken CORS/cookies. Configure DATABASE_URL, HTTPS APP_ORIGIN and NODE_ENV=production. Use a least-privilege runtime database role and an operator-controlled migration role; the current bootstrap schema requires CREATE permissions. Protect and encrypt backups, test restore before launch, avoid request-body logging and rotate sessions following credential incidents. Password reset/verification and account deletion/export policy are launch follow-ups, not simulated UI features.
