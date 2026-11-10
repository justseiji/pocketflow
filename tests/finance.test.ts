import { describe, it, expect } from "vitest";
import {
  initialState,
  type State,
  type Allocation,
  type Command,
} from "../shared/model";
import {
  accountBalance,
  financials,
  parseMoney,
  remaining,
  sum,
} from "../shared/finance";
import { recovery } from "../shared/recovery";
import { execute } from "../shared/commands";

const allocation = (
  id: string,
  limit: number,
  kind: Allocation["kind"] = "category",
  locked = false,
): Allocation => ({
  id,
  name: id,
  limit,
  kind,
  essential: false,
  locked,
  frequency: "once",
  ...(kind === "savings" ? { goalId: "goal" } : {}),
});
function fixture(): State {
  return {
    ...initialState("2026-11-10"),
    accounts: [{ id: "cash", name: "Cash", opening: 10000 }],
    allocations: [
      allocation("food", 2000),
      allocation("fun", 2000),
      allocation("laptop", 3000, "purchase"),
      allocation("save", 2000, "savings"),
      { ...allocation("rent", 1000, "bill", true), due: "2026-11-15" },
    ],
    goals: [{ id: "goal", name: "Rainy days", target: 10000, saved: 0 }],
  };
}
let sequence = 0;
const apply = (s: State, c: Command, version = 0) =>
  execute(s, c, version, () => `generated-${++sequence}`, "2026-11-10");
const unexpected = {
  type: "expense" as const,
  amount: 1200,
  accountId: "cash",
  note: "Repair",
};

describe("exact money and ledger", () => {
  it("parses decimal strings exactly and rejects ambiguous or unsafe values", () => {
    expect(parseMoney("0.29")).toBe(29);
    expect(parseMoney("1200.5")).toBe(120050);
    for (const value of [
      "-1",
      "1.001",
      "1e2",
      "1,200",
      "Infinity",
      "99999999999",
    ])
      expect(() => parseMoney(value)).toThrow();
  });
  it("counts an expense and its reservation once", () => {
    const state = apply(fixture(), {
      type: "saveTransaction",
      value: {
        id: "t",
        type: "expense",
        amount: 500,
        accountId: "cash",
        allocationId: "food",
        date: "2026-11-10",
        note: "",
      },
    });
    expect(financials(state)).toMatchObject({
      cash: 9500,
      reserved: 9500,
      projected: 0,
      expenses: 500,
    });
  });
  it("includes past expenses in cash, but only active-period expenses in budgets", () => {
    const state = apply(fixture(), {
      type: "saveTransaction",
      value: {
        id: "t",
        type: "expense",
        amount: 500,
        accountId: "cash",
        allocationId: "food",
        date: "2026-10-10",
        note: "",
      },
    });
    expect(financials(state)).toMatchObject({
      cash: 9500,
      reserved: 10000,
      projected: -500,
      expenses: 0,
    });
  });
  it("does not treat missing, reduced or delayed income as cash", () => {
    let state = apply(fixture(), {
      type: "saveExpected",
      value: {
        id: "salary",
        name: "Salary",
        amount: 100000,
        date: "2026-11-15",
        frequency: "monthly",
      },
    });
    const before = financials(state);
    state = apply(state, {
      type: "saveExpected",
      value: { ...state.expected[0], amount: 100, date: "2026-12-25" },
    });
    expect(financials(state).cash).toBe(before.cash);
    expect(financials(state).projected).toBe(before.projected);
    expect(recovery(state, unexpected).routes).toEqual(
      recovery(fixture(), unexpected).routes,
    );
  });
  it("receives expected income exactly once", () => {
    let state = apply(fixture(), {
      type: "saveExpected",
      value: {
        id: "salary",
        name: "Salary",
        amount: 400,
        date: "2026-11-15",
        frequency: "monthly",
      },
    });
    state = apply(state, {
      type: "receiveExpected",
      id: "salary",
      accountId: "cash",
      date: "2026-11-10",
    });
    expect(accountBalance(state, "cash")).toBe(10400);
    expect(state.expected).toHaveLength(0);
    expect(() =>
      apply(state, {
        type: "receiveExpected",
        id: "salary",
        accountId: "cash",
        date: "2026-11-10",
      }),
    ).toThrow();
  });
  it("consumes future savings reservations when cash is actually earmarked", () => {
    const state = apply(fixture(), {
      type: "saveGoal",
      value: { ...fixture().goals[0], saved: 1200 },
    });
    expect(state.allocations.find((a) => a.id === "save")?.limit).toBe(800);
    expect(financials(state)).toMatchObject({
      cash: 10000,
      saved: 1200,
      reserved: 8800,
      projected: 0,
    });
  });
  it("rejects unfunded allocations, future ledger entries and overspending cash", () => {
    expect(() =>
      apply(fixture(), { type: "saveAllocation", value: allocation("new", 1) }),
    ).toThrow("not enough");
    const value = {
      id: "t",
      type: "expense" as const,
      amount: 10001,
      accountId: "cash",
      date: "2026-11-10",
      note: "",
    };
    expect(() => apply(fixture(), { type: "saveTransaction", value })).toThrow(
      "wallet balance",
    );
    expect(() =>
      apply(fixture(), {
        type: "saveTransaction",
        value: { ...value, amount: 1, date: "2026-11-11" },
      }),
    ).toThrow("future");
  });
});

