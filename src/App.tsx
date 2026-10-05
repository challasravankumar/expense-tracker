import {
  useCallback,
  useEffect,
  useRef,
  useId,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  ReceiptText,
  ChartNoAxesCombined,
  Wallet,
  Settings,
  Plus,
  Sun,
  Moon,
  LogOut,
  X,
  Pencil,
  Trash2,
  Download,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  Search,
  ChevronRight,
} from "lucide-react";
import { db, configured, redirectURL } from "./client";
import {
  type Data,
  type Expense,
  type Category,
  type Budget,
  type Filters,
  methods,
  defaults,
  money,
  today,
  validDate,
  paise,
  total,
  inMonth,
  daysInMonth,
  comparison,
  monthlyAverage,
  group,
  emptyFilters,
  filterExpenses,
  csv,
  download,
  validateBackup,
  importPreview,
} from "./domain";
const blank: Data = { expenses: [], categories: [], budgets: [] };
const tabs = [
  ["Dashboard", LayoutDashboard],
  ["Expenses", ReceiptText],
  ["Reports", ChartNoAxesCombined],
  ["Budgets", Wallet],
  ["Settings", Settings],
] as const;
const colors = [
  "#168b83",
  "#528de0",
  "#edaf4e",
  "#a27be5",
  "#e38280",
  "#568d69",
  "#b28a5c",
];
const monthTitle = (m: string) =>
  new Date(m + "-02T12:00:00Z").toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
const dateTitle = (d: string) =>
  new Date(d + "T12:00:00Z").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
