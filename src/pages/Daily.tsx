import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  CircleHelp,
  Compass,
  CreditCard,
  Flag,
  ListFilter,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Empty, Money, Progress, SectionTitle } from "../components";
import {
  accountBalance,
  financials,
  formatMoney,
  remaining,
  spent,
} from "../../shared/finance";
import { today, type State, type Transaction } from "../../shared/model";
import { shortDate, type Page, type Editor } from "../common";
export function Overview({
  state,
  go,
  edit,
}: {
  state: State;
  go: (p: Page) => void;
  edit: (e: Editor) => void;
}) {
  const f = financials(state);
  const recent = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const bills = state.allocations
    .filter((a) => a.kind === "bill" && remaining(state, a) > 0)
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  return (
    <>
      {!state.accounts.length && (
        <div className="welcome-banner">
          <div className="round-icon">
            <Wallet size={24} />
          </div>
          <div>
            <h3>Your plan starts with what you have.</h3>
            <p>
              Add a cash wallet, GCash, Maya, or a bank balance. Then give your
              money a little direction.
            </p>
          </div>
          <button className="button" onClick={() => edit({ kind: "account" })}>
            Add your first wallet
            <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="overview-grid">
        <section className="balance-card">
          <div className="card-top">
            <span>
              <span className="status-dot" /> YOUR MONEY, RIGHT NOW
            </span>
            <Wallet size={20} />
          </div>
          <p className="balance-label">Total available funds</p>
          <Money value={f.cash} className="hero-money" />
          <p className="balance-sub">
            Across {state.accounts.length} manually tracked{" "}
            {state.accounts.length === 1 ? "wallet" : "wallets"}
          </p>
          <div className="balance-bottom">
            <div>
              <span>
                <ArrowDownLeft size={14} /> Income received
              </span>
              <Money value={f.income} />
            </div>
            <div>
              <span>
                <ArrowUpRight size={14} /> Spent this period
              </span>
              <Money value={f.expenses} />
            </div>
          </div>
          <div className="balance-circle" />
        </section>
        <section className="card snapshot">
          <div className="card-top">
            <h3>The breathing room</h3>
            <span className="tag">
              {shortDate(state.period.start)} – {shortDate(state.period.end)}
            </span>
          </div>
          <div className="snapshot-row">
            <span>
              <i className="dot green" /> Protected commitments
            </span>
            <Money value={f.protectedFunds} />
          </div>
          <div className="snapshot-row">
            <span>
              <i className="dot sage" /> Flexible reservations
            </span>
            <Money value={f.flexible} />
          </div>
          <div className="snapshot-row">
            <span>
              <i className="dot sand" /> Already saved
            </span>
            <Money value={f.saved} />
          </div>
          <div className="snapshot-total">
            <span>
              {f.projected < 0 ? "Uncovered plan" : "Unallocated cash"}
              <small>After all remaining reservations</small>
            </span>
            <Money
              value={f.projected}
              className={f.projected < 0 ? "text-orange" : ""}
            />
          </div>
        </section>
      </div>
      <section className={`gps-banner ${f.projected < 0 ? "needs-route" : ""}`}>
        <span className="gps-banner-icon">
          <Compass size={31} />
        </span>
        <div>
          <p className="eyebrow">MONEY GPS</p>
          <h2>
            {f.projected < 0
              ? "A new route could give you some room."
              : "Life takes turns. You have options."}
          </h2>
          <p>
            {f.projected < 0
              ? `Your current plan has a ${formatMoney(-f.projected)} gap. Let’s find a way forward while protecting your priorities.`
              : "Explore a change in your budget and see clear, practical ways to adapt."}
          </p>
        </div>
        <button className="button secondary" onClick={() => go("gps")}>
          {f.projected < 0 ? "Find a recovery route" : "Explore Money GPS"}
          <ArrowUpRight size={17} />
        </button>
      </section>
      <div className="overview-lower">
        <section className="card">
          <SectionTitle title="Recent activity" eyebrow="THE EVERYDAY">
            <button className="text-button" onClick={() => go("transactions")}>
              View all
              <ArrowRight size={15} />
            </button>
          </SectionTitle>
          {recent.length ? (
            <div className="transaction-list">
              {recent.map((t) => (
                <TransactionRow
                  key={t.id}
                  transaction={t}
                  state={state}
                  onClick={() => edit({ kind: "transaction", value: t })}
                />
              ))}
            </div>
          ) : (
            <Empty title="A fresh start">
              Your daily spending and received income will show up here.
            </Empty>
          )}
        </section>
        <section className="card">
          <SectionTitle title="Coming up" eyebrow="A LITTLE LOOK AHEAD">
            <button
              className="icon-button"
              aria-label="Add an allocation or bill"
              onClick={() => edit({ kind: "allocation" })}
            >
              <Plus size={19} />
            </button>
          </SectionTitle>
          {bills.length ? (
            bills.slice(0, 3).map((b) => (
              <button
                className="bill-row"
                key={b.id}
                onClick={() => edit({ kind: "allocation", value: b })}
              >
                <span className="date-tile">
                  {b.due ? shortDate(b.due).split(" ")[0] : "DUE"}
                  <strong>{b.due?.slice(-2) ?? "—"}</strong>
                </span>
                <span>
                  <strong>{b.name}</strong>
                  <small>
                    {b.essential || b.locked ? "Protected" : "Committed"} ·{" "}
                    {b.due && b.due < today() ? "Past due" : "Upcoming"}
                  </small>
                </span>
                <Money value={remaining(state, b)} />
              </button>
            ))
          ) : (
            <div className="quiet-state">
              <ShieldCheck size={28} />
              <p>No upcoming bills yet.</p>
              <button
                className="text-button"
                onClick={() => edit({ kind: "allocation" })}
              >
                Plan a commitment
                <Plus size={14} />
              </button>
            </div>
          )}
          <div className="forecast-note">
            <CircleHelp size={16} />
            <p>
              Expected income of <Money value={f.expected} /> is separate from
              the cash you have today.
            </p>
          </div>
        </section>
      </div>
      <section className="wallet-section">
        <SectionTitle title="Your wallets">
          <button
            className="text-button"
            onClick={() => edit({ kind: "account" })}
          >
            Add wallet
            <Plus size={15} />
          </button>
        </SectionTitle>
        <div className="wallet-grid">
          {state.accounts.map((a) => (
            <button
              className="wallet-card"
              key={a.id}
              onClick={() => edit({ kind: "account", value: a })}
            >
              <span className="round-icon">
                <CreditCard size={20} />
              </span>
              <span>
                <small>{a.name}</small>
                <Money value={accountBalance(state, a.id)} />
              </span>
              <MoreHorizontal size={18} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function TransactionRow({
  transaction: t,
  state,
  onClick,
}: {
  transaction: Transaction;
  state: State;
  onClick: () => void;
}) {
  const allocation =
    state.allocations.find((a) => a.id === t.allocationId) ??
    state.archives
      .flatMap((a) => a.allocations)
      .find((a) => a.id === t.allocationId);
  return (
    <button className="transaction-row" onClick={onClick}>
      <span
        className={`transaction-icon ${t.type === "income" ? "income" : ""}`}
      >
        {t.type === "income" ? (
          <ArrowDownLeft size={19} />
        ) : (
          <ReceiptText size={19} />
        )}
      </span>
      <span className="transaction-name">
        <strong>
          {t.note ||
            allocation?.name ||
            (t.type === "income" ? "Received income" : "Expense")}
        </strong>
        <small>
          {allocation?.name ??
            (t.type === "income" ? "Income" : "Uncategorized")}{" "}
          <span>·</span>{" "}
          {state.accounts.find((a) => a.id === t.accountId)?.name}
        </small>
      </span>
      <span className="transaction-amount">
        <span className={t.type === "income" ? "text-green" : ""}>
          {t.type === "income" ? "+" : "−"}
          <Money value={t.amount} />
        </span>
        <small>{shortDate(t.date)}</small>
      </span>
      <ChevronRight size={15} />
    </button>
  );
}

export function Transactions({
  state,
  edit,
}: {
  state: State;
  edit: (e: Editor) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const categories = [
    ...new Map(
      [
        ...state.archives.flatMap((a) => a.allocations),
        ...state.allocations,
      ].map((a) => [a.id, a]),
    ).values(),
  ];
  const rows = state.transactions
    .filter(
      (t) =>
        (!category || t.allocationId === category || t.type === category) &&
        (!from || t.date >= from) &&
        (!to || t.date <= to) &&
        `${t.note} ${categories.find((a) => a.id === t.allocationId)?.name ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="card">
      <div className="filters">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search transactions"
            placeholder="Search your activity…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="select-filter">
          <ListFilter size={16} />
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            <option value="income">Income</option>
            {categories.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="date-filter">
          From
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="date-filter">
          To
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <div className="list-caption">
        <span>
          {rows.length} {rows.length === 1 ? "transaction" : "transactions"}
        </span>
        <span>Most recent first</span>
      </div>
      {rows.length ? (
        rows.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={t}
            state={state}
            onClick={() => edit({ kind: "transaction", value: t })}
          />
        ))
      ) : (
        <Empty
          title={
            state.transactions.length
              ? "Nothing matches just yet."
              : "Your money has a story."
          }
        >
          {state.transactions.length
            ? "Try a different search or date range."
            : "Record your first expense or income to start seeing it."}
        </Empty>
      )}
    </section>
  );
}

export function Plan({
  state,
  edit,
}: {
  state: State;
  edit: (e: Editor) => void;
}) {
  const f = financials(state);
  return (
    <>
      <section className="plan-summary">
        <div>
          <p className="eyebrow">CURRENT BUDGET PERIOD</p>
          <h2>
            {shortDate(state.period.start)} – {shortDate(state.period.end)},{" "}
            {state.period.end.slice(0, 4)}
          </h2>
        </div>
        <div>
          <small>Remaining reservations</small>
          <Money value={f.reserved} />
        </div>
        <div>
          <small>Unallocated cash</small>
          <Money value={f.projected} />
        </div>
        <button
          className="button secondary"
          onClick={() => edit({ kind: "period" })}
        >
          New period
          <ArrowRight size={15} />
        </button>
      </section>
      <SectionTitle title="Your priorities, your plan">
        <button className="button" onClick={() => edit({ kind: "allocation" })}>
          <Plus size={17} /> Add allocation
        </button>
      </SectionTitle>
      <p className="section-description">
        Essential and locked allocations stay protected. Bills are committed
        funds. Only unspent optional reservations can change in Money GPS.
      </p>
      <div className="allocation-grid">
        {state.allocations.map((a) => {
          const used = spent(state, a);
          return (
            <button
              className="card allocation-card"
              key={a.id}
              onClick={() => edit({ kind: "allocation", value: a })}
            >
              <div className="card-top">
                <span className="round-icon">
                  {a.essential || a.locked ? (
                    <ShieldCheck size={20} />
                  ) : a.kind === "savings" ? (
                    <Flag size={20} />
                  ) : (
                    <Wallet size={20} />
                  )}
                </span>
                <span
                  className={`tag ${a.essential || a.locked ? "protected" : ""}`}
                >
                  {a.essential || a.locked
                    ? "Protected"
                    : a.kind === "bill"
                      ? "Committed"
                      : "Flexible"}
                </span>
              </div>
              <h3>{a.name}</h3>
              <div className="allocation-amount">
                <Money value={remaining(state, a)} />
                <span>left of {formatMoney(a.limit)}</span>
              </div>
              <Progress
                value={a.limit ? (used / a.limit) * 100 : used ? 100 : 0}
                danger={used > a.limit}
              />
              <div className="allocation-bottom">
                <span>
                  {a.kind === "savings"
                    ? "Planned contribution"
                    : `${formatMoney(used)} spent`}
                </span>
                <span>
                  {used > a.limit
                    ? `${formatMoney(used - a.limit)} over`
                    : a.due
                      ? `Due ${shortDate(a.due)}`
                      : a.kind === "purchase"
                        ? "Reserved purchase"
                        : a.kind}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {!state.allocations.length && (
        <section className="card">
          <Empty
            title="Make room for what matters."
            action={
              <button
                className="button"
                onClick={() => edit({ kind: "allocation" })}
              >
                Create an allocation
                <Plus size={16} />
              </button>
            }
          >
            Start with essentials, then set aside money for everyday spending
            and future plans.
          </Empty>
        </section>
      )}
      <section className="card expected-section">
        <SectionTitle title="Expected income" eyebrow="LOOKING AHEAD">
          <button
            className="text-button"
            onClick={() => edit({ kind: "expected" })}
          >
            Add expected income
            <Plus size={15} />
          </button>
        </SectionTitle>
        <p className="section-description">
          Planned, not yet in your wallet. Edit the amount or date when a
          payment changes; mark received only when it arrives.
        </p>
        {state.expected.map((e) => (
          <div className="expected-row" key={e.id}>
            <button
              className="expected-info"
              onClick={() => edit({ kind: "expected", value: e })}
            >
              <span className="transaction-icon income">
                <ArrowDownLeft size={20} />
              </span>
              <span>
                <strong>{e.name}</strong>
                <small>
                  {shortDate(e.date)} · {e.frequency}
                </small>
              </span>
              <Money value={e.amount} />
            </button>
            <button
              className="button secondary compact"
              disabled={!state.accounts.length}
              onClick={() => edit({ kind: "receive", value: e })}
            >
              Mark received
            </button>
          </div>
        ))}
        {!state.expected.length && (
          <p className="subtle-empty">
            No expected payments. Add a salary, allowance, or freelance payment
            when you know it’s coming.
          </p>
        )}
      </section>
      {!!state.archives.length && (
        <section className="card expected-section">
          <SectionTitle title="Previous periods" />
          <div>
            {state.archives.map((a, i) => (
              <details key={i}>
                <summary>
                  {a.period.start} — {a.period.end}
                </summary>
                {a.allocations.map((b) => (
                  <p className="snapshot-row" key={b.id}>
                    <span>{b.name}</span>
                    <Money value={b.limit} />
                  </p>
                ))}
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function Goals({
  state,
  edit,
}: {
  state: State;
  edit: (e: Editor) => void;
}) {
  return (
    <>
      <div className="info-strip">
        <ShieldCheck size={19} />
        <p>
          Already-saved money is earmarked within your wallet balances and stays
          protected. Future contributions are managed in Your plan.
        </p>
      </div>
      <SectionTitle title="Good things take a little planning">
        <button className="button" onClick={() => edit({ kind: "goal" })}>
          <Plus size={17} /> New goal
        </button>
      </SectionTitle>
      <div className="goal-grid">
        {state.goals.map((g) => (
          <button
            className="card goal-card"
            key={g.id}
            onClick={() => edit({ kind: "goal", value: g })}
          >
            <div className="card-top">
              <span className="goal-icon">
                <Flag size={25} />
              </span>
              <span className="tag">
                {g.due ? shortDate(g.due) : "At your own pace"}
              </span>
            </div>
            <h2>{g.name}</h2>
            <p className="goal-money">
              <Money value={g.saved} />
              <span>of {formatMoney(g.target)}</span>
            </p>
            <Progress value={(g.saved / g.target) * 100} />
            <div className="allocation-bottom">
              <span>
                {Math.floor((g.saved / g.target) * 100)}% of the way there
              </span>
              <span>{formatMoney(g.target - g.saved)} to go</span>
            </div>
            <p className="goal-contribution">
              {formatMoney(
                state.allocations
                  .filter((a) => a.kind === "savings" && a.goalId === g.id)
                  .reduce((s, a) => s + remaining(state, a), 0),
              )}{" "}
              planned this period
              <ArrowUpRight size={16} />
            </p>
          </button>
        ))}
      </div>
      {!state.goals.length && (
        <section className="card">
          <Empty
            title="What are you looking forward to?"
            action={
              <button className="button" onClick={() => edit({ kind: "goal" })}>
                Set your first goal
                <Flag size={16} />
              </button>
            }
          >
            A rainy-day fund, a new laptop, or a little time away. Start with
            something that matters to you.
          </Empty>
        </section>
      )}
    </>
  );
}
