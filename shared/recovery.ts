import type { Adjustment, Allocation, Disruption, State } from "./model";
import { accountBalance, financials, remaining, sum } from "./finance";

export interface Route {
  id: string;
  name: string;
  description: string;
  adjustments: Adjustment[];
  recovered: number;
  uncovered: number;
  projected: number;
  essentialsProtected: true;
  savingsImpact: {
    name: string;
    reduction: number;
    estimatedCycles: number | null;
  }[];
  purchaseImpact: { name: string; reduction: number }[];
}
export interface Recovery {
  gap: number;
  recoverable: number;
  uncovered: number;
  before: number;
  routes: Route[];
  reason?: string;
}

// Largest remainder allocation uses BigInt for intermediate products; centavos never round away.
function proportional(
  state: State,
  items: Allocation[],
  target: number,
): Adjustment[] {
  const capacity = sum(items.map((a) => remaining(state, a)));
  if (!capacity || !target) return [];
  const take = Math.min(capacity, target);
  const rows = items.map((a) => {
    const product = BigInt(remaining(state, a)) * BigInt(take);
    return {
      allocationId: a.id,
      amount: Number(product / BigInt(capacity)),
      remainder: product % BigInt(capacity),
    };
  });
  let extra = take - sum(rows.map((r) => r.amount));
  rows.sort((a, b) =>
    a.remainder === b.remainder
      ? a.allocationId.localeCompare(b.allocationId)
      : a.remainder > b.remainder
        ? -1
        : 1,
  );
  for (const row of rows)
    if (extra > 0) {
      row.amount++;
      extra--;
    }
  return rows
    .filter((r) => r.amount > 0)
    .map(({ allocationId, amount }) => ({ allocationId, amount }))
    .sort((a, b) => a.allocationId.localeCompare(b.allocationId));
}

export function recovery(state: State, disruption: Disruption): Recovery {
  const baseline = financials(state);
  const impact = disruption.type === "expense" ? disruption.amount : 0;
  const before = baseline.projected - impact;
  const gap = Math.max(0, -before);
  const eligible = state.allocations.filter(
    (a) =>
      !a.essential && !a.locked && remaining(state, a) > 0 && a.kind !== "bill",
  );
  const recoverable = sum(eligible.map((a) => remaining(state, a)));
  const result: Recovery = {
    gap,
    before,
    recoverable,
    uncovered: Math.max(0, gap - recoverable),
    routes: [],
  };
  if (
    disruption.type === "expense" &&
    (!state.accounts.some((a) => a.id === disruption.accountId) ||
      accountBalance(state, disruption.accountId) < impact ||
      baseline.cash - impact < baseline.saved)
  ) {
    result.reason =
      "This wallet cannot cover the expense while preserving money already saved. Reducing a budget does not create cash.";
    return result;
  }
  if (!gap) {
    result.reason =
      "Your unallocated cash already covers this change. No budget reductions are needed.";
    return result;
  }
  if (gap > recoverable) {
    result.reason =
      "Your flexible reservations cannot cover the full gap. Protected commitments remain untouched. Review the shortfall or add received funds.";
    return result;
  }
  const general = eligible.filter((a) => a.kind === "category");
  const purchases = eligible.filter((a) => a.kind === "purchase");
  const savings = eligible.filter((a) => a.kind === "savings");
  const strategies = [
    {
      id: "balanced",
      name: "A little less, across the board",
      description:
        "Spread the adjustment across flexible everyday categories. Keep purchases and planned savings intact.",
      groups: [general],
    },
    {
      id: "purchase",
      name: "Let a purchase wait",
      description:
        "Release funds reserved for optional purchases first, then trim everyday spending if needed.",
      groups: [purchases, general],
    },
    {
      id: "savings",
      name: "Give savings more time",
      description:
        "Ease optional future savings contributions first. Money you have already saved stays protected.",
      groups: [savings, general],
    },
    {
      id: "combined",
      name: "Make room together",
      description:
        "Combine optional purchases, everyday spending and future savings contributions to cover a larger gap.",
      groups: [purchases, general, savings],
    },
  ];
  const seen = new Set<string>();
  for (const strategy of strategies) {
    if (!strategy.groups[0].length) continue;
    let left = gap;
    const adjustments: Adjustment[] = [];
    for (const group of strategy.groups) {
      const changes = proportional(state, group, left);
      adjustments.push(...changes);
      left -= sum(changes.map((c) => c.amount));
    }
    if (left > 0) continue;
    adjustments.sort((a, b) => a.allocationId.localeCompare(b.allocationId));
    const signature = JSON.stringify(adjustments);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const savingsImpact: Route["savingsImpact"] = [];
    const purchaseImpact: Route["purchaseImpact"] = [];
    for (const adjustment of adjustments) {
      const allocation = state.allocations.find(
        (a) => a.id === adjustment.allocationId,
      )!;
      if (allocation.kind === "savings") {
        const goal = state.goals.find((g) => g.id === allocation.goalId);
        savingsImpact.push({
          name: goal?.name ?? allocation.name,
          reduction: adjustment.amount,
          estimatedCycles:
            allocation.limit > 0
              ? Math.ceil(adjustment.amount / allocation.limit)
              : null,
        });
      }
      if (allocation.kind === "purchase")
        purchaseImpact.push({
          name: allocation.name,
          reduction: adjustment.amount,
        });
    }
    result.routes.push({
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      adjustments,
      recovered: gap,
      uncovered: 0,
      projected: before + gap,
      essentialsProtected: true,
      savingsImpact,
      purchaseImpact,
    });
  }
  return result;
}