function demoData(): Data {
  const categories = defaults.map((name) => ({
    id: crypto.randomUUID(),
    name,
    archived: false,
  }));
  const now = today(),
    month = now.slice(0, 7);
  const expenses = Array.from({ length: 22 }, (_, i) => ({
    id: crypto.randomUUID(),
    date:
      month +
      "-" +
      String(Math.max(1, Number(now.slice(8)) - (i % 8))).padStart(2, "0"),
    amount_paise: [245000, 1800000, 48000, 32000, 125000, 99900, 34900][i % 7],
    category_id: categories[i % 7].id,
    description: [
      "Weekly groceries",
      "Monthly rent",
      "Lunch with family",
      "Cab ride",
      "Electricity bill",
      "Home broadband",
      "Mobile recharge",
    ][i % 7],
    payment_method: methods[i % 5],
    merchant: ["Fresh market", "", "Local kitchen", "City cab", "", "", ""][
      i % 7
    ],
    notes: "",
    version: 1,
  }));
  return {
    categories,
    expenses,
    budgets: [
      {
        id: crypto.randomUUID(),
        month: month + "-01",
        category_id: null,
        amount_paise: 10000000,
      },
    ],
  };
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(!db),
    [demo, setDemo] = useState(false),
    [recovery, setRecovery] = useState(
      new URLSearchParams(location.hash.slice(1)).get("type") === "recovery",
    );
  const [theme, setTheme] = useState(
    () => localStorage.getItem("expense-theme") || "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("expense-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data, error }) => {
      if (!error) setUser(data.session?.user || null);
      setReady(true);
    });
    const { data } = db.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setReady(true);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  if (!ready)
    return (
      <div className="auth">
        <p>Opening your account…</p>
      </div>
    );
  if (recovery && user)
    return (
      <Auth recovery onRecovered={() => setRecovery(false)} onDemo={() => {}} />
    );
  if (!user && !demo) return <Auth onDemo={() => setDemo(true)} />;
  return (
    <Workspace
      key={demo ? "demo" : user!.id}
      user={user}
      demo={demo}
      theme={theme}
      toggle={toggle}
      leave={async () => {
        if (demo) setDemo(false);
        else {
          const { error } = await db!.auth.signOut();
          if (error) throw error;
        }
      }}
    />
  );
}
function Auth({
  onDemo,
  recovery = false,
  onRecovered,
}: {
  onDemo: () => void;
  recovery?: boolean;
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register" | "reset">("login"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!db || busy) return;
    setBusy(true);
    setMessage("");
    try {
      let result;
      if (recovery) result = await db.auth.updateUser({ password });
      else if (mode === "login")
        result = await db.auth.signInWithPassword({ email, password });
      else if (mode === "register")
        result = await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectURL() },
        });
      else
        result = await db.auth.resetPasswordForEmail(email, {
          redirectTo: redirectURL(),
        });
      if (result.error) throw result.error;
      if (recovery) {
        onRecovered?.();
      } else if (mode === "register")
        setMessage("Check your email to confirm your account, then sign in.");
      else if (mode === "reset")
        setMessage(
          "If that account exists, a reset link has been sent. Check your email.",
        );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth">
      <div className="auth-brand">
        <div className="brand">
          <span className="brand-mark">
            <Wallet />
          </span>
          everyday<span className="brand-dot">.</span>
        </div>
        <div>
          <span className="eyebrow">A LITTLE CLARITY, EVERY DAY</span>
          <h1>
            Your spending.
            <br />
            All in one place.
          </h1>
          <p>
            From your morning coffee to your monthly bills. Keep a clear picture
            of where your money goes.
          </p>
        </div>
        <p className="privacy">
          <ShieldCheck size={19} /> Private account · Indian rupees · Any device
        </p>
      </div>
      <div className="auth-panel">
        <span className="eyebrow">YOUR PERSONAL EXPENSE TRACKER</span>
        <h2>
          {recovery
            ? "Choose a new password"
            : mode === "register"
              ? "Make yourself at home"
              : mode === "reset"
                ? "Reset your password"
                : "Welcome back"}
        </h2>
        <p className="muted">
          {recovery
            ? "Enter a new password for your account."
            : "A clearer view of your everyday expenses."}
        </p>
        {!configured && (
          <div className="notice">
            Online accounts need Supabase configuration. Follow the included
            README, or explore the separate demo below.
          </div>
        )}
        <form onSubmit={submit}>
          {!recovery && (
            <Field label="Email">
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          )}
          {(recovery || mode !== "reset") && (
            <Field label="Password">
              <input
                required
                minLength={8}
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          )}
          <p role="status">{message}</p>
          <button className="primary full" disabled={!configured || busy}>
            {busy
              ? "Please wait…"
              : recovery
                ? "Save password"
                : mode === "register"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset link"
                    : "Sign in"}
          </button>
        </form>
        {!recovery && (
          <>
            <div className="auth-links">
              <button
                onClick={() => {
                  setMode(mode === "register" ? "login" : "register");
                  setMessage("");
                }}
              >
                {mode === "register"
                  ? "Already registered? Sign in"
                  : "Create an account"}
              </button>
              <button
                onClick={() => {
                  setMode(mode === "reset" ? "login" : "reset");
                  setMessage("");
                }}
              >
                {mode === "reset" ? "Back to sign in" : "Forgot password?"}
              </button>
            </div>
            <div className="divider" />
            <button className="secondary full" onClick={onDemo}>
              Explore demo
            </button>
            <p className="small muted center">
              Separate sample data. Nothing is saved to an account.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Workspace({
  user,
  demo,
  theme,
  toggle,
  leave,
}: {
  user: User | null;
  demo: boolean;
  theme: string;
  toggle: () => void;
  leave: () => Promise<void>;
}) {
  const [data, setData] = useState<Data>(() => (demo ? demoData() : blank)),
    [loading, setLoading] = useState(!demo),
    [status, setStatus] = useState(
      demo ? "Demo · changes stay in this session" : "Loading…",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [lastSync, setLastSync] = useState("");
  const lock = useRef(false),
    seq = useRef(0),
    alive = useRef(true);
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(location.search).get("view");
    return tabs.some((x) => x[0] === t) ? t! : "Dashboard";
  });
  const [now, setNow] = useState(today()),
    [month, setMonth] = useState(today().slice(0, 7)),
    [year, setYear] = useState(today().slice(0, 4)),
    [day, setDay] = useState(today()),
    [period, setPeriod] = useState<"Daily" | "Monthly" | "Yearly">("Monthly"),
    [filters, setFilters] = useState<Filters>(emptyFilters);
  const [editing, setEditing] = useState<Expense | null>(null),
    [deleting, setDeleting] = useState<Expense | null>(null),
    [backup, setBackup] = useState<Data | null>(null);
  const refresh = useCallback(async () => {
    if (demo) return;
    const ticket = ++seq.current;
    try {
      const { data: next, error } = await db!.rpc("expense_snapshot");
      if (error) throw error;
      if (alive.current && ticket === seq.current) {
        setData(next as Data);
        setLoading(false);
        setLastSync(new Date().toLocaleTimeString("en-IN"));
        setStatus("Saved to your account");
        setError("");
      }
    } catch (e) {
      if (alive.current && ticket === seq.current) {
        setLoading(false);
        setError(
          "Could not refresh. Showing the last loaded data. " +
            (e as Error).message,
        );
      }
    }
  }, [demo]);
  useEffect(() => {
    alive.current = true;
    if (!demo) {
      void (async () => {
        const { error } = await db!.rpc("seed_categories");
        if (error) {
          setError(error.message);
          setLoading(false);
        } else await refresh();
      })();
      const channel = db!
        .channel("expenses-" + user!.id)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "expenses",
            filter: `user_id=eq.${user!.id}`,
          },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "categories",
            filter: `user_id=eq.${user!.id}`,
          },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "budgets",
            filter: `user_id=eq.${user!.id}`,
          },
          () => void refresh(),
        )
        .subscribe();
      const timer = setInterval(() => {
        if (document.visibilityState === "visible") void refresh();
      }, 20000);
      const visible = () => {
        if (document.visibilityState === "visible") void refresh();
      };
      window.addEventListener("online", visible);
      window.addEventListener("focus", visible);
      document.addEventListener("visibilitychange", visible);
      return () => {
        alive.current = false;
        seq.current++;
        clearInterval(timer);
        void db!.removeChannel(channel);
        window.removeEventListener("online", visible);
        window.removeEventListener("focus", visible);
        document.removeEventListener("visibilitychange", visible);
      };
    }
  }, [demo, refresh, user]);
  useEffect(() => {
    const t = setInterval(() => setNow(today()), 30000);
    const pop = () =>
      setTab(new URLSearchParams(location.search).get("view") || "Dashboard");
    window.addEventListener("popstate", pop);
    return () => {
      clearInterval(t);
      window.removeEventListener("popstate", pop);
    };
  }, []);
  const navigate = (t: string) => {
    setTab(t);
    const u = new URL(location.href);
    u.searchParams.set("view", t);
    history.pushState({}, "", u);
  };
  async function mutate(action: () => Promise<void>) {
    if (lock.current) throw Error("A save is already in progress.");
    lock.current = true;
    setBusy(true);
    setError("");
    setStatus("Saving…");
    try {
      await action();
      setStatus(demo ? "Saved in demo session" : "Saved to your account");
      if (!demo) await refresh();
    } catch (e) {
      setError((e as Error).message);
      setStatus("Save failed · retry available");
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    const { error } = await db!.rpc(name, args);
    if (error) throw error;
  }
  async function saveExpense(item: Expense) {
    await mutate(async () => {
      if (demo)
        setData((d) => ({
          ...d,
          expenses: [
            { ...item, version: (item.version || 0) + 1 },
            ...d.expenses.filter((x) => x.id !== item.id),
          ],
        }));
      else await rpc("save_expense", { item });
    });
    setEditing(null);
  }
  const newExpense = () =>
    setEditing({
      id: crypto.randomUUID(),
      date: now,
      amount_paise: 0,
      category_id: data.categories.find((c) => !c.archived)?.id || "",
      description: "",
      payment_method: "UPI",
      merchant: "",
      notes: "",
    });
  const categoryName = (id: string) =>
    data.categories.find((c) => c.id === id)?.name || "Category";
  const currentMonth = inMonth(data.expenses, now.slice(0, 7)),
    monthly = inMonth(data.expenses, month),
    yearly = data.expenses.filter((e) => e.date.startsWith(year)),
    daily = data.expenses.filter((e) => e.date === day),
    monthBudget = data.budgets.find(
      (b) => b.month === now.slice(0, 7) + "-01" && !b.category_id,
    );
  const openDay = (d: string) => {
    setDay(d);
    setPeriod("Daily");
    navigate("Reports");
  };
  const openMonth = (m: string) => {
    setMonth(m);
    setPeriod("Monthly");
    setFilters(emptyFilters);
    navigate("Reports");
  };
  const list = (items: Expense[], limit?: number) => (
    <ExpenseList
      items={items}
      categories={data.categories}
      onEdit={setEditing}
      onDelete={setDeleting}
      onDay={openDay}
      limit={limit}
    />
  );
  const filtered = filterExpenses(
    tab === "Reports" ? monthly : data.expenses,
    filters,
  );
  const cmp = comparison(data.expenses, month, now),
    avg = monthlyAverage(yearly, year, now);
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Wallet />
          </span>
          everyday<span className="brand-dot">.</span>
        </div>
        <span className="nav-label">PERSONAL FINANCE</span>
        <nav aria-label="Main navigation">
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "active" : ""}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => navigate(name)}
            >
              <Icon size={21} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck />
            <strong>Just for you</strong>
            <p>Your expenses. Your private space.</p>
          </div>
          <button
            className="account"
            onClick={() => {
              void leave().catch((e) => setError(e.message));
            }}
          >
            <span className="avatar">
              {demo ? "D" : user?.email?.[0].toUpperCase()}
            </span>
            <span>
              {demo ? "Demo account" : user?.email}
              <small>{demo ? "Exit demo" : "Sign out"}</small>
            </span>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            My workspace <ChevronRight size={15} /> <strong>{tab}</strong>
          </span>
          <div>
            <span className="small muted timezone">Asia/Kolkata · INR</span>
            <button
              aria-label={
                theme === "light"
                  ? "Switch to dark theme"
                  : "Switch to light theme"
              }
              onClick={toggle}
            >
              {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>
        <div className="page">
          {demo && (
            <div className="demo-banner">
              <span>
                <strong>DEMO MODE</strong> Sample data · changes reset when you
                leave
              </span>
              <button onClick={() => void leave()}>Exit demo</button>
            </div>
          )}
          <div className="page-title">
            <div>
              <span className="eyebrow">
                {tab === "Dashboard"
                  ? new Date(now + "T12:00:00Z").toLocaleDateString("en-IN", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      timeZone: "UTC",
                    })
                  : "YOUR EVERYDAY SPENDING"}
              </span>
              <h1>{tab === "Dashboard" ? "A little more clarity." : tab}</h1>
              <p className="muted">
                {tab === "Dashboard"
                  ? "Here’s where your money is going."
                  : tab === "Expenses"
                    ? "Every expense, with all the details."
                    : tab === "Reports"
                      ? "See the patterns behind your spending."
                      : tab === "Budgets"
                        ? "Give your spending a little direction."
                        : "Make this space your own."}
              </p>
            </div>
            <button
              className="primary"
              onClick={newExpense}
              disabled={loading || !data.categories.length}
            >
              <Plus size={19} /> Add Expense
            </button>
          </div>
          <div className="sync-line">
            <span role="status">
              {status}
              {lastSync && !demo ? ` · synced ${lastSync}` : ""}
            </span>
            {!demo && (
              <button
                onClick={() => void refresh()}
                aria-label="Refresh expenses"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            )}
          </div>
          {error && (
            <div role="alert" className="error">
              {error}{" "}
              <button onClick={() => void refresh()}>Retry refresh</button>
            </div>
          )}
          {loading ? (
            <div className="panel empty">Loading your expenses…</div>
          ) : (
            <>
              {tab === "Dashboard" && (
                <>
                  <div className="stats">
                    <Stat
                      label="Today’s spending"
                      value={money(
                        total(data.expenses.filter((e) => e.date === now)),
                      )}
                      note="The little things add up"
                    />
                    <Stat
                      label="This month"
                      value={money(total(currentMonth))}
                      note={monthTitle(now.slice(0, 7))}
                      featured
                    />
                    <Stat
                      label="This year"
                      value={money(
                        total(
                          data.expenses.filter((e) =>
                            e.date.startsWith(now.slice(0, 4)),
                          ),
                        ),
                      )}
                      note={`January – December ${now.slice(0, 4)}`}
                    />
                    <Stat
                      label="Monthly budget left"
                      value={
                        monthBudget
                          ? money(
                              monthBudget.amount_paise - total(currentMonth),
                            )
                          : "Not set"
                      }
                      note={
                        monthBudget
                          ? total(currentMonth) > monthBudget.amount_paise
                            ? "Over budget"
                            : "Room for the rest of the month"
                          : "Set a budget when you’re ready"
                      }
                    />
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="section-title">
                        <div>
                          <h2>Spending this month</h2>
                          <p className="muted small">
                            Your daily rhythm · {monthTitle(now.slice(0, 7))}
                          </p>
                        </div>
                        <button
                          className="text-button"
                          onClick={() => openMonth(now.slice(0, 7))}
                        >
                          View report <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <Chart
                        entries={Array.from(
                          { length: daysInMonth(now.slice(0, 7)) },
                          (_, i) => {
                            const d =
                              now.slice(0, 7) +
                              "-" +
                              String(i + 1).padStart(2, "0");
                            return {
                              key: d,
                              label: String(i + 1),
                              value: total(
                                currentMonth.filter((e) => e.date === d),
                              ),
                            };
                          },
                        )}
                        onSelect={openDay}
                      />
                    </section>
                    <section className="panel">
                      <h2>Where it went</h2>
                      <p className="muted small">Monthly category breakdown</p>
                      <Breakdown
                        items={currentMonth}
                        categories={data.categories}
                      />
                    </section>
                  </div>
                  <section className="panel">
                    <div className="section-title">
                      <div>
                        <h2>Recent expenses</h2>
                        <p className="small muted">
                          A closer look at the everyday
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => navigate("Expenses")}
                      >
                        View all <ArrowUpRight size={16} />
                      </button>
                    </div>
                    {list(data.expenses, 6)}
                  </section>
                </>
              )}
              {tab === "Expenses" && (
                <section className="panel">
                  <FiltersView
                    value={filters}
                    onChange={setFilters}
                    categories={data.categories}
                  />
                  <div className="section-title">
                    <p>
                      <strong>{filtered.length}</strong> expenses ·{" "}
                      <strong>{money(total(filtered))}</strong>
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        download(
                          "expenses.csv",
                          csv(filtered, data.categories),
                          "text/csv;charset=utf-8",
                        )
                      }
                    >
                      <Download size={17} /> Export CSV
                    </button>
                  </div>
                  {list(filtered)}
                </section>
              )}
              {tab === "Reports" && (
                <>
                  <div className="report-controls">
                    <div className="segmented">
                      {(["Daily", "Monthly", "Yearly"] as const).map((p) => (
                        <button
                          key={p}
                          className={period === p ? "selected" : ""}
                          onClick={() => {
                            setPeriod(p);
                            setFilters(emptyFilters);
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    {period === "Daily" ? (
                      <Field label="Choose date">
                        <input
                          type="date"
                          min="1900-01-01"
                          value={day}
                          onChange={(e) => {
                            if (validDate(e.target.value))
                              setDay(e.target.value);
                          }}
                        />
                      </Field>
                    ) : period === "Monthly" ? (
                      <Field label="Month and year">
                        <input
                          type="month"
                          min="1900-01"
                          value={month}
                          onChange={(e) => {
                            if (validDate(e.target.value + "-01")) {
                              setMonth(e.target.value);
                              setFilters(emptyFilters);
                            }
                          }}
                        />
                      </Field>
                    ) : (
                      <Field label="Year">
                        <input
                          type="number"
                          min="1900"
                          max="9999"
                          value={year}
                          onChange={(e) => setYear(e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                  {period === "Daily" && (
                    <>
                      <Stat
                        label={dateTitle(day)}
                        value={money(total(daily))}
                        note={`${daily.length} expenses`}
                      />
                      <div className="dashboard-grid">
                        <section className="panel">
                          <h2>Day’s expenses</h2>
                          {list(daily)}
                        </section>
                        <section className="panel">
                          <h2>Day’s categories</h2>
                          <Breakdown
                            items={daily}
                            categories={data.categories}
                          />
                        </section>
                      </div>
                    </>
                  )}
                  {period === "Monthly" && (
                    <>
                      <div className="stats three">
                        <Stat
                          label="Monthly total"
                          value={money(total(monthly))}
                          note={monthTitle(month)}
                        />
                        <Stat
                          label="Highest category"
                          value={
                            group(monthly, "category_id")[0]
                              ? categoryName(
                                  group(monthly, "category_id")[0][0],
                                )
                              : "—"
                          }
                          note={
                            group(monthly, "category_id")[0]
                              ? money(group(monthly, "category_id")[0][1])
                              : "No expenses yet"
                          }
                        />
                        <Stat
                          label="Highest-spending day"
                          value={
                            group(monthly, "date")[0]
                              ? dateTitle(group(monthly, "date")[0][0])
                              : "—"
                          }
                          note={
                            group(monthly, "date")[0]
                              ? money(group(monthly, "date")[0][1])
                              : "No expenses yet"
                          }
                        />
                      </div>
                      <div className="comparison">
                        <strong>
                          {cmp.percent === null
                            ? "No percentage comparison (previous period ₹0)"
                            : `${Math.abs(cmp.percent).toFixed(1)}% ${cmp.percent >= 0 ? "more" : "less"} than previous period`}
                        </strong>
                        <span>
                          {money(cmp.a)} vs {money(cmp.b)} · {cmp.label}
                        </span>
                      </div>
                      <div className="dashboard-grid">
                        <section className="panel">
                          <h2>Daily spending</h2>
                          <p className="small muted">
                            Select a day to see its expenses
                          </p>
                          <Chart
                            entries={Array.from(
                              { length: daysInMonth(month) },
                              (_, i) => {
                                const d =
                                  month + "-" + String(i + 1).padStart(2, "0");
                                return {
                                  key: d,
                                  label: String(i + 1),
                                  value: total(
                                    monthly.filter((e) => e.date === d),
                                  ),
                                };
                              },
                            )}
                            onSelect={openDay}
                          />
                        </section>
                        <section className="panel">
                          <h2>Category breakdown</h2>
                          <Breakdown
                            items={monthly}
                            categories={data.categories}
                          />
                        </section>
                      </div>
                      <section className="panel">
                        <h2>Month’s expenses</h2>
                        <FiltersView
                          value={filters}
                          onChange={setFilters}
                          categories={data.categories}
                        />
                        <div className="section-title">
                          <p>
                            {filtered.length} matches · {money(total(filtered))}
                          </p>
                          <button
                            className="secondary"
                            onClick={() =>
                              download(
                                `expenses-${month}.csv`,
                                csv(filtered, data.categories),
                                "text/csv",
                              )
                            }
                          >
                            <Download size={17} /> Export CSV
                          </button>
                        </div>
                        {list(filtered)}
                      </section>
                    </>
                  )}
                  {period === "Yearly" && /^\d{4}$/.test(year) && (
                    <>
                      <div className="stats three">
                        <Stat
                          label="Annual spending"
                          value={money(total(yearly))}
                          note={year}
                        />
                        <Stat
                          label="Average monthly spending"
                          value={money(avg.value)}
                          note={`Across ${avg.count} ${year === now.slice(0, 4) ? "elapsed calendar" : "calendar"} months${year === now.slice(0, 4) ? ", including this partial month" : ""}`}
                        />
                        <Stat
                          label="Highest-spending month"
                          value={(() => {
                            const top = Array.from({ length: 12 }, (_, i) => ({
                              m: year + "-" + String(i + 1).padStart(2, "0"),
                              v: total(
                                inMonth(
                                  yearly,
                                  year + "-" + String(i + 1).padStart(2, "0"),
                                ),
                              ),
                            })).sort((a, b) => b.v - a.v)[0];
                            return top.v ? monthTitle(top.m) : "—";
                          })()}
                          note="Based on saved expenses"
                        />
                      </div>
                      <div className="dashboard-grid">
                        <section className="panel">
                          <h2>Month by month</h2>
                          <p className="small muted">
                            Select a month to explore it
                          </p>
                          <Chart
                            entries={Array.from({ length: 12 }, (_, i) => {
                              const m =
                                year + "-" + String(i + 1).padStart(2, "0");
                              return {
                                key: m,
                                label: new Date(m + "-02").toLocaleString(
                                  "en-IN",
                                  { month: "short", timeZone: "UTC" },
                                ),
                                value: total(inMonth(yearly, m)),
                              };
                            })}
                            onSelect={openMonth}
                            showValues
                          />
                        </section>
                        <section className="panel">
                          <h2>Annual categories</h2>
                          <Breakdown
                            items={yearly}
                            categories={data.categories}
                          />
                        </section>
                      </div>
                    </>
                  )}
                </>
              )}
              {tab === "Budgets" && (
                <>
                  <div className="report-controls">
                    <Field label="Budget month">
                      <input
                        type="month"
                        value={month}
                        min="1900-01"
                        onChange={(e) => {
                          if (validDate(e.target.value + "-01"))
                            setMonth(e.target.value);
                        }}
                      />
                    </Field>
                    <p className="muted">
                      Each month has its own budget. Earlier months stay
                      unchanged.
                    </p>
                  </div>
                  <div className="budget-grid">
                    {[null, ...data.categories.filter((c) => !c.archived)].map(
                      (c) => (
                        <BudgetCard
                          key={month + (c?.id || "overall")}
                          category={c}
                          budget={data.budgets.find(
                            (b) =>
                              b.month === month + "-01" &&
                              b.category_id === (c?.id || null),
                          )}
                          spent={total(
                            monthly.filter((e) => !c || e.category_id === c.id),
                          )}
                          busy={busy}
                          save={async (amount) =>
                            mutate(async () => {
                              if (demo)
                                setData((d) => ({
                                  ...d,
                                  budgets: [
                                    ...d.budgets.filter(
                                      (b) =>
                                        !(
                                          b.month === month + "-01" &&
                                          b.category_id === (c?.id || null)
                                        ),
                                    ),
                                    ...(amount
                                      ? [
                                          {
                                            id: crypto.randomUUID(),
                                            month: month + "-01",
                                            category_id: c?.id || null,
                                            amount_paise: amount,
                                          },
                                        ]
                                      : []),
                                  ],
                                }));
                              else
                                await rpc("set_budget", {
                                  budget_month: month + "-01",
                                  category: c?.id || null,
                                  amount,
                                });
                            })
                          }
                        />
                      ),
                    )}
                  </div>
                </>
              )}
              {tab === "Settings" && (
                <div className="settings-grid">
                  <section className="panel">
                    <h2>Categories</h2>
                    <p className="muted small">
                      Rename or archive categories. Existing expenses keep their
                      category.
                    </p>
                    <Categories
                      categories={data.categories}
                      busy={busy}
                      save={async (id, name, archived) =>
                        mutate(async () => {
                          if (demo) {
                            if (
                              data.categories.some(
                                (c) =>
                                  c.id !== id &&
                                  c.name.toLowerCase() === name.toLowerCase(),
                              )
                            )
                              throw Error("Category name already exists.");
                            setData((d) => ({
                              ...d,
                              categories: id
                                ? d.categories.map((c) =>
                                    c.id === id ? { ...c, name, archived } : c,
                                  )
                                : [
                                    ...d.categories,
                                    {
                                      id: crypto.randomUUID(),
                                      name,
                                      archived: false,
                                    },
                                  ],
                            }));
                          } else {
                            const result = id
                              ? await db!
                                  .from("categories")
                                  .update({ name, archived })
                                  .eq("id", id)
                              : await db!
                                  .from("categories")
                                  .insert({ name, user_id: user!.id });
                            if (result.error) throw result.error;
                          }
                        })
                      }
                    />
                  </section>
                  <div>
                    <section className="panel">
                      <h2>Your data, with you</h2>
                      <p className="muted">
                        Download a complete backup of expenses, categories, and
                        budgets.
                      </p>
                      <button
                        className="secondary full"
                        onClick={() =>
                          download(
                            `everyday-backup-${now}.json`,
                            JSON.stringify(
                              {
                                schema_version: 1,
                                exported_at: new Date().toISOString(),
                                ...data,
                              },
                              null,
                              2,
                            ),
                            "application/json",
                          )
                        }
                      >
                        <Download size={18} /> Export JSON backup
                      </button>
                      <div className="divider" />
                      <Field label="Import JSON backup">
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            try {
                              if (file.size > 20 * 1024 * 1024)
                                throw Error(
                                  "Choose a backup smaller than 20 MB.",
                                );
                              setBackup(
                                validateBackup(JSON.parse(await file.text())),
                              );
                              setError("");
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        />
                      </Field>
                      <p className="small muted">
                        Review before importing. Duplicates are skipped;
                        existing records are never overwritten.
                      </p>
                    </section>
                    <section className="panel">
                      <h2>Account</h2>
                      <p className="muted">
                        {demo ? "Demo account" : user?.email}
                      </p>
                      <button
                        className="secondary full"
                        onClick={() =>
                          void leave().catch((e) => setError(e.message))
                        }
                      >
                        {demo ? "Exit demo" : "Sign out"}
                      </button>
                    </section>
                    <section className="panel">
                      <h2>Preferences</h2>
                      <div className="setting-row">
                        <span>Appearance</span>
                        <button className="secondary" onClick={toggle}>
                          {theme === "light"
                            ? "Use dark theme"
                            : "Use light theme"}
                        </button>
                      </div>
                      <div className="setting-row">
                        <span>Currency</span>
                        <strong>Indian rupee (₹)</strong>
                      </div>
                      <div className="setting-row">
                        <span>Timezone</span>
                        <strong>Asia/Kolkata</strong>
                      </div>
                    </section>
                    <section className="panel accounting">
                      <h2>Count a purchase once</h2>
                      <p>
                        Record individual credit-card purchases. Don’t add the
                        bill payment again. Transfers between your own accounts
                        aren’t expenses.
                      </p>
                    </section>
                  </div>
                </div>
              )}
            </>
          )}
          <footer>
            everyday<span>Small entries. A clearer picture.</span>
          </footer>
        </div>
      </main>
      {editing && (
        <ExpenseForm
          item={editing}
          categories={data.categories}
          save={saveExpense}
          onClose={() => setEditing(null)}
          busy={busy}
        />
      )}
      {deleting && (
        <Modal
          title="Delete this expense?"
          onClose={() => setDeleting(null)}
          busy={busy}
        >
          <p>
            {deleting.description} ·{" "}
            <strong>{money(deleting.amount_paise)}</strong>
          </p>
          <p className="muted">
            It will be removed from your totals on all devices.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void mutate(async () => {
                  if (demo)
                    setData((d) => ({
                      ...d,
                      expenses: d.expenses.filter((e) => e.id !== deleting.id),
                    }));
                  else
                    await rpc("delete_expense", {
                      expense_id: deleting.id,
                      expected_version: deleting.version,
                    });
                })
                  .then(() => setDeleting(null))
                  .catch(() => {})
              }
            >
              {busy ? "Deleting…" : "Delete expense"}
            </button>
          </div>
        </Modal>
      )}
      {backup && (
        <ImportModal
          backup={backup}
          existing={data}
          busy={busy}
          onClose={() => setBackup(null)}
          apply={async () => {
            await mutate(async () => {
              if (demo) {
                const mapping = new Map(
                  backup.categories.map((c) => [
                    c.id,
                    data.categories.find(
                      (x) => x.name.toLowerCase() === c.name.toLowerCase(),
                    )?.id || c.id,
                  ]),
                );
                const newCategories = backup.categories.filter(
                  (c) =>
                    !data.categories.some((x) => x.id === mapping.get(c.id)),
                );
                const incoming = importPreview(backup, data).expenses.map(
                  (e) => ({
                    ...e,
                    category_id: mapping.get(e.category_id)!,
                    version: 1,
                  }),
                );
                const budgets = backup.budgets
                  .map((b) => ({
                    ...b,
                    category_id: b.category_id
                      ? mapping.get(b.category_id)!
                      : null,
                  }))
                  .filter(
                    (b) =>
                      !data.budgets.some(
                        (x) =>
                          x.month === b.month &&
                          x.category_id === b.category_id,
                      ),
                  );
                setData((d) => ({
                  expenses: [...incoming, ...d.expenses],
                  categories: [...d.categories, ...newCategories],
                  budgets: [...d.budgets, ...budgets],
                }));
              } else {
                const { data: result, error } = await db!.rpc("import_backup", {
                  payload: { schema_version: 1, ...backup },
                });
                if (error) throw error;
                setStatus(
                  `Imported ${result.added} expenses; skipped ${result.skipped}; added ${result.budgets_added} budgets.`,
                );
              }
            });
            setBackup(null);
          }}
        />
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  featured = false,
}: {
  label: string;
  value: string;
  note: string;
  featured?: boolean;
}) {
  return (
    <div className={"stat " + (featured ? "featured" : "")}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Breakdown({
  items,
  categories,
}: {
  items: Expense[];
  categories: Category[];
}) {
  const t = total(items);
  if (!t)
    return (
      <div className="empty">
        <Wallet />
        <p>No spending yet.</p>
        <span>Add an expense to see the breakdown.</span>
      </div>
    );
  return (
    <div className="breakdown">
      {group(items, "category_id").map(([id, amount], i) => (
        <div key={id}>
          <div className="breakdown-label">
            <span>
              <i style={{ background: colors[i % colors.length] }} />
              {categories.find((c) => c.id === id)?.name}
            </span>
            <strong>{money(amount)}</strong>
          </div>
          <div className="track">
            <span
              style={{
                width: (amount / t) * 100 + "%",
                background: colors[i % colors.length],
              }}
            />
          </div>
          <small className="muted">
            {((amount / t) * 100).toFixed(1)}% of spending
          </small>
        </div>
      ))}
    </div>
  );
}
function Chart({
  entries,
  onSelect,
  showValues = false,
}: {
  entries: { key: string; label: string; value: number }[];
  onSelect: (key: string) => void;
  showValues?: boolean;
}) {
  const max = Math.max(...entries.map((e) => e.value), 1);
  return (
    <>
      <div className="chart-caption">
        <span>{money(max === 1 ? 0 : max)}</span>
        <span>Tap a bar for details</span>
      </div>
      <div className="chart" aria-label="Spending chart">
        {entries.map((e) => (
          <button
            key={e.key}
            aria-label={`${e.key}: ${money(e.value)}`}
            title={`${e.key}: ${money(e.value)}`}
            onClick={() => onSelect(e.key)}
          >
            <span className="bar-space">
              <span
                className="bar"
                style={{
                  height:
                    Math.max((e.value / max) * 100, e.value ? 2 : 0) + "%",
                }}
              />
            </span>
            <span className="bar-label">{e.label}</span>
          </button>
        ))}
      </div>
      {showValues && (
        <div className="month-totals">
          {entries.map((e) => (
            <button key={e.key} onClick={() => onSelect(e.key)}>
              <span>{e.label}</span>
              <strong>{money(e.value)}</strong>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
function ExpenseList({
  items,
  categories,
  onEdit,
  onDelete,
  onDay,
  limit,
}: {
  items: Expense[];
  categories: Category[];
  onEdit: (e: Expense) => void;
  onDelete: (e: Expense) => void;
  onDay: (d: string) => void;
  limit?: number;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [items]);
  const shown = [...items]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit || page * 40);
  if (!items.length)
    return (
      <div className="empty">
        <ReceiptText />
        <h3>No expenses here yet</h3>
        <p>Add your first expense, or adjust your filters.</p>
      </div>
    );
  return (
    <>
      <div className="expense-list">
        <div className="list-head">
          <span>Expense</span>
          <span>Date / payment</span>
          <span>Amount</span>
          <span>Actions</span>
        </div>
        {shown.map((e) => (
          <div className="expense-row" key={e.id}>
            <div className="expense-info">
              <span
                className="expense-icon"
                style={{
                  background:
                    colors[
                      Math.max(
                        0,
                        categories.findIndex((c) => c.id === e.category_id),
                      ) % colors.length
                    ] + "20",
                }}
              >
                <ReceiptText size={19} />
              </span>
              <div>
                <strong>{e.description}</strong>
                <small>
                  {categories.find((c) => c.id === e.category_id)?.name}
                  {e.merchant ? " · " + e.merchant : ""}
                </small>
                {e.notes && <small className="expense-notes">{e.notes}</small>}
              </div>
            </div>
            <div className="expense-date">
              <button onClick={() => onDay(e.date)}>{dateTitle(e.date)}</button>
              <small>{e.payment_method}</small>
            </div>
            <strong className="amount">{money(e.amount_paise)}</strong>
            <div className="row-actions">
              <button
                aria-label={`Edit ${e.description}`}
                onClick={() => onEdit(e)}
              >
                <Pencil size={17} />
              </button>
              <button
                aria-label={`Delete ${e.description}`}
                onClick={() => onDelete(e)}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {!limit && shown.length < items.length && (
        <button
          className="secondary full"
          onClick={() => setPage((p) => p + 1)}
        >
          Show more ({items.length - shown.length} remaining)
        </button>
      )}
    </>
  );
}
function FiltersView({
  value: v,
  onChange,
  categories,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  categories: Category[];
}) {
  const set = (key: keyof Filters, s: string) => onChange({ ...v, [key]: s });
  return (
    <div className="filters">
      <Field label="Search expenses">
        <div className="search-field">
          <Search size={17} />
          <input
            type="search"
            placeholder="Description, merchant, notes…"
            value={v.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </div>
      </Field>
      <Field label="Category">
        <select
          value={v.category}
          onChange={(e) => set("category", e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Payment method">
        <select
          value={v.method}
          onChange={(e) => set("method", e.target.value)}
        >
          <option value="">All methods</option>
          {methods.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </Field>
      <details>
        <summary>More filters</summary>
        <div className="filter-extra">
          <Field label="From date">
            <input
              type="date"
              value={v.from}
              onChange={(e) => set("from", e.target.value)}
            />
          </Field>
          <Field label="To date">
            <input
              type="date"
              value={v.to}
              onChange={(e) => set("to", e.target.value)}
            />
          </Field>
          <Field label="Minimum ₹">
            <input
              type="number"
              min="0"
              step="0.01"
              value={v.min}
              onChange={(e) => set("min", e.target.value)}
            />
          </Field>
          <Field label="Maximum ₹">
            <input
              type="number"
              min="0"
              step="0.01"
              value={v.max}
              onChange={(e) => set("max", e.target.value)}
            />
          </Field>
        </div>
      </details>
      <button className="text-button" onClick={() => onChange(emptyFilters)}>
        Clear filters
      </button>
    </div>
  );
}
function ExpenseForm({
  item,
  categories,
  save,
  onClose,
  busy,
}: {
  item: Expense;
  categories: Category[];
  save: (e: Expense) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(item),
    [amount, setAmount] = useState(
      item.amount_paise ? (item.amount_paise / 100).toFixed(2) : "",
    ),
    [error, setError] = useState("");
  const submitted = useRef(false);
  const set = (k: keyof Expense, v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitted.current) return;
    submitted.current = true;
    setError("");
    try {
      if (!validDate(draft.date)) throw Error("Choose a valid calendar date.");
      if (!draft.description.trim())
        throw Error("Enter a description or item name.");
      if (!draft.category_id) throw Error("Choose a category.");
      await save({
        ...draft,
        description: draft.description.trim(),
        merchant: draft.merchant.trim(),
        notes: draft.notes.trim(),
        amount_paise: paise(amount),
      });
    } catch (e) {
      setError(
        (e as Error).message + " Your input is still here. You can retry.",
      );
    } finally {
      submitted.current = false;
    }
  }
  return (
    <Modal
      title={item.version ? "Edit expense" : "Add expense"}
      onClose={() => {
        if (confirm("Discard unsaved changes?")) onClose();
      }}
      busy={busy}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <Field label="Amount (₹)">
              <input
                autoFocus
                required
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Date">
              <input
                required
                type="date"
                min="1900-01-01"
                max="9999-12-31"
                value={draft.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Category">
              <select
                required
                value={draft.category_id}
                onChange={(e) => set("category_id", e.target.value)}
              >
                {categories
                  .filter((c) => !c.archived || c.id === draft.category_id)
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Payment method">
              <select
                value={draft.payment_method}
                onChange={(e) => set("payment_method", e.target.value)}
              >
                {methods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description / item name">
            <input
              required
              maxLength={200}
              placeholder="What did you spend on?"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <Field label="Merchant (optional)">
            <input
              maxLength={120}
              value={draft.merchant}
              onChange={(e) => set("merchant", e.target.value)}
            />
          </Field>
          <Field label="Notes (optional)">
            <textarea
              rows={2}
              maxLength={2000}
              value={draft.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
          <p className="small muted">
            Record purchases only. Don’t add account transfers or credit-card
            repayments for purchases already recorded.
          </p>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              if (confirm("Discard unsaved changes?")) onClose();
            }}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : error ? "Retry save" : "Save expense"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function BudgetCard({
  category,
  budget,
  spent,
  busy,
  save,
}: {
  category: Category | null;
  budget?: Budget;
  spent: number;
  busy: boolean;
  save: (amount: number | null) => Promise<void>;
}) {
  const [amount, setAmount] = useState(
      budget ? (budget.amount_paise / 100).toFixed(2) : "",
    ),
    [error, setError] = useState("");
  useEffect(() => {
    setAmount(budget ? (budget.amount_paise / 100).toFixed(2) : "");
  }, [budget?.amount_paise]);
  const pct = budget ? (spent / budget.amount_paise) * 100 : 0;
  return (
    <section className={"panel budget " + (!category ? "overall" : "")}>
      <h2>{category?.name || "Overall monthly budget"}</h2>
      <strong className="budget-spent">
        {money(spent)} <small>spent</small>
      </strong>
      {budget ? (
        <>
          <div className={"track " + (pct > 100 ? "over" : "")}>
            <span style={{ width: Math.min(pct, 100) + "%" }} />
          </div>
          <div className={"budget-detail " + (pct > 100 ? "over-text" : "")}>
            <span>{pct.toFixed(1)}% used</span>
            <strong>
              {money(Math.abs(budget.amount_paise - spent))}{" "}
              {pct > 100 ? "over budget" : "remaining"}
            </strong>
          </div>
        </>
      ) : (
        <p className="small muted">No budget set for this month</p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          let n;
          try {
            n = amount.trim() ? paise(amount) : null;
          } catch (e) {
            setError((e as Error).message);
            return;
          }
          void save(n).catch((e) => setError(e.message));
        }}
      >
        <Field label={`${category?.name || "Overall"} budget (₹)`}>
          <input
            inputMode="decimal"
            placeholder="Optional"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <button disabled={busy} className="secondary">
          {amount.trim() ? "Save budget" : "Remove budget"}
        </button>
        <p className="small muted">Leave blank to remove.</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
function Categories({
  categories,
  busy,
  save,
}: {
  categories: Category[];
  busy: boolean;
  save: (id: string | null, name: string, archived: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null),
    [name, setName] = useState(""),
    [error, setError] = useState("");
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          void save(
            editing,
            name.trim(),
            categories.find((c) => c.id === editing)?.archived || false,
          )
            .then(() => {
              setName("");
              setEditing(null);
            })
            .catch((e) => setError(e.message));
        }}
      >
        <Field label={editing ? "Rename category" : "New category"}>
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="flex gap-2">
          <button className="primary" disabled={busy}>
            {editing ? "Save name" : "Add category"}
          </button>
          {editing && (
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setEditing(null);
                setName("");
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="category-list">
        {categories.map((c) => (
          <div key={c.id}>
            <span>
              {c.name}
              {c.archived && <small> · Archived</small>}
            </span>
            <div>
              <button
                aria-label={`Rename ${c.name}`}
                onClick={() => {
                  setEditing(c.id);
                  setName(c.name);
                }}
              >
                <Pencil size={17} />
              </button>
              <button
                className="small"
                disabled={busy}
                onClick={() =>
                  void save(c.id, c.name, !c.archived).catch((e) =>
                    setError(e.message),
                  )
                }
              >
                {c.archived ? "Restore" : "Archive"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
function ImportModal({
  backup,
  existing,
  busy,
  onClose,
  apply,
}: {
  backup: Data;
  existing: Data;
  busy: boolean;
  onClose: () => void;
  apply: () => Promise<void>;
}) {
  const p = importPreview(backup, existing);
  const [error, setError] = useState("");
  return (
    <Modal title="Review your backup" onClose={onClose} busy={busy}>
      <p>
        <strong>{p.expenses.length}</strong> potentially new expenses ·{" "}
        <strong>{p.skipped}</strong> duplicates skipped
      </p>
      <p>
        {backup.categories.length} categories · {backup.budgets.length} budgets
        in this file.
      </p>
      <p className="muted">
        Matching category names are reused. Existing monthly budgets are kept.
        The database rechecks duplicates during import, including previously
        deleted records, so final counts can be lower.
      </p>
      <div className="import-preview">
        {p.expenses.slice(0, 20).map((e) => (
          <div key={e.id}>
            <span>
              {e.date} · {e.description}
            </span>
            <strong>{money(e.amount_paise)}</strong>
          </div>
        ))}
      </div>
      {p.expenses.length > 20 && (
        <p className="small">Showing the first 20 expenses.</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void apply().catch((e) => setError(e.message))}
        >
          {busy ? "Importing…" : "Confirm import"}
        </button>
      </div>
    </Modal>
  );
}