describe("Money GPS constraints and replanning", () => {
  it("offers distinct reproducible balanced, purchase and savings routes", () => {
    const result = recovery(fixture(), unexpected);
    expect(result.routes.map((r) => r.id)).toEqual([
      "balanced",
      "purchase",
      "savings",
    ]);
    expect(result).toEqual(recovery(fixture(), unexpected));
    for (const route of result.routes) {
      expect(route.recovered).toBe(1200);
      expect(route.projected).toBe(0);
      expect(route.uncovered).toBe(0);
    }
  });
  it("detects ordinary overruns without counting them twice", () => {
    const state = apply(fixture(), {
      type: "saveTransaction",
      value: {
        id: "t",
        type: "expense",
        amount: 2500,
        accountId: "cash",
        allocationId: "food",
        date: "2026-11-10",
        note: "",
      },
    });
    const result = recovery(state, { type: "current" });
    expect(result.gap).toBe(500);
    expect(result.routes[0].adjustments).toEqual([
      { allocationId: "fun", amount: 500 },
    ]);
  });
  it("uses a cash cushion before reducing budgets", () => {
    const state = fixture();
    state.accounts[0].opening += 2000;
    const result = recovery(state, unexpected);
    expect(result.gap).toBe(0);
    expect(result.routes).toEqual([]);
  });
  it("reports insufficient and fully protected budgets honestly", () => {
    const state = fixture();
    state.allocations.forEach((a) => {
      a.locked = true;
    });
    expect(recovery(state, unexpected)).toMatchObject({
      routes: [],
      uncovered: 1200,
      recoverable: 0,
    });
    state.allocations[0].locked = false;
    expect(recovery(state, { ...unexpected, amount: 9000 })).toMatchObject({
      routes: [],
      uncovered: 7000,
    });
  });
  it("never postpones bills, spent purchases or protected savings", () => {
    const state = fixture();
    state.allocations.find((a) => a.id === "save")!.essential = true;
    state.allocations.find((a) => a.id === "rent")!.locked = false;
    state.transactions.push({
      id: "buy",
      type: "expense",
      amount: 3000,
      date: "2026-11-10",
      accountId: "cash",
      allocationId: "laptop",
      note: "",
    });
    const result = recovery(state, unexpected);
    expect(result.routes.map((r) => r.id)).toEqual(["balanced"]);
    expect(
      result.routes[0].adjustments.every((a) =>
        ["food", "fun"].includes(a.allocationId),
      ),
    ).toBe(true);
  });
  it("cannot invent cash in another wallet or use actual saved money", () => {
    const state = fixture();
    state.accounts.push({ id: "empty", name: "Empty", opening: 0 });
    expect(
      recovery(state, { ...unexpected, accountId: "empty" }).routes,
    ).toHaveLength(0);
    state.goals[0].saved = 9000;
    expect(recovery(state, unexpected).reason).toContain(
      "preserving money already saved",
    );
  });
  it("combines strategies only when a distinct combination is needed", () => {
    const result = recovery(fixture(), { ...unexpected, amount: 8500 });
    expect(result.routes.map((r) => r.id)).toEqual(["combined"]);
    expect(result.routes[0].recovered).toBe(8500);
  });
  it("keeps all competing goals and locked goals separate", () => {
    const state = fixture();
    state.goals.push({ id: "second", name: "School", saved: 0, target: 5000 });
    state.allocations[3].limit = 1000;
    state.allocations.push({
      ...allocation("school", 1000, "savings", true),
      goalId: "second",
    });
    const route = recovery(state, unexpected).routes.find(
      (r) => r.id === "savings",
    )!;
    expect(route.savingsImpact.map((i) => i.name)).toEqual(["Rainy days"]);
    expect(route.adjustments.some((a) => a.allocationId === "school")).toBe(
      false,
    );
  });
  it("applies, replans repeatedly and undoes only the unchanged latest decision", () => {
    let state = fixture();
    const original = structuredClone(state);
    state = apply(
      state,
      { type: "applyRecovery", routeId: "balanced", disruption: unexpected },
      0,
    );
    expect(financials(state)).toMatchObject({ cash: 8800, projected: 0 });
    expect(original).toEqual(fixture());
    state = apply(
      state,
      {
        type: "applyRecovery",
        routeId: "balanced",
        disruption: { ...unexpected, amount: 800 },
      },
      1,
    );
    expect(financials(state)).toMatchObject({ cash: 8000, projected: 0 });
    expect(state.history).toHaveLength(2);
    expect(() =>
      apply(state, { type: "undoRecovery", id: state.history[0].id }, 2),
    ).toThrow("Undo");
    expect(() =>
      apply(state, { type: "undoRecovery", id: state.history[1].id }, 3),
    ).toThrow("Undo");
    state = apply(state, { type: "undoRecovery", id: state.history[1].id }, 2);
    expect(financials(state)).toMatchObject({ cash: 8800, projected: 0 });
    expect(state.history[1].undone).toBe(true);
  });
  it("archives periods without spending old reservations in a new one", () => {
    const state = apply(fixture(), {
      type: "startPeriod",
      period: { start: "2026-12-01", end: "2026-12-31" },
    });
    expect(state.archives).toHaveLength(1);
    expect(financials(state).reserved).toBe(0);
    expect(() =>
      apply(state, {
        type: "startPeriod",
        period: { start: "2026-12-05", end: "2026-12-20" },
      }),
    ).toThrow("after");
  });
  it("conserves every centavo across varied capacities and large safe amounts", () => {
    for (let i = 1; i <= 150; i++) {
      const state = initialState("2026-11-10");
      state.allocations = [
        allocation("a", i * 237 + 1),
        allocation("b", i * 512 + 2),
        allocation("c", i * 89 + 3),
      ];
      const total = sum(state.allocations.map((a) => a.limit));
      state.accounts = [{ id: "cash", name: "Cash", opening: total }];
      const impact = Math.floor(total * 0.63);
      const result = recovery(state, { ...unexpected, amount: impact });
      expect(result.routes).toHaveLength(1);
      expect(sum(result.routes[0].adjustments.map((a) => a.amount))).toBe(
        impact,
      );
      for (const change of result.routes[0].adjustments) {
        expect(Number.isSafeInteger(change.amount)).toBe(true);
        expect(change.amount).toBeLessThanOrEqual(
          remaining(
            state,
            state.allocations.find((a) => a.id === change.allocationId)!,
          ),
        );
      }
    }
    const state = fixture();
    state.allocations = [
      allocation("a", 99_999_999_999),
      allocation("b", 99_999_999_999),
    ];
    state.accounts[0].opening = 199_999_999_998;
    expect(
      sum(
        recovery(state, {
          ...unexpected,
          amount: 99_999_999_999,
        }).routes[0].adjustments.map((a) => a.amount),
      ),
    ).toBe(99_999_999_999);
  });
});
