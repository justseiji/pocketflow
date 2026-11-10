import { z } from "zod";

export const money = z.number().int().min(0).max(100_000_000_000);
const id = z.string().min(1).max(80);
const label = z.string().trim().min(1).max(80);
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const date = new Date(`${v}T00:00:00Z`);
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v;
  }, "Use a valid calendar date");
export const periodSchema = z
  .object({ start: day, end: day })
  .refine((v) => v.end >= v.start, "Period end must follow its start");
export const frequencySchema = z.enum([
  "once",
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "irregular",
]);
export const accountSchema = z.object({ id, name: label, opening: money });
export const allocationSchema = z.object({
  id,
  name: label,
  limit: money,
  essential: z.boolean(),
  locked: z.boolean(),
  kind: z.enum(["category", "bill", "purchase", "savings"]),
  due: day.optional(),
  frequency: frequencySchema.default("once"),
  goalId: id.optional(),
});
export const transactionSchema = z.object({
  id,
  type: z.enum(["income", "expense"]),
  amount: money.refine((v) => v > 0, "Amount must be greater than zero"),
  accountId: id,
  allocationId: id.optional(),
  date: day,
  note: z.string().trim().max(200),
});
export const goalSchema = z.object({
  id,
  name: label,
  target: money.refine((v) => v > 0),
  saved: money,
  due: day.optional(),
});
export const expectedSchema = z.object({
  id,
  name: label,
  amount: money.refine((v) => v > 0),
  date: day,
  frequency: frequencySchema,
});
export type Account = z.infer<typeof accountSchema>;
export type Allocation = z.infer<typeof allocationSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type ExpectedIncome = z.infer<typeof expectedSchema>;
export const disruptionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("current") }),
  z.object({
    type: z.literal("expense"),
    amount: money.refine((v) => v > 0),
    accountId: id,
    note: label,
  }),
]);
export type Disruption = z.infer<typeof disruptionSchema>;
export interface Adjustment {
  allocationId: string;
  amount: number;
}
export interface RecoveryRecord {
  id: string;
  name: string;
  createdAt: string;
  appliedVersion: number;
  adjustments: Adjustment[];
  transactionId?: string;
  undone: boolean;
  recovered: number;
  before: number;
  after: number;
  labels: Record<string, string>;
}
export interface State {
  currency: "PHP";
  period: { start: string; end: string };
  accounts: Account[];
  allocations: Allocation[];
  transactions: Transaction[];
  goals: Goal[];
  expected: ExpectedIncome[];
  history: RecoveryRecord[];
  archives: { period: State["period"]; allocations: Allocation[] }[];
}
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("saveAccount"), value: accountSchema }),
  z.object({ type: z.literal("saveAllocation"), value: allocationSchema }),
  z.object({ type: z.literal("deleteAllocation"), id }),
  z.object({ type: z.literal("saveTransaction"), value: transactionSchema }),
  z.object({ type: z.literal("deleteTransaction"), id }),
  z.object({ type: z.literal("saveGoal"), value: goalSchema }),
  z.object({ type: z.literal("saveExpected"), value: expectedSchema }),
  z.object({ type: z.literal("deleteExpected"), id }),
  z.object({
    type: z.literal("receiveExpected"),
    id,
    accountId: id,
    date: day,
  }),
  z.object({ type: z.literal("startPeriod"), period: periodSchema }),
  z.object({
    type: z.literal("applyRecovery"),
    routeId: id,
    disruption: disruptionSchema,
  }),
  z.object({ type: z.literal("undoRecovery"), id }),
]);
export type Command = z.infer<typeof commandSchema>;
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function initialState(date = today()): State {
  const [year, month] = date.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return {
    currency: "PHP",
    period: { start: `${date.slice(0, 7)}-01`, end },
    accounts: [],
    allocations: [],
    transactions: [],
    goals: [],
    expected: [],
    history: [],
    archives: [],
  };
}
