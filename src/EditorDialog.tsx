import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Amount, Field, FormDialog } from "./components";
import { accountBalance, formatMoney } from "../shared/finance";
import {
  today,
  type State,
  type Command,
  type Allocation,
  type Transaction,
  type ExpectedIncome,
} from "../shared/model";
import { uid, str, amount, type Editor } from "./common";
export default function EditorDialog({
  editor,
  state,
  mutate,
  close,
}: {
  editor: Editor;
  state: State;
  mutate: (c: Command) => Promise<void>;
  close: () => void;
}) {
  const [allocationKind, setAllocationKind] = useState(
    editor.kind === "allocation"
      ? (editor.value?.kind ?? "category")
      : "category",
  );
  const [transactionType, setTransactionType] = useState(
    editor.kind === "transaction"
      ? (editor.value?.type ?? "expense")
      : "expense",
  );
  const [deleting, setDeleting] = useState(false);
  const frequencies = (
    <>
      <option value="once">One time</option>
      <option value="weekly">Weekly</option>
      <option value="biweekly">Every two weeks</option>
      <option value="semimonthly">Twice a month</option>
      <option value="monthly">Monthly</option>
      <option value="irregular">Irregular</option>
    </>
  );
  const walletSelect = (defaultValue?: string) => (
    <Field label="Wallet">
      <select name="accountId" required defaultValue={defaultValue}>
        {state.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {formatMoney(accountBalance(state, a.id))}
          </option>
        ))}
      </select>
    </Field>
  );
  let title = "",
    description = "",
    fields: ReactNode,
    save: (data: FormData) => Promise<void> = async () => {},
    deleteCommand: Command | undefined;
  if (editor.kind === "account") {
    const a = editor.value;
    title = a ? "Edit wallet" : "Add a wallet";
    description =
      "Track cash, GCash, Maya or a bank account manually. The opening balance is what you had before your recorded transactions.";
    fields = (
      <>
        <Field label="Wallet name">
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={a?.name}
            placeholder="e.g. GCash"
            autoFocus
          />
        </Field>
        <Field label="Opening balance">
          <Amount name="opening" value={a?.opening} />
        </Field>
      </>
    );
    save = (data) =>
      mutate({
        type: "saveAccount",
        value: {
          id: a?.id ?? uid(),
          name: str(data, "name"),
          opening: amount(data, "opening"),
        },
      });
  } else if (editor.kind === "transaction") {
    const t = editor.value;
    title = t ? "Edit transaction" : "A little update";
    description =
      "Record what came in or went out. Your balances will update right away.";
    const categories = [
      ...new Map(
        [
          ...state.archives.flatMap((a) => a.allocations),
          ...state.allocations,
        ].map((a) => [a.id, a]),
      ).values(),
    ].filter((a) => a.kind !== "savings");
    fields = (
      <>
        <Field label="Transaction type">
          <select
            name="type"
            value={transactionType}
            onChange={(e) =>
              setTransactionType(e.target.value as Transaction["type"])
            }
          >
            <option value="expense">Expense</option>
            <option value="income">Received income</option>
          </select>
        </Field>
        <Field label="Amount">
          <Amount value={t?.amount} />
        </Field>
        <div className="form-grid">
          {walletSelect(t?.accountId)}
          <Field label="Date">
            <input
              name="date"
              type="date"
              defaultValue={t?.date ?? today()}
              max={today()}
              required
            />
          </Field>
        </div>
        {transactionType === "expense" && (
          <Field label="Category">
            <select name="allocationId" defaultValue={t?.allocationId ?? ""}>
              <option value="">Uncategorized / unexpected</option>
              {categories.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Note (optional)">
          <input
            name="note"
            maxLength={200}
            defaultValue={t?.note}
            placeholder="What was it for?"
          />
        </Field>
      </>
    );
    save = (data) =>
      mutate({
        type: "saveTransaction",
        value: {
          id: t?.id ?? uid(),
          type: transactionType,
          amount: amount(data),
          accountId: str(data, "accountId"),
          allocationId:
            transactionType === "expense"
              ? str(data, "allocationId") || undefined
              : undefined,
          date: str(data, "date"),
          note: str(data, "note"),
        },
      });
    if (t) deleteCommand = { type: "deleteTransaction", id: t.id };
  } else if (editor.kind === "allocation") {
    const a = editor.value;
    title = a ? "Edit allocation" : "Give your money a purpose";
    description =
      "Reserve part of your actual cash. The limit includes anything already spent in this category during the current period.";
    fields = (
      <>
        <Field label="Name">
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={a?.name}
            placeholder="e.g. Groceries, rent, or a new laptop"
            list="suggested-categories"
          />
        </Field>
        <datalist id="suggested-categories">
          {[
            "Housing",
            "Utilities",
            "Groceries",
            "Transportation",
            "Education",
            "Healthcare",
            "Debt obligations",
            "Dining out",
            "Entertainment",
            "Shopping",
            "Hobbies",
            "Leisure",
            "Personal purchases",
          ].map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <div className="form-grid">
          <Field label="Allocation type">
            <select
              name="kind"
              value={allocationKind}
              onChange={(e) =>
                setAllocationKind(e.target.value as Allocation["kind"])
              }
            >
              <option value="category">Spending category</option>
              <option value="bill">Bill / commitment</option>
              <option value="purchase">Planned purchase</option>
              <option value="savings">Future savings contribution</option>
            </select>
          </Field>
          <Field label="Period allocation">
            <Amount name="limit" value={a?.limit} />
          </Field>
        </div>
        {allocationKind === "savings" && (
          <Field
            label="Savings goal"
            hint={
              !state.goals.length ? "Create a goal in Goals first." : undefined
            }
          >
            <select name="goalId" defaultValue={a?.goalId} required>
              <option value="">Choose a goal</option>
              {state.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {(allocationKind === "bill" || allocationKind === "purchase") && (
          <div className="form-grid">
            <Field
              label={
                allocationKind === "bill"
                  ? "Due date"
                  : "Planned date (optional)"
              }
            >
              <input
                name="due"
                type="date"
                defaultValue={a?.due}
                required={allocationKind === "bill"}
                min={state.period.start}
                max={state.period.end}
              />
            </Field>
            <Field label="Frequency">
              <select name="frequency" defaultValue={a?.frequency ?? "once"}>
                {frequencies}
              </select>
            </Field>
          </div>
        )}
        <label className="check-field">
          <input
            type="checkbox"
            name="essential"
            defaultChecked={a?.essential}
          />
          <span>
            <strong>This is essential</strong>
            <small>Money GPS will preserve this allocation.</small>
          </span>
        </label>
        <label className="check-field">
          <input type="checkbox" name="locked" defaultChecked={a?.locked} />
          <span>
            <strong>Lock this allocation</strong>
            <small>Protect it even if it is not an essential expense.</small>
          </span>
        </label>
        {allocationKind === "bill" && (
          <p className="muted">
            Bills remain committed in Money GPS. Frequency is a reminder; future
            bills are entered manually.
          </p>
        )}
      </>
    );
    save = (data) =>
      mutate({
        type: "saveAllocation",
        value: {
          id: a?.id ?? uid(),
          name: str(data, "name"),
          limit: amount(data, "limit"),
          kind: allocationKind,
          essential: data.has("essential"),
          locked: data.has("locked"),
          due: str(data, "due") || undefined,
          frequency: (str(data, "frequency") ||
            "once") as Allocation["frequency"],
          goalId:
            allocationKind === "savings"
              ? str(data, "goalId") || undefined
              : undefined,
        },
      });
    if (a) deleteCommand = { type: "deleteAllocation", id: a.id };
  } else if (editor.kind === "goal") {
    const g = editor.value;
    title = g ? "Update your goal" : "Something to look forward to";
    description =
      "Saved funds are earmarked from your existing wallet cash. Increasing them consumes this goal’s planned contribution first, without counting the money twice.";
    fields = (
      <>
        <Field label="Goal name">
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={g?.name}
            placeholder="e.g. A rainy-day fund"
          />
        </Field>
        <div className="form-grid">
          <Field label="Target amount">
            <Amount name="target" value={g?.target} />
          </Field>
          <Field label="Already saved">
            <Amount name="saved" value={g?.saved ?? 0} />
          </Field>
        </div>
        <Field label="Target date (optional)">
          <input type="date" name="due" defaultValue={g?.due} />
        </Field>
      </>
    );
    save = (data) =>
      mutate({
        type: "saveGoal",
        value: {
          id: g?.id ?? uid(),
          name: str(data, "name"),
          target: amount(data, "target"),
          saved: amount(data, "saved"),
          due: str(data, "due") || undefined,
        },
      });
  } else if (editor.kind === "expected") {
    const e = editor.value;
    title = e ? "Update expected income" : "What’s coming in?";
    description =
      "An estimate, separate from cash. If a payment is delayed or reduced, update it here; your available balance stays unchanged until it arrives.";
    fields = (
      <>
        <Field label="Income source">
          <input
            name="name"
            defaultValue={e?.name}
            placeholder="e.g. Salary or freelance work"
            maxLength={80}
            required
          />
        </Field>
        <Field label="Expected amount">
          <Amount value={e?.amount} />
        </Field>
        <div className="form-grid">
          <Field label="Expected date">
            <input
              type="date"
              name="date"
              defaultValue={e?.date ?? today()}
              required
            />
          </Field>
          <Field label="Frequency">
            <select name="frequency" defaultValue={e?.frequency ?? "monthly"}>
              {frequencies}
            </select>
          </Field>
        </div>
      </>
    );
    save = (data) =>
      mutate({
        type: "saveExpected",
        value: {
          id: e?.id ?? uid(),
          name: str(data, "name"),
          amount: amount(data),
          date: str(data, "date"),
          frequency: str(data, "frequency") as ExpectedIncome["frequency"],
        },
      });
    if (e) deleteCommand = { type: "deleteExpected", id: e.id };
  } else if (editor.kind === "receive") {
    title = "The money has arrived";
    description = `Record ${formatMoney(editor.value.amount)} from ${editor.value.name} as received income. This removes the pending payment and updates your wallet once.`;
    fields = (
      <>
        {walletSelect()}
        <Field label="Received date">
          <input
            type="date"
            name="date"
            defaultValue={today()}
            max={today()}
            required
          />
        </Field>
      </>
    );
    save = (data) =>
      mutate({
        type: "receiveExpected",
        id: editor.value.id,
        accountId: str(data, "accountId"),
        date: str(data, "date"),
      });
  } else if (editor.kind === "period") {
    title = "A fresh budget period";
    description =
      "Archive the current plan. Category names and protection carry forward with zero allocations; explicitly fund the new period. Wallets, transactions, savings and history stay with you.";
    fields = (
      <div className="form-grid">
        <Field label="Start date">
          <input name="start" type="date" required />
        </Field>
        <Field label="End date">
          <input name="end" type="date" required />
        </Field>
      </div>
    );
    save = (data) =>
      mutate({
        type: "startPeriod",
        period: { start: str(data, "start"), end: str(data, "end") },
      });
  } else {
    title = `Delete ${editor.label}?`;
    save = () => mutate(editor.command);
  }
  if (deleting && deleteCommand)
    return (
      <FormDialog
        title="Delete this record?"
        description="This removes the record and recalculates your balances. This action cannot be undone."
        onClose={() => setDeleting(false)}
        onSave={() => mutate(deleteCommand!).then(close)}
        submit="Delete record"
        danger
      />
    );
  return (
    <FormDialog
      title={title}
      description={description}
      onClose={close}
      onSave={save}
      submit={editor.kind === "receive" ? "Confirm received" : "Save changes"}
    >
      {fields}
      {deleteCommand && (
        <button
          type="button"
          className="text-button delete-link"
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={15} /> Delete record
        </button>
      )}
    </FormDialog>
  );
}
