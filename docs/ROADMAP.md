# Implementation roadmap

| Milestone             | Dependencies          | Deliverables                                                                                                                         | Acceptance gate                                                          |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1. Foundation         | None                  | Spec, architecture, schemas, persistent PostgreSQL adapter, authenticated shell                                                      | Registration/login, session and tenant-isolation tests                   |
| 2. Everyday money     | 1                     | Wallets, income/expense CRUD, search, categories, protected budgets and periods                                                      | Exact balance calculations and persistence                               |
| 3. Money GPS          | 2                     | Deterministic strategies, distinct route comparison, explicit apply, audit and guarded undo                                          | Feasibility/protection/conservation/replanning tests and browser journey |
| 4. Supporting clarity | 2–3                   | Goals, bill due dates, expected income, transparent forecast and history                                                             | No double counting; pending income excluded                              |
| 5. Refinement         | 1–4                   | Responsive UI, accessible forms, integration/E2E tests, build and operating docs                                                     | Desktop/mobile journey, production build                                 |
| 6. Launch readiness   | 5, provider decisions | External PostgreSQL deployment test, email verification/reset, privacy/export/deletion policy, backup restore drill, security review | Operational signoff on deployed service                                  |

Milestones 1–5 are implemented and validated as a usable local MVP; the exact checks and known boundaries are recorded in README. Milestone 6 remains deployment and launch work. Automatic recurring generation, custom recovery locks per simulation, notifications, account transfers, multi-currency and household collaboration follow research and are not required to prove Money GPS.

Implementation status and exact validation results are recorded in README after running checks. A successful local build does not establish production launch readiness.
