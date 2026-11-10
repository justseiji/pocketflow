import { useEffect, useState } from "react";
import { Check, ChevronRight, Leaf, LogOut, Plus, X } from "lucide-react";
import {
  ApiError,
  request,
  saveCommand,
  type Portfolio,
  type User,
} from "./api";
import { financials } from "../shared/finance";
import type { Command } from "../shared/model";
import { Logo, nav, type Page, type Editor } from "./common";
import Auth from "./Auth";
import { Overview, Transactions, Plan, Goals } from "./pages/Daily";
import GPS from "./pages/GPS";
import EditorDialog from "./EditorDialog";
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bootError, setBootError] = useState("");
  useEffect(() => {
    request<{ user: User }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401))
          setBootError(e.message);
      })
      .finally(() => setLoaded(true));
  }, []);
  if (!loaded)
    return (
      <div className="loading">
        <Logo />
        <p>Finding your place…</p>
      </div>
    );
  if (bootError)
    return (
      <div className="loading">
        <Logo />
        <p role="alert">{bootError}</p>
        <button className="button" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!user) return <Auth onLogin={setUser} />;
  return <Workspace user={user} onLogout={() => setUser(null)} />;
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [portfolio, setPortfolio] = useState<Portfolio>();
  const [page, setPage] = useState<Page>("overview");
  const [editor, setEditor] = useState<Editor>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function refresh() {
    try {
      setPortfolio(await request<Portfolio>("/portfolio"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function mutate(command: Command, atVersion = portfolio!.version) {
    try {
      const next = await saveCommand(atVersion, command);
      setPortfolio(next);
      setNotice(
        command.type === "applyRecovery"
          ? "Your new route is in place. Keep moving forward."
          : command.type === "undoRecovery"
            ? "Recovery undone. Your previous plan is restored."
            : "Saved. Your plan is up to date.",
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) await refresh();
      throw e;
    }
  }
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const state = portfolio?.state;
  const f = state && financials(state);
  const addTransaction = () =>
    setEditor(
      state?.accounts.length ? { kind: "transaction" } : { kind: "account" },
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Logo />
        <p className="nav-caption">YOUR EVERYDAY, IN BALANCE</p>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <button
              key={item.id}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => setPage(item.id)}
              className={`nav-item ${page === item.id ? "active" : ""}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.id === "gps" && (
                <span className="nav-new">
                  {f && f.projected < 0 ? "1" : "↗"}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-tip">
            <Leaf size={21} />
            <p>
              Progress looks different
              <br />
              every day. Keep going.
            </p>
          </div>
          <button
            className="profile"
            onClick={() => {
              request("/auth/logout", {})
                .then(onLogout)
                .catch((e) => setError(e.message));
            }}
            title="Sign out"
          >
            <span className="avatar">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.name}</strong>
              <small>Personal workspace</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Your workspace <ChevronRight size={13} />{" "}
            <strong>{nav.find((n) => n.id === page)?.label}</strong>
          </span>
          <div className="topbar-right">
            <span className="currency-badge">
              PHP <span>Philippine peso</span>
            </span>
            <button
              className="avatar small-avatar"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => {
                request("/auth/logout", {})
                  .then(onLogout)
                  .catch((e) => setError(e.message));
              }}
            >
              {user.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {page === "overview"
                  ? "A CLEARER PICTURE, A CALMER DAY"
                  : page === "gps"
                    ? "WHEN LIFE TAKES A TURN"
                    : "A LITTLE CLARITY GOES A LONG WAY"}
              </p>
              <h1>
                {page === "overview"
                  ? `Hello, ${user.name.split(" ")[0]}.`
                  : page === "gps"
                    ? "Find your next move."
                    : nav.find((n) => n.id === page)?.label}
              </h1>
              <p className="muted">
                {page === "overview"
                  ? "Here’s where you are. And where you can go next."
                  : page === "gps"
                    ? "A change of plans doesn’t have to change what matters."
                    : page === "transactions"
                      ? "The little things, and the bigger picture."
                      : page === "plan"
                        ? "Give every peso a purpose. Leave room to adapt."
                        : "Something worth making room for."}
              </p>
            </div>
            <button className="button" onClick={addTransaction}>
              <Plus size={18} /> Add transaction
            </button>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}{" "}
              <button className="text-button" onClick={refresh}>
                Retry
              </button>
            </div>
          )}
          {!state || !portfolio ? (
            <p className="loading-inline">Loading your financial plan…</p>
          ) : (
            <>
              {page === "overview" && (
                <Overview state={state} go={setPage} edit={setEditor} />
              )}
              {page === "transactions" && (
                <Transactions state={state} edit={setEditor} />
              )}
              {page === "plan" && <Plan state={state} edit={setEditor} />}
              {page === "gps" && (
                <GPS
                  state={state}
                  version={portfolio.version}
                  mutate={mutate}
                />
              )}
              {page === "goals" && <Goals state={state} edit={setEditor} />}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Leaf size={13} /> A little more clarity. A little more
              possibility.
            </span>
            <span>PocketFlow · Made for real life</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((item) => (
          <button
            key={item.id}
            aria-current={page === item.id ? "page" : undefined}
            className={page === item.id ? "active" : ""}
            onClick={() => setPage(item.id)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {editor && state && (
        <EditorDialog
          editor={editor}
          state={state}
          mutate={mutate}
          close={() => setEditor(undefined)}
        />
      )}
    </div>
  );
}
