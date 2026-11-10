import type { State, Allocation } from "./model";

export function parseMoney(value: string): number {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Enter an amount with up to two decimal places.");
  const [whole, fraction = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount > 100_000_000_000)
    throw new Error("Amount is too large.");
  return amount;
}
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
export function moneyInput(amount: number) {
  return (amount / 100).toFixed(2);
}
export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
export function accountBalance(state: State, accountId: string) {
  return (
    (state.accounts.find((a) => a.id === accountId)?.opening ?? 0) +
    sum(
      state.transactions
        .filter((t) => t.accountId === accountId)
        .map((t) => (t.type === "income" ? t.amount : -t.amount)),
    )
  );
}
export function periodTransactions(state: State) {
  return state.transactions.filter(
    (t) => t.date >= state.period.start && t.date <= state.period.end,
  );
}
export function spent(state: State, allocation: Allocation) {
  return sum(
    periodTransactions(state)
      .filter((t) => t.type === "expense" && t.allocationId === allocation.id)
      .map((t) => t.amount),
  );
}
export function remaining(state: State, allocation: Allocation) {
  return Math.max(0, allocation.limit - spent(state, allocation));
}
export function financials(state: State) {
  const cash = sum(state.accounts.map((a) => accountBalance(state, a.id)));
  const saved = sum(state.goals.map((g) => g.saved));
  const reserved = sum(state.allocations.map((a) => remaining(state, a)));
  const protectedFunds = sum(
    state.allocations
      .filter((a) => a.essential || a.locked || a.kind === "bill")
      .map((a) => remaining(state, a)),
  );
  const flexible = reserved - protectedFunds;
  const transactions = periodTransactions(state);
  return {
    cash,
    saved,
    reserved,
    protectedFunds,
    flexible,
    projected: cash - saved - reserved,
    income: sum(
      transactions.filter((t) => t.type === "income").map((t) => t.amount),
    ),
    expenses: sum(
      transactions.filter((t) => t.type === "expense").map((t) => t.amount),
    ),
    overrun: sum(
      state.allocations.map((a) => Math.max(0, spent(state, a) - a.limit)),
    ),
    expected: sum(
      state.expected
        .filter(
          (e) => e.date >= state.period.start && e.date <= state.period.end,
        )
        .map((e) => e.amount),
    ),
  };
}
