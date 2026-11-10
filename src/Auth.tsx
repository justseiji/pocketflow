import { useState, type FormEvent } from "react";
import { ArrowRight, Compass, LockKeyhole, ShieldCheck } from "lucide-react";
import { request, type User } from "./api";
import { Field } from "./components";
import { Logo, str } from "./common";
export default function Auth({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await request<{ user: User }>(`/auth/${mode}`, {
        name: str(form, "name"),
        email: str(form, "email"),
        password: String(form.get("password") ?? ""),
      });
      onLogin(result.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth">
      <section className="auth-story">
        <Logo light />
        <div className="auth-copy">
          <span className="pill light-pill">
            <Compass size={15} /> A little direction for your money
          </span>
          <h1>
            Life doesn't
            <br />
            follow a budget.
            <br />
            <em>Yours can adapt.</em>
          </h1>
          <p>
            Track your money. Protect what matters.
            <br />
            Find your next move.
          </p>
          <div className="route-art" aria-hidden="true">
            <svg viewBox="0 0 420 170">
              <path
                d="M12 120C100 120 75 35 170 35S230 140 310 140s70-100 100-100"
                fill="none"
                stroke="#759986"
                strokeWidth="2"
                strokeDasharray="6 7"
              />
              <circle cx="12" cy="120" r="6" fill="#e0ecc1" />
              <circle cx="170" cy="35" r="9" fill="#e0ecc1" />
              <circle cx="410" cy="40" r="9" fill="#e0ecc1" />
            </svg>
            <div className="route-note">
              <ShieldCheck size={19} />
              <span>Your priorities, protected.</span>
            </div>
          </div>
        </div>
        <p className="auth-footer">Small steps. More breathing room.</p>
      </section>
      <section className="auth-form">
        <div className="mobile-brand">
          <Logo />
        </div>
        <div className="auth-form-inner">
          <p className="eyebrow">YOUR NEXT CHAPTER</p>
          <h2>
            {mode === "register" ? "Make room for life." : "Welcome back."}
          </h2>
          <p className="muted">
            {mode === "register"
              ? "Start with what you have. Build a plan that moves with you."
              : "A clear view of your money is a good place to start."}
          </p>
          <form onSubmit={submit}>
            {mode === "register" && (
              <Field label="Your name">
                <input
                  name="name"
                  autoComplete="given-name"
                  required
                  maxLength={80}
                  placeholder="What should we call you?"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password" hint="At least 12 characters.">
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                minLength={12}
                maxLength={128}
                required
                placeholder="Your private passphrase"
              />
            </Field>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button wide" disabled={busy}>
              {busy
                ? "One moment…"
                : mode === "register"
                  ? "Create your account"
                  : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-switch">
            {mode === "register"
              ? "Already have an account?"
              : "New to PocketFlow?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setMode(mode === "register" ? "login" : "register");
                setError("");
              }}
            >
              {mode === "register" ? "Sign in" : "Create an account"}
            </button>
          </p>
          <div className="privacy-note">
            <LockKeyhole size={15} />
            <span>Manually tracked. No bank connection needed.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
