import {
  Compass,
  Flag,
  LayoutDashboard,
  ReceiptText,
  Wallet,
} from "lucide-react";
import type {
  Account,
  Allocation,
  Command,
  ExpectedIncome,
  Goal,
  Transaction,
} from "../shared/model";
import { parseMoney } from "../shared/finance";
export const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: ReceiptText },
  { id: "plan", label: "Your plan", icon: Wallet },
  { id: "gps", label: "Money GPS", icon: Compass },
  { id: "goals", label: "Goals", icon: Flag },
] as const;
export type Page = (typeof nav)[number]["id"];
export type Editor =
  | { kind: "account"; value?: Account }
  | { kind: "allocation"; value?: Allocation }
  | { kind: "transaction"; value?: Transaction }
  | { kind: "goal"; value?: Goal }
  | { kind: "expected"; value?: ExpectedIncome }
  | { kind: "period" }
  | { kind: "receive"; value: ExpectedIncome }
  | { kind: "delete"; command: Command; label: string };
export const uid = () => crypto.randomUUID();
export const str = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
export const amount = (data: FormData, key = "amount") =>
  parseMoney(str(data, key));
export const shortDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className={`logo ${light ? "light" : ""}`}>
      <span className="logo-mark">
        <svg viewBox="0 0 30 30" fill="none" aria-hidden="true">
          <path
            d="M7 9h9a5 5 0 0 1 0 10h-4v6M7 9v16M7 14h9a1 1 0 0 1 0 2"
            stroke="currentColor"
            strokeWidth="3.3"
            strokeLinecap="round"
          />
          <path
            d="m20 4 4 4-4 4"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      PocketFlow<span className="logo-dot">.</span>
    </div>
  );
}
