import { commandSchema, today, type Command, type State } from "./model";
import { accountBalance, financials, remaining } from "./finance";
import { recovery } from "./recovery";

function upsert<T extends { id: string }>(items: T[], value: T): T[] {
  return items.some((v) => v.id === value.id)
    ? items.map((v) => (v.id === value.id ? value : v))
    : [...items, value];
}
function requireItem<T extends { id: string }>(items: T[], id: string): T {
  const item = items.find((i) => i.id === id);
  if (!item)
    throw new Error("That record no longer exists. Refresh and try again.");
  return item;
}
export function execute(
  original: State,
  raw: Command,
  version: number,
  uid: () => string,
  date = today(),
): State {
  const command = commandSchema.parse(raw);
  const state: State = structuredClone(original);
  const before = financials(state);
  switch (command.type) {
    case "saveAccount":
      state.accounts = upsert(state.accounts, command.value);
      break;
    case "saveAllocation": {
      if (command.value.goalId) requireItem(state.goals, command.value.goalId);
      if (command.value.kind === "savings" && !command.value.goalId)
        throw new Error("Choose a savings goal for this contribution.");
      if (command.value.kind === "bill" && !command.value.due)
        throw new Error("Choose a due date for this bill.");
      if (
        command.value.due &&
        (command.value.due < state.period.start ||
          command.value.due > state.period.end)
      )
        throw new Error(
          "The due date must be within the current budget period.",
        );
      state.allocations = upsert(state.allocations, command.value);
      break;
    }
    case "deleteAllocation": {
      requireItem(state.allocations, command.id);
      if (state.transactions.some((t) => t.allocationId === command.id))
        throw new Error(
          "This category has transactions. Set its allocation to zero to retain history.",
        );
      state.allocations = state.allocations.filter((a) => a.id !== command.id);
      break;
    }
    case "saveTransaction": {
      const t = command.value;
      requireItem(state.accounts, t.accountId);
      if (t.date > date)
        throw new Error(
          "Use expected income for future payments. Recorded transactions cannot be in the future.",
        );
      if (t.allocationId) {
        const allocation = requireItem(
          [
            ...state.allocations,
            ...state.archives.flatMap((a) => a.allocations),
          ],
          t.allocationId,
        );
        if (allocation.kind === "savings")
          throw new Error(
            "Savings are earmarks, not expenses. Update actual saved funds on your goal.",
          );
      }
      if (t.type === "income" && t.allocationId)
        throw new Error("Income does not consume a spending category.");
      state.transactions = upsert(state.transactions, t);
      break;
    }
    case "deleteTransaction":
      requireItem(state.transactions, command.id);
      state.transactions = state.transactions.filter(
        (t) => t.id !== command.id,
      );
      break;
    case "saveGoal": {
      if (command.value.saved > command.value.target)
        throw new Error(
          "Saved funds cannot exceed the goal target. Increase the target first.",
        );
      const previous = state.goals.find((g) => g.id === command.value.id);
      const increase = Math.max(
        0,
        command.value.saved - (previous?.saved ?? 0),
      );
      // Earmarking cash consumes planned contributions first, so that funds are reserved exactly once.
      let left = increase;
      for (const allocation of state.allocations
        .filter((a) => a.kind === "savings" && a.goalId === command.value.id)
        .sort((a, b) => a.id.localeCompare(b.id))) {
        const take = Math.min(remaining(state, allocation), left);
        allocation.limit -= take;
        left -= take;
      }
      state.goals = upsert(state.goals, command.value);
      break;
    }
    case "saveExpected":
      state.expected = upsert(state.expected, command.value);
      break;
    case "deleteExpected":
      requireItem(state.expected, command.id);
      state.expected = state.expected.filter((e) => e.id !== command.id);
      break;
    case "receiveExpected": {
      const expected = requireItem(state.expected, command.id);
      requireItem(state.accounts, command.accountId);
      if (command.date > date)
        throw new Error("Received income cannot be in the future.");
      state.transactions.push({
        id: uid(),
        type: "income",
        amount: expected.amount,
        date: command.date,
        accountId: command.accountId,
        note: expected.name,
      });
      state.expected = state.expected.filter((e) => e.id !== command.id);
      break;
    }
    case "startPeriod": {
      if (
        command.period.start <= state.period.end &&
        (state.allocations.length ||
          state.transactions.length ||
          state.archives.length)
      )
        throw new Error(
          "A new period must begin after the current period ends.",
        );
      state.archives.push({
        period: state.period,
        allocations: structuredClone(state.allocations),
      });
      state.period = command.period;
      // Carry category names and protection, but require explicit funding of the new period.
      state.allocations = state.allocations
        .filter((a) => a.kind === "category")
        .map((a) => ({ ...a, limit: 0 }));
      break;
    }
    case "applyRecovery": {
      const result = recovery(state, command.disruption);
      const route = result.routes.find((r) => r.id === command.routeId);
      if (!route)
        throw new Error(
          "This route is no longer feasible. Recalculate your options.",
        );
      for (const change of route.adjustments) {
        const allocation = requireItem(state.allocations, change.allocationId);
        if (
          allocation.essential ||
          allocation.locked ||
          remaining(state, allocation) < change.amount
        )
          throw new Error("The route violates a protected allocation.");
        allocation.limit -= change.amount;
      }
      let transactionId: string | undefined;
      if (command.disruption.type === "expense") {
        transactionId = uid();
        state.transactions.push({
          id: transactionId,
          type: "expense",
          amount: command.disruption.amount,
          accountId: command.disruption.accountId,
          note: command.disruption.note,
          date,
        });
      }
      state.history.push({
        id: uid(),
        name: route.name,
        createdAt: new Date().toISOString(),
        appliedVersion: version + 1,
        adjustments: route.adjustments,
        recovered: route.recovered,
        before: result.before,
        after: route.projected,
        labels: Object.fromEntries(
          state.allocations.map((a) => [a.id, a.name]),
        ),
        transactionId,
        undone: false,
      });
      break;
    }
    case "undoRecovery": {
      const record = requireItem(state.history, command.id);
      if (
        record !== state.history.at(-1) ||
        record.undone ||
        record.appliedVersion !== version
      )
        throw new Error(
          "Undo is unavailable after another change. Replan from your current finances instead.",
        );
      for (const change of record.adjustments)
        requireItem(state.allocations, change.allocationId).limit +=
          change.amount;
      if (record.transactionId)
        state.transactions = state.transactions.filter(
          (t) => t.id !== record.transactionId,
        );
      record.undone = true;
      break;
    }
  }
  if (
    state.accounts.length > 30 ||
    state.allocations.length > 200 ||
    state.transactions.length > 10000 ||
    state.goals.length > 100 ||
    state.expected.length > 100 ||
    state.history.length > 500 ||
    state.archives.length > 120
  )
    throw new Error("This workspace has reached its current record limit.");
  const after = financials(state);
  if (state.accounts.some((a) => accountBalance(state, a.id) < 0))
    throw new Error(
      "This would spend more than the wallet balance. Check the amount or record received income first.",
    );
  if (after.cash < after.saved)
    throw new Error(
      "This would use money already earmarked for savings. Update the actual saved amount first.",
    );
  if (
    ["saveAllocation", "saveGoal"].includes(command.type) &&
    after.projected < Math.min(0, before.projected)
  )
    throw new Error(
      "There is not enough unallocated cash to fund this plan. Reduce another allocation first.",
    );
  return state;
}
