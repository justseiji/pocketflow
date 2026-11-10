import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Compass,
  Flag,
  History,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { Amount, Field, FormDialog, Money, SectionTitle } from "../components";
import { accountBalance, formatMoney } from "../../shared/finance";
import type { State, Command, Disruption } from "../../shared/model";
import type { Recovery, Route } from "../../shared/recovery";
import { request } from "../api";
import { amount, str } from "../common";
export default function GPS({
  state,
  version,
  mutate,
}: {
  state: State;
  version: number;
  mutate: (c: Command, v?: number) => Promise<void>;
}) {
  const [mode, setMode] = useState<"current" | "expense">("current");
  const [preview, setPreview] = useState<Recovery & { version: number }>();
  const [disruption, setDisruption] = useState<Disruption>({ type: "current" });
  const [selected, setSelected] = useState<Route>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<string>();
  useEffect(() => {
    setPreview(undefined);
    setSelected(undefined);
  }, [version]);
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSelected(undefined);
    setPreview(undefined);
    try {
      const form = new FormData(event.currentTarget);
      const change: Disruption =
        mode === "current"
          ? { type: "current" }
          : {
              type: "expense",
              amount: amount(form),
              accountId: str(form, "accountId"),
              note: str(form, "note") || "Unexpected expense",
            };
      const result = await request<Recovery & { version: number }>(
        "/recovery/preview",
        change,
      );
      if (result.version !== version)
        throw new Error(
          "Your plan changed in another tab. Reload the page and recalculate using your latest figures.",
        );
      setDisruption(change);
      setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="gps-intro">
        <div>
          <span className="pill">
            <Compass size={15} /> YOUR FINANCIAL CO-PILOT
          </span>
          <h2>
            Different routes.
            <br />
            <em>The same priorities.</em>
          </h2>
          <p>
            A surprise expense or a plan that no longer fits? Find practical
            ways forward, with your essentials kept safe.
          </p>
          <div className="gps-promises">
            <span>
              <ShieldCheck size={16} /> Protected priorities
            </span>
            <span>
              <Check size={16} /> Clear calculations
            </span>
            <span>
              <LockKeyhole size={16} /> You decide
            </span>
          </div>
        </div>
        <div className="gps-illustration" aria-hidden="true">
          <svg viewBox="0 0 280 220">
            <path
              d="M40 175C40 80 130 160 130 80s110-50 110-50M40 175c100 0 75-65 140-65s60-80 60-80"
              fill="none"
              stroke="#bed0ba"
              strokeWidth="3"
              strokeDasharray="5 8"
            />
            <path
              d="M40 175C40 80 130 160 130 80s110-50 110-50"
              fill="none"
              stroke="#38664b"
              strokeWidth="3"
            />
            <circle
              cx="40"
              cy="175"
              r="11"
              fill="#38664b"
              stroke="#fff"
              strokeWidth="5"
            />
            <circle
              cx="240"
              cy="30"
              r="13"
              fill="#edf0d9"
              stroke="#38664b"
              strokeWidth="3"
            />
          </svg>
          <span className="map-label">
            <Flag size={15} /> What matters to you
          </span>
        </div>
      </div>
      <section className="card recovery-form">
        <SectionTitle title="What changed?" eyebrow="LET’S START HERE" />
        <form onSubmit={calculate}>
          <div className="segmented" role="group" aria-label="Disruption type">
            <button
              type="button"
              className={mode === "current" ? "active" : ""}
              onClick={() => {
                setMode("current");
                setPreview(undefined);
              }}
            >
              Review my current plan
            </button>
            <button
              type="button"
              className={mode === "expense" ? "active" : ""}
              onClick={() => {
                setMode("expense");
                setPreview(undefined);
              }}
            >
              Explore an unexpected expense
            </button>
          </div>
          {mode === "expense" ? (
            <div className="simulation-fields">
              <Field label="Unexpected amount">
                <Amount />
              </Field>
              <Field label="Paid from">
                <select name="accountId" required>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {formatMoney(accountBalance(state, a.id))}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="What happened?">
                <input
                  name="note"
                  maxLength={80}
                  placeholder="e.g. An urgent repair"
                />
              </Field>
            </div>
          ) : (
            <p className="section-description">
              We’ll use your actual balances and remaining reservations. Delayed
              or reduced expected income never counts as available cash. Record
              expenses first if they have already happened.
            </p>
          )}
          <div className="recovery-form-bottom">
            <p>
              <CircleHelp size={15} />
              {mode === "expense"
                ? "This is a simulation until you confirm. Confirmation also records the expense."
                : "Nothing changes until you select and confirm a route."}
            </p>
            <button
              className="button"
              disabled={busy || !state.accounts.length}
            >
              {busy ? "Calculating…" : "Find my routes"}
              <ArrowRight size={17} />
            </button>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </form>
      </section>
      {preview && preview.version === version && (
        <section className="route-results" aria-live="polite">
          <SectionTitle
            eyebrow="YOUR NEXT POSSIBILITIES"
            title={
              preview.routes.length
                ? `${preview.routes.length} ${preview.routes.length === 1 ? "way" : "ways"} to find your balance`
                : preview.gap
                  ? "Let’s be clear about the gap."
                  : "You have room to work with."
            }
          />
          <div className="route-math">
            <span>
              Projected position <Money value={preview.before} />
            </span>
            <ArrowRight size={16} />
            <span>
              Adjustment needed <Money value={preview.gap} />
            </span>
            <span>
              Flexible capacity <Money value={preview.recoverable} />
            </span>
          </div>
          {preview.reason && (
            <div className="info-strip">
              <CircleHelp size={22} />
              <div>
                <p>{preview.reason}</p>
                {preview.uncovered > 0 && (
                  <strong>
                    {formatMoney(preview.uncovered)} remains uncovered even
                    after all eligible cuts.
                  </strong>
                )}
                {preview.gap === 0 && disruption.type === "expense" && (
                  <p>
                    To record this expense, use Add transaction. This simulation
                    has not changed your plan.
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="route-grid">
            {preview.routes.map((route, index) => (
              <section className="card route-card" key={route.id}>
                <div className="card-top">
                  <span className="route-number">
                    ROUTE {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="round-icon">
                    {route.id === "savings" ? (
                      <Flag size={20} />
                    ) : route.id === "purchase" ? (
                      <History size={20} />
                    ) : (
                      <Compass size={20} />
                    )}
                  </span>
                </div>
                <h3>{route.name}</h3>
                <p className="route-description">{route.description}</p>
                <div className="route-adjustments">
                  {route.adjustments.map((a) => (
                    <div key={a.allocationId}>
                      <span>
                        {
                          state.allocations.find((x) => x.id === a.allocationId)
                            ?.name
                        }
                      </span>
                      <strong>−{formatMoney(a.amount)}</strong>
                    </div>
                  ))}
                </div>
                <div className="route-recovered">
                  <span>Room created</span>
                  <Money value={route.recovered} />
                </div>
                <div className="route-impact">
                  <p>
                    <ShieldCheck size={15} /> Essential commitments protected
                  </p>
                  {route.savingsImpact.length ? (
                    route.savingsImpact.map((s, i) => (
                      <p key={i}>
                        <Flag size={15} />
                        {s.name}: {formatMoney(s.reduction)} less planned; about{" "}
                        {s.estimatedCycles} extra contribution cycle(s),
                        assuming the same future contribution.
                      </p>
                    ))
                  ) : (
                    <p>
                      <Check size={15} /> Planned savings preserved
                    </p>
                  )}
                  {route.purchaseImpact.map((p, i) => (
                    <p key={i}>
                      <History size={15} />
                      {p.name}: {formatMoney(p.reduction)} released; purchase
                      may need to wait.
                    </p>
                  ))}
                </div>
                <div className="route-projection">
                  After reservations
                  <Money value={route.projected} />
                </div>
                <button
                  className="button secondary wide"
                  onClick={() => setSelected(route)}
                >
                  Review this route
                  <ArrowRight size={16} />
                </button>
              </section>
            ))}
          </div>
        </section>
      )}
      <section className="card recovery-history">
        <SectionTitle
          title="The turns you’ve taken"
          eyebrow="RECOVERY HISTORY"
        />
        {!state.history.length ? (
          <p className="subtle-empty">
            Your confirmed recovery decisions will live here, so you can always
            see how your plan evolved.
          </p>
        ) : (
          [...state.history].reverse().map((record) => (
            <div className="history-row" key={record.id}>
              <span className="round-icon">
                <History size={19} />
              </span>
              <div>
                <h3>{record.name}</h3>
                <p>
                  {new Date(record.createdAt).toLocaleDateString("en-PH")} ·{" "}
                  {formatMoney(record.recovered)} reallocated ·{" "}
                  {record.undone ? "Undone" : "Applied"}
                </p>
                <details>
                  <summary>View changes</summary>
                  {record.adjustments.map((a) => (
                    <p key={a.allocationId}>
                      {record.labels[a.allocationId]}: −{formatMoney(a.amount)}
                    </p>
                  ))}
                  <p>
                    Projected position: {formatMoney(record.before)} →{" "}
                    {formatMoney(record.after)}
                  </p>
                </details>
              </div>
              {!record.undone && record.appliedVersion === version && (
                <button
                  className="button secondary compact"
                  onClick={() => setUndo(record.id)}
                >
                  Undo
                </button>
              )}
            </div>
          ))
        )}
      </section>
      {selected && preview && preview.version === version && (
        <FormDialog
          title="Take this route?"
          description="Review the changes below. Your financial plan changes only when you confirm."
          submit="Confirm and apply route"
          onClose={() => setSelected(undefined)}
          onSave={async () => {
            await mutate(
              { type: "applyRecovery", routeId: selected.id, disruption },
              preview.version,
            );
            setPreview(undefined);
          }}
        >
          <h3>{selected.name}</h3>
          {disruption.type === "expense" && (
            <p className="info-strip">
              This will also record {formatMoney(disruption.amount)} as an
              expense in{" "}
              {state.accounts.find((a) => a.id === disruption.accountId)?.name}.
            </p>
          )}
          {selected.adjustments.map((a) => {
            const allocation = state.allocations.find(
              (x) => x.id === a.allocationId,
            )!;
            return (
              <div className="snapshot-row" key={a.allocationId}>
                <span>{allocation.name}</span>
                <span>
                  {formatMoney(allocation.limit)} →{" "}
                  <strong>{formatMoney(allocation.limit - a.amount)}</strong>
                </span>
              </div>
            );
          })}
          <div className="info-strip">
            <ShieldCheck size={20} />
            <p>
              Protected priorities stay intact. This updates your plan and does
              not transfer any real money.
            </p>
          </div>
          <p className="muted">
            You can undo this decision until another financial change is saved.
          </p>
        </FormDialog>
      )}
      {undo && (
        <FormDialog
          title="Undo this recovery?"
          description="Restore the prior allocations and remove the expense recorded with this simulation, if any. The decision remains in your history."
          submit="Undo recovery"
          onClose={() => setUndo(undefined)}
          onSave={() => mutate({ type: "undoRecovery", id: undo })}
        />
      )}
    </>
  );
}
