# PocketFlow product specification

Life doesn't follow a budget. PocketFlow adapts.

## Confirmed requirements

Mobile-first personal finance for everyday users, starting with PHP. Manual wallets (cash, GCash, Maya, banks), received and expected income, dated transactions, category budgets, protected commitments, savings goals and reserved purchases. Money GPS must generate deterministic, feasible, distinct alternatives, explain every adjustment, require confirmation, preserve history, and support safe undo. No AI, banking integrations or real transfers.

## MVP journeys and acceptance

1. **Start a plan:** register with email/password, create a wallet and initial balance, select period and allocations. New accounts contain no fabricated financial data. Optional goals and bills can be added later.
2. **Track a day:** add/edit/delete an expense or received income with wallet, date and note. Search/filter history. Balances and remaining allocations update immediately; future income never increases available funds.
3. **Protect priorities:** create/edit category allocations; designate essential or locked categories. A bill is an allocation with a due date, not a second reservation. A purchase can free funds only while reserved and unspent. Savings contributions are separate from actual earmarked savings.
4. **Recover:** detect a negative projected position or simulate an expense; compare balanced reductions, postponing reserved purchases, and reducing optional savings. Show reductions, projected balance, savings/purchase impacts and unmet shortfall. Never offer an infeasible route as successful.
5. **Confirm:** show exact changes, explicitly confirm, atomically persist financial changes and an audit record, recalculate. Reject stale selections. Undo only the latest decision if the plan has not changed since it was applied.
6. **Continue:** replan from the latest state. Review prior decisions and archived budget periods.

## Defaults and proposed choices

- PHP and Asia/Manila; currency lives on the plan for future extension. Single currency per profile in this release; no FX.
- Monthly or custom non-overlapping budget periods. Expenses outside the active period still affect wallet balances, but do not consume its allocations.
- Cash-first forecast: received balances less actual earmarked savings and remaining reservations. Expected income is displayed separately as an estimate and is never a recovery resource.
- Essential and locked both prevent reductions. Savings already earmarked are protected; only future optional contributions can be reduced.
- Date-specific bills are entered manually. Recurrence frequency is captured for planning; automatic generation and notifications are a later milestone.
- Password reset/email verification, MFA, household sharing, automatic income matching, bank feeds and automatic recurring entries are outside this first implementation.

## UX

Navigation: Overview, Transactions, Your plan, Money GPS, Goals. Desktop persistent side rail; mobile compact bottom navigation. Primary quick-entry button is always reachable. Overview prioritizes available cash, commitments, next bills and recovery status. A warm neutral canvas, deep forest green and restrained orange communicate calm and direction. Semantic forms, visible keyboard focus, labeled controls, dialogs, readable contrast and reduced motion are required. Loading/error/empty states must say what happened and how to proceed.

## Quality gates

Integer-centavo calculations; no floating point financial source of truth. Validate server inputs and authorize every request. Test financial constraints, income delays, multiple periods, rounding, repeated recovery, stale writes and undo. Integration tests cover sessions, ownership and mutation conflicts. Browser tests cover account-to-recovery on desktop and mobile. Production rollout additionally requires deployed HTTPS, managed database backup/restore verification, email recovery and an independent security review.

## Open product decisions (not implementation blockers)

Hosting/provider and retention policy; email delivery provider; launch privacy/legal copy; research-based route ranking preferences; whether rolling unused allocations to a new period should be offered. Initial defaults favor explicit edits and transparent tradeoffs.
