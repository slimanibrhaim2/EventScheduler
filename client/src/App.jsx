import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";
import { AuthLoadingScreen, LoginScreen, PendingScreen } from "./AuthScreens";
import UsersPage from "./UsersPage";
import {
  FLEET_COUNTRIES,
  FLEET_COMMON_ISPS,
  buildFleetUsernameClient,
  fleetBaseUsername,
  isFleetProxy,
  normalizeFleetHost,
  parseFleetProxyLine,
  parseFleetUsername,
  regionsForCountry,
} from "./fleetLocations";

const THEME_KEY = "es-theme";

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

let confirmAsk = null;

function confirmAction(message, options = {}) {
  if (!confirmAsk) return Promise.resolve(window.confirm(message));
  return confirmAsk(message, options);
}

function ConfirmModalHost() {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    confirmAsk = (message, options = {}) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialog({
          message,
          title: options.title || "Please confirm",
          confirmLabel: options.confirmLabel || "Confirm",
          cancelLabel: options.cancelLabel || "Cancel",
          danger: Boolean(options.danger),
        });
      });
    return () => {
      confirmAsk = null;
    };
  }, []);

  const close = (value) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setDialog(null);
    resolve?.(value);
  };

  if (!dialog) return null;

  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{dialog.title}</h3>
        <p>{dialog.message}</p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => close(false)}>
            {dialog.cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${dialog.danger ? "btn-danger" : "primary"}`}
            onClick={() => close(true)}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { to: "/games", label: "Games" },
  { to: "/jobs", label: "Jobs" },
  { to: "/jobs/scheduled", label: "Scheduled" },
  { to: "/jobs/finished", label: "Finished" },
  { to: "/proxies", label: "Proxies" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" },
  { to: "/users", label: "Users", adminOnly: true },
];

function batchNameFromFile(fileName) {
  return String(fileName || "").replace(/\.[^.]+$/, "").trim();
}

function accountNameTaken(jobs, accountName) {
  const wanted = String(accountName || "").trim().toLowerCase();
  if (!wanted) return false;
  return jobs.some((job) => String(job.name || "").split(" · ")[0].trim().toLowerCase() === wanted);
}

function accountNameHint(fromFile) {
  return fromFile
    ? "This account/batch name is already used. Rename the file and drop it again, or edit the name field below."
    : "This account/batch name is already used. Edit the name field to something unique.";
}

function shortEndpoint(url) {
  try {
    const path = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return path || "/";
  } catch {
    const parts = String(url || "").split("/").filter(Boolean);
    return parts[parts.length - 1] || url || "—";
  }
}

function DateTimeCell({ value }) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return (
    <div className="datetime-cell">
      <div>{date.toLocaleDateString()}</div>
      <div className="sub">{date.toLocaleTimeString()}</div>
    </div>
  );
}

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function matchesDateFilter(value, filter) {
  if (!filter || filter === "all") return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = startOfLocalDay();
  const point = date.getTime();

  if (filter === "today") {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return point >= today.getTime() && point < end.getTime();
  }
  if (filter === "yesterday") {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    return point >= start.getTime() && point < today.getTime();
  }
  if (filter === "7d") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return point >= start.getTime();
  }
  return true;
}

function formatDelay({ delay_days = 0, delay_hours = 0, delay_minutes = 0 }) {
  const parts = [];
  if (delay_days) parts.push(`${delay_days} day${delay_days === 1 ? "" : "s"}`);
  if (delay_hours) parts.push(`${delay_hours} hour${delay_hours === 1 ? "" : "s"}`);
  if (delay_minutes) parts.push(`${delay_minutes} minute${delay_minutes === 1 ? "" : "s"}`);
  if (parts.length === 0) return "immediately (when request is added)";
  if (parts.length === 1) return `after ${parts[0]}`;
  if (parts.length === 2) return `after ${parts[0]} and ${parts[1]}`;
  return `after ${parts[0]}, ${parts[1]}, and ${parts[2]}`;
}

function defaultStepDelay(index) {
  return {
    checked: true,
    delay_days: index,
    delay_hours: 0,
    delay_minutes: 0,
    time_value: "",
  };
}

/** Cumulative time_spent: each day adds dailyBudget seconds, split across events that day. */
function applyTimeSpent(selected, orderedVariableIds, dailyBudget = 30000) {
  const checked = orderedVariableIds
    .map((id) => ({ id, ...(selected[id] || {}) }))
    .filter((step) => step.checked);

  const byDay = new Map();
  for (const step of checked) {
    const day = Number(step.delay_days) || 0;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(step.id);
  }

  const next = { ...selected };
  let last = 0;
  const days = [...byDay.keys()].sort((a, b) => a - b);
  for (const day of days) {
    const ids = byDay.get(day);
    const increment = Number(dailyBudget) / ids.length;
    for (const id of ids) {
      last += increment;
      next[id] = {
        ...next[id],
        time_value: String(Math.round(last)),
      };
    }
  }
  return next;
}

export default function App() {
  const { loading, firebaseUser, isApproved, isAdmin, appUser, logout } = useAuth();
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [proxies, setProxies] = useState([]);
  const [games, setGames] = useState([]);
  const [plans, setPlans] = useState([]);
  const [settings, setSettings] = useState({
    timezone: "local",
    default_run_time: "10:00",
    daily_time_spent: "30000",
    time_spent_noise: "300",
    fleet_host: "residential-v2.fleetproxy.io",
    fleet_port: "5000",
    fleet_user: "",
    fleet_pass: "",
    fleet_protocol: "http",
  });
  const [theme, setTheme] = useState(() => getPreferredTheme());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [j, p, g, pl, s] = await Promise.all([
      api.jobs(),
      api.proxies(),
      api.games(),
      api.plans(),
      api.settings(),
    ]);
    setJobs(j);
    setProxies(p);
    setGames(g);
    setPlans(pl);
    setSettings(s);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!isApproved) return undefined;
    load().catch((err) => setError(err.message));
    return undefined;
  }, [isApproved]);

  const toggleTheme = (event) => {
    const next = theme === "dark" ? "light" : "dark";
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? 24;
    document.documentElement.style.setProperty("--theme-x", `${x}px`);
    document.documentElement.style.setProperty("--theme-y", `${y}px`);

    const swap = () => setTheme(next);
    if (document.startViewTransition) {
      document.startViewTransition(swap);
    } else {
      swap();
    }
  };

  // Keep jobs/status fresh without a full page reload.
  useEffect(() => {
    if (!isApproved) return undefined;
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      load().catch(() => {});
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [isApproved]);

  useEffect(() => {
    setError("");
    setMessage("");
  }, [location.pathname]);

  if (loading) return <AuthLoadingScreen />;
  if (!firebaseUser) return <LoginScreen />;
  if (!appUser) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>Account sync failed</h2>
          <p className="error">Could not verify your account with the server.</p>
          <p className="sub">
            Make sure the API is running with Firebase Admin configured, then sign in again.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-danger" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!isApproved) return <PendingScreen />;

  const flash = { setError, setMessage };
  const navItems = NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="app-shell">
      <ConfirmModalHost />
      <header className="topbar">
        <Link to="/games" className="brand">
          <span className="brand-mark">ES</span>
          <div>
            <strong>Event Scheduler</strong>
            <div className="sub">Schedule requests with games, plans, and proxies</div>
          </div>
        </Link>
        <nav className="topnav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/jobs"}
              className={({ isActive }) => (isActive ? "active" : undefined)}
            >
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            className="btn theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to day mode" : "Switch to night mode"}
            aria-label="Toggle theme"
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              {theme === "dark" ? "☀" : "☾"}
            </span>
          </button>
          <button
            type="button"
            className="btn nav-refresh"
            onClick={() => load().catch((err) => setError(err.message))}
          >
            Refresh
          </button>
          <div className="user-chip" title={appUser?.email || ""}>
            <div className="user-chip-text">
              <strong>{appUser?.display_name || "Account"}</strong>
              <span className="sub">{appUser?.email}</span>
            </div>
            <button type="button" className="btn" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </nav>
      </header>

      {(error || message) && (
        <div className="flash-stack">
          {error && <p className="banner error">{error}</p>}
          {message && <p className="banner ok">{message}</p>}
        </div>
      )}

      <main className="page">
        <Routes>
          <Route path="/" element={<Navigate to="/games" replace />} />
          <Route
            path="/games"
            element={
              <GamesPage
                games={games}
                plans={plans}
                settings={settings}
                onRefresh={load}
                {...flash}
              />
            }
          />
          <Route
            path="/games/new"
            element={<GameFormPage games={games} onRefresh={load} {...flash} />}
          />
          <Route
            path="/games/:id/edit"
            element={<GameFormPage games={games} onRefresh={load} {...flash} />}
          />
          <Route
            path="/jobs"
            element={
              <JobsPage
                jobs={jobs}
                proxies={proxies}
                games={games}
                plans={plans}
                settings={settings}
                onRefresh={load}
                {...flash}
              />
            }
          />
          <Route
            path="/jobs/scheduled"
            element={<ScheduledJobsPage jobs={jobs} onRefresh={load} {...flash} />}
          />
          <Route
            path="/jobs/finished"
            element={<FinishedAccountsPage onRefresh={load} {...flash} />}
          />
          <Route
            path="/proxies"
            element={<ProxiesPage proxies={proxies} settings={settings} onRefresh={load} {...flash} />}
          />
          <Route path="/history" element={<HistoryPage games={games} />} />
          <Route
            path="/settings"
            element={<SettingsPage settings={settings} onRefresh={load} {...flash} />}
          />
          <Route path="/users" element={<UsersPage {...flash} />} />
          <Route path="*" element={<Navigate to="/games" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function GamesPage({ games, plans, settings, onRefresh, setError, setMessage }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dailyBudget = Number(settings?.daily_time_spent) || 30000;
  const [mode, setMode] = useState("list");
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [planGameId, setPlanGameId] = useState("");
  const [planName, setPlanName] = useState("");
  const [selected, setSelected] = useState({});
  const [openPlan, setOpenPlan] = useState(null);
  const [expandedGameId, setExpandedGameId] = useState(null);

  const selectedGame = useMemo(
    () => games.find((g) => String(g.id) === String(planGameId)),
    [games, planGameId]
  );

  const plansByGame = useMemo(() => {
    const map = {};
    for (const plan of plans) {
      if (!map[plan.game_id]) map[plan.game_id] = [];
      map[plan.game_id].push(plan);
    }
    return map;
  }, [plans]);

  const goList = () => {
    setMode("list");
    setEditingPlanId(null);
    setPlanGameId("");
    setPlanName("");
    setSelected({});
    setOpenPlan(null);
  };

  const startCreatePlan = (game) => {
    setEditingPlanId(null);
    setPlanGameId(String(game.id));
    setPlanName(`${game.name} Plan`);
    let next = {};
    game.variables.forEach((variable, index) => {
      next[variable.id] = defaultStepDelay(index);
    });
    next = applyTimeSpent(
      next,
      game.variables.map((variable) => variable.id),
      dailyBudget
    );
    setSelected(next);
    setOpenPlan(null);
    setMode("plan");
  };

  const startEditPlan = async (plan) => {
    setError("");
    try {
      const full = await api.getPlan(plan.id);
      const game = games.find((item) => item.id === full.game_id);
      if (!game) {
        setError("Game for this plan was not found");
        return;
      }
      setEditingPlanId(full.id);
      setPlanGameId(String(full.game_id));
      setPlanName(full.name);
      const next = {};
      game.variables.forEach((variable, index) => {
        const step = full.steps.find((item) => item.variable_id === variable.id);
        if (step) {
          next[variable.id] = {
            checked: true,
            delay_days: step.delay_days,
            delay_hours: step.delay_hours,
            delay_minutes: step.delay_minutes,
            time_value: step.time_value || "",
          };
        } else {
          next[variable.id] = { ...defaultStepDelay(index), checked: false };
        }
      });
      setSelected(next);
      setOpenPlan(null);
      setMode("plan");
      setExpandedGameId(full.game_id);
      setMessage(`Editing plan ${full.name}`);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const newPlanGameId = searchParams.get("newPlan");
    if (!newPlanGameId || games.length === 0) return;
    const game = games.find((item) => String(item.id) === String(newPlanGameId));
    if (!game) return;
    startCreatePlan(game);
    setSearchParams({}, { replace: true });
  }, [games, searchParams]);

  const regenerateTimeSpent = (current = selected) => {
    if (!selectedGame) return current;
    return applyTimeSpent(
      current,
      selectedGame.variables.map((variable) => variable.id),
      dailyBudget
    );
  };

  const updateStep = (variableId, patch) => {
    setSelected((prev) => {
      const merged = {
        ...prev,
        [variableId]: { ...(prev[variableId] || defaultStepDelay(0)), checked: true, ...patch },
      };
      return regenerateTimeSpent(merged);
    });
  };

  const deleteGame = async (game) => {
    if (
      !(await confirmAction(`Delete game "${game.name}"? Plans that use it will be removed too.`, {
        title: "Delete game",
        confirmLabel: "Delete",
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await api.deleteGame(game.id);
      setMessage(`Deleted ${game.name}`);
      await onRefresh();
      goList();
    } catch (err) {
      setError(err.message);
    }
  };

  const savePlan = async (event) => {
    event.preventDefault();
    setError("");
    if (!selectedGame) {
      setError("Select a game first");
      return;
    }
    const steps = selectedGame.variables
      .filter((variable) => selected[variable.id]?.checked)
      .map((variable, index) => ({
        variable_id: variable.id,
        delay_days: Number(selected[variable.id]?.delay_days) || 0,
        delay_hours: Number(selected[variable.id]?.delay_hours) || 0,
        delay_minutes: Number(selected[variable.id]?.delay_minutes) || 0,
        time_value: selected[variable.id]?.time_value || "",
        sort_order: index,
      }));
    try {
      if (editingPlanId) {
        await api.updatePlan(editingPlanId, { name: planName, steps });
        setMessage("Plan updated.");
      } else {
        await api.createPlan({
          game_id: selectedGame.id,
          name: planName,
          steps,
        });
        setMessage("Plan saved. Delays start from the moment you add a request.");
      }
      await onRefresh();
      goList();
    } catch (err) {
      setError(err.message);
    }
  };

  const viewPlan = async (id) => {
    try {
      setOpenPlan(await api.getPlan(id));
      setMode("plan-view");
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePlan = async (plan) => {
    if (
      !(await confirmAction(`Delete plan "${plan.name}"?`, {
        title: "Delete plan",
        confirmLabel: "Delete",
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await api.deletePlan(plan.id);
      if (openPlan?.id === plan.id) setOpenPlan(null);
      setMessage(`Deleted plan ${plan.name}`);
      await onRefresh();
      if (mode === "plan-view") goList();
    } catch (err) {
      setError(err.message);
    }
  };

  if (mode === "plan" && selectedGame) {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>
              {editingPlanId ? "Edit plan" : "Create plan"} · {selectedGame.name}
            </h2>
            <p className="sub">
              Delays are relative. time_spent is auto-built: each day adds {dailyBudget} seconds, split if several
              events share that day, then added to the previous value.
            </p>
          </div>
          <button className="btn" type="button" onClick={goList}>
            Back to games
          </button>
        </div>
        <form className="panel-body" onSubmit={savePlan}>
          <label>Plan name</label>
          <input value={planName} onChange={(e) => setPlanName(e.target.value)} required />
          <div className="actions tight">
            <button
              type="button"
              className="btn"
              onClick={() => setSelected((prev) => regenerateTimeSpent(prev))}
            >
              Recalculate time_spent
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Use</th>
                <th>Level</th>
                <th>Token / value</th>
                <th>time_spent (sec)</th>
                <th>Delay from request add</th>
              </tr>
            </thead>
            <tbody>
              {selectedGame.variables.map((variable) => {
                const step = selected[variable.id] || defaultStepDelay(0);
                return (
                  <tr key={variable.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!step.checked}
                        onChange={(e) => {
                          setSelected((prev) =>
                            regenerateTimeSpent({
                              ...prev,
                              [variable.id]: { ...step, checked: e.target.checked },
                            })
                          );
                        }}
                      />
                    </td>
                    <td>{variable.name}</td>
                    <td>
                      <code>{variable.value}</code>
                    </td>
                    <td>
                      <input
                        className="time-value-input"
                        value={step.time_value || ""}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [variable.id]: { ...step, time_value: e.target.value },
                          }))
                        }
                        placeholder="auto"
                      />
                    </td>
                    <td>
                      <div className="delay-inputs">
                        <label className="delay-field">
                          <input
                            type="number"
                            min="0"
                            value={step.delay_days}
                            onChange={(e) => updateStep(variable.id, { delay_days: e.target.value })}
                          />
                          <span>days</span>
                        </label>
                        <label className="delay-field">
                          <input
                            type="number"
                            min="0"
                            value={step.delay_hours}
                            onChange={(e) => updateStep(variable.id, { delay_hours: e.target.value })}
                          />
                          <span>hours</span>
                        </label>
                        <label className="delay-field">
                          <input
                            type="number"
                            min="0"
                            value={step.delay_minutes}
                            onChange={(e) => updateStep(variable.id, { delay_minutes: e.target.value })}
                          />
                          <span>minutes</span>
                        </label>
                      </div>
                      <div className="sub delay-preview">{formatDelay(step)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="actions">
            <button className="btn primary" type="submit">
              {editingPlanId ? "Update plan" : "Save plan"}
            </button>
          </div>
        </form>
      </section>
    );
  }

  if (mode === "plan-view" && openPlan) {
    return (
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>
              {openPlan.name} · {openPlan.game_name}
            </h2>
            <p className="sub">These delays start when a request using this plan is added.</p>
          </div>
          <div className="actions tight">
            <button className="btn" type="button" onClick={() => startEditPlan(openPlan)}>
              Edit plan
            </button>
            <button className="btn danger" type="button" onClick={() => deletePlan(openPlan)}>
              Delete plan
            </button>
            <button className="btn" type="button" onClick={goList}>
              Back to games
            </button>
          </div>
        </div>
        <div className="panel-body">
              <table>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Token / value</th>
                    <th>time_spent</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {openPlan.steps.map((step) => (
                    <tr key={step.id}>
                      <td>{step.variable_name}</td>
                      <td>
                        <code>{step.variable_value}</code>
                      </td>
                      <td>{step.time_value || "—"}</td>
                      <td>{formatDelay(step)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Games</h2>
          <p className="sub">Open a game to edit it, or create a reusable plan with relative delays.</p>
        </div>
        <Link className="btn primary" to="/games/new">
          Add game
        </Link>
      </div>

      <div className="panel-body">
        {games.length === 0 && (
          <div className="empty">
            <p>No games yet.</p>
            <Link className="btn primary" to="/games/new">
              Add your first game
            </Link>
          </div>
        )}

        <div className="game-list">
          {games.map((game) => {
            const gamePlans = plansByGame[game.id] || [];
            const expanded = expandedGameId === game.id;
            return (
              <article key={game.id} className="game-item">
                <div className="game-item-main">
                  <button
                    type="button"
                    className="game-title"
                    onClick={() => setExpandedGameId(expanded ? null : game.id)}
                  >
                    <strong>{game.name}</strong>
                    <span className="sub">
                      {game.variables.length} variable{game.variables.length === 1 ? "" : "s"} · {gamePlans.length} plan
                      {gamePlans.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  <div className="actions tight">
                    <button className="btn" type="button" onClick={() => navigate(`/games/${game.id}/edit`)}>
                      Edit
                    </button>
                    <button className="btn" type="button" onClick={() => startCreatePlan(game)}>
                      Create plan
                    </button>
                    <button className="btn danger" type="button" onClick={() => deleteGame(game)}>
                      Delete
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="game-item-detail">
                    <h3>Variables</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {game.variables.map((variable) => (
                          <tr key={variable.id}>
                            <td>{variable.name}</td>
                            <td>
                              <code>{variable.value}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <h3>Plans</h3>
                    {gamePlans.length === 0 ? (
                      <p className="sub">No plans for this game yet.</p>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            <th>Plan</th>
                            <th>Steps</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {gamePlans.map((plan) => (
                            <tr key={plan.id}>
                              <td>{plan.name}</td>
                              <td>{plan.step_count}</td>
                              <td>
                                <button className="btn" type="button" onClick={() => viewPlan(plan.id)}>
                                  View
                                </button>
                                <button className="btn" type="button" onClick={() => startEditPlan(plan)}>
                                  Edit
                                </button>
                                <button className="btn danger" type="button" onClick={() => deletePlan(plan)}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function GameFormPage({ games, onRefresh, setError, setMessage }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const editingId = id ? Number(id) : null;
  const existing = games.find((game) => game.id === editingId);
  const emptyVariables = [{ name: "Level 30", value: "" }];
  const [gameName, setGameName] = useState(existing?.name || "");
  const [variables, setVariables] = useState(
    existing
      ? existing.variables.map((variable) => ({
          id: variable.id,
          name: variable.name,
          value: variable.value,
        }))
      : emptyVariables
  );

  useEffect(() => {
    if (!editingId) {
      setGameName("");
      setVariables(emptyVariables);
      return;
    }
    if (!existing) return;
    setGameName(existing.name);
    setVariables(
      existing.variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        value: variable.value,
      }))
    );
  }, [editingId, existing]);

  const addVariable = () => {
    setVariables((prev) => [...prev, { name: `Level ${prev.length + 1}`, value: "" }]);
  };

  const updateVariable = (index, key, value) => {
    setVariables((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const removeVariable = async (index) => {
    if (variables.length === 1) return;
    if (
      !(await confirmAction("Remove this variable from the game?", {
        title: "Remove variable",
        confirmLabel: "Remove",
        danger: true,
      }))
    ) {
      return;
    }
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const saveGame = async (event) => {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        await api.updateGame(editingId, { name: gameName, variables });
        setMessage("Game updated.");
      } else {
        await api.createGame({ name: gameName, variables });
        setMessage("Game saved.");
      }
      await onRefresh();
      navigate("/games");
    } catch (err) {
      setError(err.message);
    }
  };

  if (editingId && !existing) {
    return (
      <section className="panel">
        <div className="panel-body">
          <p className="sub">Game not found.</p>
          <Link className="btn" to="/games">
            Back to games
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{editingId ? "Edit game" : "Add game"}</h2>
          <p className="sub">Name the game, then add variables (level name + value).</p>
        </div>
        <Link className="btn" to="/games">
          Back to games
        </Link>
      </div>
      <form className="panel-body" onSubmit={saveGame}>
        <label>Game name</label>
        <input value={gameName} onChange={(e) => setGameName(e.target.value)} required placeholder="Game-1" />
        <label>Levels</label>
        {variables.map((variable, index) => (
          <div className="delay-row" key={variable.id || `new-${index}`}>
            <input
              value={variable.name}
              onChange={(e) => updateVariable(index, "name", e.target.value)}
              placeholder="Level 30"
              required
            />
            <input
              value={variable.value}
              onChange={(e) => updateVariable(index, "value", e.target.value)}
              placeholder="variable value / token"
              required
            />
            <button type="button" className="btn danger" onClick={() => removeVariable(index)}>
              Remove
            </button>
          </div>
        ))}
        <div className="actions">
          <button type="button" className="btn" onClick={addVariable}>
            Add level
          </button>
          <button className="btn primary" type="submit">
            {editingId ? "Update game" : "Save game"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SettingsPage({ settings, onRefresh, setError, setMessage }) {
  const { appUser, logout, isAdmin } = useAuth();
  const [form, setForm] = useState(settings);
  const [pasteLine, setPasteLine] = useState("");
  const [showPass, setShowPass] = useState(false);
  const dirtyRef = useRef(false);

  useEffect(() => {
    // Auto-refresh must not wipe fields while the user is editing.
    if (dirtyRef.current) return;
    setForm(settings);
  }, [settings]);

  const patchForm = (patch) => {
    dirtyRef.current = true;
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        fleet_host: normalizeFleetHost(form.fleet_host),
        fleet_user: fleetBaseUsername(form.fleet_user),
        fleet_port: String(form.fleet_port || "5000"),
        fleet_pass: String(form.fleet_pass || ""),
        fleet_protocol: form.fleet_protocol || "http",
      };
      const saved = await api.saveSettings(payload);
      dirtyRef.current = false;
      setForm(saved);
      setMessage("Settings saved.");
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const applyPasteLine = async () => {
    const parsed = parseFleetProxyLine(pasteLine);
    if (!parsed) {
      setError("Paste a FleetProxy line like residential-v2.fleetproxy.io:5000:user:pass");
      return;
    }
    const next = {
      ...form,
      fleet_host: parsed.host,
      fleet_port: String(parsed.port),
      fleet_user: parsed.user,
      fleet_pass: parsed.pass,
      fleet_protocol: form.fleet_protocol || "http",
    };
    dirtyRef.current = true;
    setForm(next);
    setError("");
    try {
      const saved = await api.saveSettings(next);
      dirtyRef.current = false;
      setForm(saved);
      setPasteLine("");
      setMessage(
        `FleetProxy saved. Host ${parsed.host}, user ${parsed.user}. Pick country/state later on New job.`
      );
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel settings-card settings-wide">
      <div className="panel-head">
        <div>
          <h2>Settings</h2>
          <p className="sub">Plan timing, noise, and FleetProxy credentials used for every account.</p>
        </div>
      </div>
      <div className="panel-body settings-account">
        <h3 className="settings-section-title">Account</h3>
        <div className="settings-account-row">
          <div>
            <div className="sub">Signed in as</div>
            <strong>{appUser?.email || "—"}</strong>
            <div className="sub">
              {appUser?.display_name ? `${appUser.display_name} · ` : ""}
              {isAdmin ? "admin" : "user"} · {appUser?.status || "—"}
            </div>
          </div>
          <button type="button" className="btn btn-danger" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </div>
      <form className="panel-body" onSubmit={save}>
        <label>Timezone label</label>
        <input
          value={form.timezone || ""}
          onChange={(e) => patchForm({ timezone: e.target.value })}
          placeholder="local"
        />
        <label>Daily time_spent budget (seconds)</label>
        <input
          type="number"
          min="1"
          value={form.daily_time_spent || "30000"}
          onChange={(e) => patchForm({ daily_time_spent: e.target.value })}
        />
        <p className="sub">
          Each plan day adds this many seconds. If a day has multiple events, that amount is divided between them, then
          added to the previous time_spent.
        </p>
        <label>time_spent noise (± seconds)</label>
        <input
          type="number"
          min="0"
          value={form.time_spent_noise || "300"}
          onChange={(e) => patchForm({ time_spent_noise: e.target.value })}
        />
        <p className="sub">Each scheduled request gets a random offset in this range so time_spent is not identical every run.</p>

        <h3 className="settings-section-title">FleetProxy</h3>
        <div className="fleet-help">
          <p className="sub">
            From your screenshot, copy <strong>one full generated line</strong> (not only the short username):
          </p>
          <pre className="fleet-example">
            residential-v2.fleetproxy.io:5000:r_97ff38e1a1-country-US-region-alabama:567ca5a56b
          </pre>
          <p className="sub">
            Use host <code>residential-v2.fleetproxy.io</code> (not <code>v2.fleetproxy.io</code>). We store only the
            base user <code>r_97ff38e1a1</code> + password. Country/state/city are chosen later on New job and added to
            the username when sending.
          </p>
        </div>
        <label>Paste generated proxy line</label>
        <div className="plan-picker">
          <input
            value={pasteLine}
            onChange={(e) => setPasteLine(e.target.value)}
            placeholder="residential-v2.fleetproxy.io:5000:r_xxxx-country-US-region-alabama:password"
          />
          <button type="button" className="btn primary" onClick={applyPasteLine}>
            Apply & save
          </button>
        </div>
        <div className="row">
          <div>
            <label>Host</label>
            <input
              value={form.fleet_host || ""}
              onChange={(e) => patchForm({ fleet_host: e.target.value })}
              placeholder="residential-v2.fleetproxy.io"
            />
          </div>
          <div>
            <label>Port</label>
            <input
              value={form.fleet_port || ""}
              onChange={(e) => patchForm({ fleet_port: e.target.value })}
              placeholder="5000"
            />
          </div>
        </div>
        <label>Username (base only)</label>
        <input
          value={form.fleet_user || ""}
          onChange={(e) => patchForm({ fleet_user: e.target.value })}
          placeholder="r_97ff38e1a1"
        />
        <label>Password</label>
        <div className="plan-picker">
          <input
            type={showPass ? "text" : "password"}
            value={form.fleet_pass || ""}
            onChange={(e) => patchForm({ fleet_pass: e.target.value })}
            placeholder="proxy password"
            autoComplete="new-password"
          />
          <button type="button" className="btn" onClick={() => setShowPass((v) => !v)}>
            {showPass ? "Hide" : "Show"}
          </button>
        </div>
        <label>Protocol</label>
        <select
          value={form.fleet_protocol || "http"}
          onChange={(e) => patchForm({ fleet_protocol: e.target.value })}
        >
          <option value="http">http / https</option>
          <option value="socks5">socks5</option>
        </select>

        <div className="actions">
          <button className="btn primary" type="submit">
            Save settings
          </button>
        </div>
      </form>
    </section>
  );
}

function InlinePlanCreator({ game, settings, onCancel, onCreated, setError, setMessage }) {
  const dailyBudget = Number(settings?.daily_time_spent) || 30000;
  const [planName, setPlanName] = useState(`${game.name} Plan`);
  const [selected, setSelected] = useState(() => {
    let next = {};
    game.variables.forEach((variable, index) => {
      next[variable.id] = defaultStepDelay(index);
    });
    return applyTimeSpent(
      next,
      game.variables.map((variable) => variable.id),
      dailyBudget
    );
  });

  const regenerateTimeSpent = (current) =>
    applyTimeSpent(
      current,
      game.variables.map((variable) => variable.id),
      dailyBudget
    );

  const updateStep = (variableId, patch) => {
    setSelected((prev) => {
      const merged = {
        ...prev,
        [variableId]: { ...(prev[variableId] || defaultStepDelay(0)), checked: true, ...patch },
      };
      return regenerateTimeSpent(merged);
    });
  };

  const savePlan = async () => {
    setError("");
    if (!planName.trim()) {
      setError("Plan name is required");
      return;
    }
    const steps = game.variables
      .filter((variable) => selected[variable.id]?.checked)
      .map((variable, index) => ({
        variable_id: variable.id,
        delay_days: Number(selected[variable.id]?.delay_days) || 0,
        delay_hours: Number(selected[variable.id]?.delay_hours) || 0,
        delay_minutes: Number(selected[variable.id]?.delay_minutes) || 0,
        time_value: selected[variable.id]?.time_value || "",
        sort_order: index,
      }));
    try {
      const created = await api.createPlan({
        game_id: game.id,
        name: planName,
        steps,
      });
      setMessage(`Plan "${created.name}" created.`);
      onCreated(created);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="preview-box inline-plan">
      <div className="request-block-head">
        <strong>New plan · {game.name}</strong>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <div>
        <label>Plan name</label>
        <input value={planName} onChange={(e) => setPlanName(e.target.value)} required />
        <div className="actions tight">
          <button type="button" className="btn" onClick={() => setSelected((prev) => regenerateTimeSpent(prev))}>
            Recalculate time_spent
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Use</th>
              <th>Level</th>
              <th>Token</th>
              <th>time_spent</th>
              <th>Delay</th>
            </tr>
          </thead>
          <tbody>
            {game.variables.map((variable) => {
              const step = selected[variable.id] || defaultStepDelay(0);
              return (
                <tr key={variable.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!step.checked}
                      onChange={(e) =>
                        setSelected((prev) =>
                          regenerateTimeSpent({
                            ...prev,
                            [variable.id]: { ...step, checked: e.target.checked },
                          })
                        )
                      }
                    />
                  </td>
                  <td>{variable.name}</td>
                  <td>
                    <code>{variable.value}</code>
                  </td>
                  <td>
                    <input
                      className="time-value-input"
                      value={step.time_value || ""}
                      onChange={(e) =>
                        setSelected((prev) => ({
                          ...prev,
                          [variable.id]: { ...step, time_value: e.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <div className="delay-inputs">
                      <label className="delay-field">
                        <input
                          type="number"
                          min="0"
                          value={step.delay_days}
                          onChange={(e) => updateStep(variable.id, { delay_days: e.target.value })}
                        />
                        <span>days</span>
                      </label>
                      <label className="delay-field">
                        <input
                          type="number"
                          min="0"
                          value={step.delay_hours}
                          onChange={(e) => updateStep(variable.id, { delay_hours: e.target.value })}
                        />
                        <span>hours</span>
                      </label>
                      <label className="delay-field">
                        <input
                          type="number"
                          min="0"
                          value={step.delay_minutes}
                          onChange={(e) => updateStep(variable.id, { delay_minutes: e.target.value })}
                        />
                        <span>minutes</span>
                      </label>
                    </div>
                    <div className="sub delay-preview">{formatDelay(step)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="actions">
          <button className="btn primary" type="button" onClick={savePlan}>
            Save plan
          </button>
        </div>
      </div>
    </div>
  );
}

function JobsPage({ jobs, proxies, games, plans, settings, onRefresh, setError, setMessage }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [gameId, setGameId] = useState("");
  const [planId, setPlanId] = useState("");
  const [proxyMode, setProxyMode] = useState("fleet");
  const [proxyId, setProxyId] = useState("");
  const [fleetCountry, setFleetCountry] = useState("US");
  const [fleetState, setFleetState] = useState("");
  const [fleetCity, setFleetCity] = useState("");
  const [fleetIsp, setFleetIsp] = useState("");
  const [fleetRotation, setFleetRotation] = useState("random");
  const [proxyCheck, setProxyCheck] = useState(null);
  const [checkingProxy, setCheckingProxy] = useState(false);
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [requestExpanded, setRequestExpanded] = useState(false);
  const [planPreview, setPlanPreview] = useState(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [nameError, setNameError] = useState("");

  const fleetConfigured = Boolean(settings?.fleet_user && settings?.fleet_pass);
  const countryRegions = useMemo(() => regionsForCountry(fleetCountry), [fleetCountry]);
  const regionCities = useMemo(() => {
    const match = countryRegions.find((item) => item.state === fleetState);
    return match?.cities || [];
  }, [fleetState, countryRegions]);
  const stateOptions = useMemo(
    () => countryRegions.map((region) => ({ value: region.state, label: region.state })),
    [countryRegions]
  );
  const cityOptions = useMemo(
    () => regionCities.map((city) => ({ value: city, label: city })),
    [regionCities]
  );
  const ispOptions = useMemo(
    () => FLEET_COMMON_ISPS.map((isp) => ({ value: isp, label: isp })),
    []
  );

  const selectedGame = useMemo(
    () => games.find((game) => String(game.id) === String(gameId)),
    [games, gameId]
  );

  const gamePlans = useMemo(
    () => plans.filter((plan) => String(plan.game_id) === String(gameId)),
    [plans, gameId]
  );

  const onPickGame = (id) => {
    setGameId(id);
    setPlanId("");
    setPlanPreview(null);
    setCreatingPlan(false);
  };

  const validateAccountName = (value, fromDroppedFile = Boolean(fileName)) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      setNameError("");
      return true;
    }
    if (accountNameTaken(jobs, trimmed)) {
      const hint = accountNameHint(fromDroppedFile);
      setNameError(hint);
      setError(hint);
      return false;
    }
    setNameError("");
    setError("");
    return true;
  };

  const loadTextFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const batch = batchNameFromFile(file.name);
    setRaw(text);
    setFileName(file.name);
    setName(batch);
    setRequestExpanded(false);
    if (accountNameTaken(jobs, batch)) {
      const hint = accountNameHint(true);
      setNameError(hint);
      setError(hint);
      setMessage("");
    } else {
      setNameError("");
      setError("");
      setMessage(`Loaded ${file.name}. Batch name set to ${batch}`);
    }
  };

  const viewSelectedPlan = async () => {
    if (!planId) {
      setError("Select a plan first");
      return;
    }
    setError("");
    setCreatingPlan(false);
    try {
      setPlanPreview(await api.getPlan(planId));
    } catch (err) {
      setError(err.message);
    }
  };

  const onFile = async (event) => {
    await loadTextFile(event.target.files?.[0]);
  };

  const onDrop = async (event) => {
    event.preventDefault();
    setDragging(false);
    await loadTextFile(event.dataTransfer.files?.[0]);
  };

  const resetProxyCheck = () => setProxyCheck(null);

  const checkSelectedProxy = async () => {
    setError("");
    setMessage("");
    setCheckingProxy(true);
    setProxyCheck(null);
    try {
      let result;
      if (proxyMode === "fleet") {
        if (!fleetConfigured) {
          throw new Error("Configure FleetProxy in Settings first.");
        }
        if (!fleetCountry) {
          throw new Error("Select a country before checking the proxy.");
        }
        result = await api.testProxy({
          fleet: {
            country: fleetCountry,
            state: fleetState,
            city: fleetCity,
            isp: fleetIsp,
            rotation: fleetRotation,
          },
        });
      } else if (proxyMode === "saved") {
        if (!proxyId) throw new Error("Select a saved proxy first.");
        result = await api.testProxy({ proxy_id: Number(proxyId) });
      } else {
        throw new Error("Direct mode does not use a proxy.");
      }
      setProxyCheck(result);
      if (result.ok) {
        setMessage(`Proxy OK · IP ${result.ip || "unknown"} · ${result.ms}ms`);
      } else {
        setError(result.error || "Proxy check failed");
      }
    } catch (err) {
      setProxyCheck({ ok: false, error: err.message });
      setError(err.message);
    } finally {
      setCheckingProxy(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!gameId || !planId || !raw.trim()) {
      setError("Choose a game, a plan, and a request file or paste");
      return;
    }
    if (!name.trim()) {
      setError("Batch / account name is required");
      setNameError("Batch / account name is required");
      return;
    }
    if (!validateAccountName(name, Boolean(fileName))) {
      return;
    }
    if (proxyMode === "fleet") {
      if (!fleetConfigured) {
        setError("Configure FleetProxy username/password in Settings first (paste a generator line).");
        return;
      }
      if (!fleetCountry) {
        setError("Select a FleetProxy country.");
        return;
      }
      if (!proxyCheck?.ok) {
        setError("Check the FleetProxy first. Schedule is blocked until the proxy test succeeds.");
        return;
      }
    }
    if (proxyMode === "saved") {
      if (!proxyId) {
        setError("Select a saved proxy, or switch to Direct / FleetProxy.");
        return;
      }
      if (!proxyCheck?.ok) {
        setError("Check the saved proxy first. Schedule is blocked until the proxy test succeeds.");
        return;
      }
    }
    try {
      const result = await api.createJobsFromPlan({
        name: name.trim(),
        game_id: Number(gameId),
        plan_id: Number(planId),
        proxy_id: proxyMode === "saved" ? proxyId || null : null,
        fleet:
          proxyMode === "fleet"
            ? {
                use_fleet: true,
                country: fleetCountry,
                state: fleetState,
                city: fleetCity,
                isp: fleetIsp,
                rotation: fleetRotation,
              }
            : undefined,
        raw,
      });
      setMessage(`Scheduled ${result.count} jobs from the plan.`);
      setName("");
      setNameError("");
      setRaw("");
      setFileName("");
      setPlanPreview(null);
      setCreatingPlan(false);
      setRequestExpanded(false);
      await onRefresh();
      navigate("/jobs/scheduled");
    } catch (err) {
      setError(err.message);
      if (/already exists/i.test(err.message)) {
        setNameError(accountNameHint(Boolean(fileName)));
      }
    }
  };

  const fromFile = Boolean(fileName);
  const requestReady = Boolean(raw.trim());
  const nameTaken = accountNameTaken(jobs, name);

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head">
        <div>
          <h2>New job</h2>
          <p className="sub">
            Upload one request file. Path is rewritten to /session or /event. Every event is preceded by a session
            with a random 30s–60s gap. If same-day events are more than 20 minutes apart, a new session is sent before
            the next event. time_spent gets small random noise.
          </p>
        </div>
        <Link className="btn" to="/jobs/scheduled">
          View scheduled
        </Link>
      </div>
      <div className="panel-body">
        <label>Request file (.txt)</label>
        <label
          className={`dropzone ${dragging ? "dragging" : ""} ${fileName ? "has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept=".txt,text/plain" onChange={onFile} hidden />
          <strong>{fileName ? fileName : "Drop request .txt here"}</strong>
          <span className="sub">
            {fileName ? "Click or drop another file to replace it" : "or click to choose a file"}
          </span>
        </label>

        <label>Batch / account name {fromFile ? "(from file)" : "(required)"}</label>
        <input
          className={nameError || nameTaken ? "input-error" : ""}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            validateAccountName(e.target.value, fromFile);
          }}
          placeholder="account-1"
          required
        />
        {(nameError || nameTaken) && (
          <p className="field-error">
            {nameError || accountNameHint(fromFile)}
          </p>
        )}

        <div className="request-block">
          <div className="request-block-head">
            <label>{fromFile ? "Request content" : "Paste request"}</label>
            <button
              type="button"
              className="btn"
              onClick={() => setRequestExpanded((open) => !open)}
            >
              {requestExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
          {!requestExpanded ? (
            <div className="request-collapsed sub">
              {requestReady
                ? fromFile
                  ? "File loaded. Press Expand to read the request."
                  : "Request text ready. Press Expand to edit or read it."
                : "Press Expand to paste a request, or drop a .txt file above."}
            </div>
          ) : fromFile ? (
            <pre className="request-preview">{raw || "(empty)"}</pre>
          ) : (
            <textarea
              className="request-paste"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                if (!e.target.value.trim()) setFileName("");
              }}
              placeholder={"POST /event HTTP/1.1\nHost: example.com\nContent-Type: application/x-www-form-urlencoded\n\nevent_token=PLACEHOLDER&time_spent=PLACEHOLDER"}
            />
          )}
        </div>

        <label>Game</label>
        <select value={gameId} onChange={(e) => onPickGame(e.target.value)} required>
          <option value="">Select a game</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.name}
            </option>
          ))}
        </select>

        <label>Plan</label>
        <div className="plan-picker">
          <select
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              setPlanPreview(null);
              setCreatingPlan(false);
            }}
            required={!creatingPlan}
            disabled={!gameId || creatingPlan}
          >
            <option value="">{gameId ? "Select a plan" : "Select a game first"}</option>
            {gamePlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} ({plan.step_count} steps)
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={viewSelectedPlan} disabled={!planId || creatingPlan}>
            View
          </button>
          <button
            type="button"
            className="btn"
            disabled={!gameId}
            onClick={() => {
              setPlanPreview(null);
              setCreatingPlan(true);
            }}
          >
            New plan
          </button>
        </div>
        {gameId && gamePlans.length === 0 && !creatingPlan && (
          <p className="sub">No plans for this game yet. Click New plan.</p>
        )}

        {creatingPlan && selectedGame && (
          <InlinePlanCreator
            game={selectedGame}
            settings={settings}
            setError={setError}
            setMessage={setMessage}
            onCancel={() => setCreatingPlan(false)}
            onCreated={async (created) => {
              await onRefresh();
              setPlanId(String(created.id));
              setCreatingPlan(false);
              setPlanPreview(created);
            }}
          />
        )}

        {planPreview && !creatingPlan && (
          <div className="preview-box">
            <div className="request-block-head">
              <strong>
                {planPreview.name} · {planPreview.game_name}
              </strong>
              <button type="button" className="btn" onClick={() => setPlanPreview(null)}>
                Close
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Token</th>
                  <th>time_spent</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {planPreview.steps.map((step) => (
                  <tr key={step.id}>
                    <td>{step.variable_name}</td>
                    <td>
                      <code>{step.variable_value}</code>
                    </td>
                    <td>{step.time_value || "—"}</td>
                    <td>{formatDelay(step)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <label>Proxy</label>
        <div className="proxy-mode-row">
          <button
            type="button"
            className={`btn ${proxyMode === "fleet" ? "primary" : ""}`}
            onClick={() => {
              setProxyMode("fleet");
              resetProxyCheck();
            }}
          >
            FleetProxy
          </button>
          <button
            type="button"
            className={`btn ${proxyMode === "saved" ? "primary" : ""}`}
            onClick={() => {
              setProxyMode("saved");
              resetProxyCheck();
            }}
          >
            Saved proxy
          </button>
          <button
            type="button"
            className={`btn ${proxyMode === "none" ? "primary" : ""}`}
            onClick={() => {
              setProxyMode("none");
              resetProxyCheck();
            }}
          >
            Direct
          </button>
        </div>

        {proxyMode === "fleet" && (
          <div className="fleet-box">
            {!fleetConfigured && (
              <p className="field-error">
                FleetProxy credentials missing. Open Settings, paste a generator line, and save.
              </p>
            )}
            <p className="sub">
              Same as the FleetProxy Generator: pick location + rotation. Check the proxy before scheduling — schedule is
              blocked until the test succeeds.
            </p>
            <div className="row">
              <div>
                <SearchableSelect
                  label="Country"
                  value={fleetCountry}
                  onChange={(next) => {
                    setFleetCountry(next || "US");
                    setFleetState("");
                    setFleetCity("");
                    resetProxyCheck();
                  }}
                  options={FLEET_COUNTRIES.map((country) => ({
                    value: country.code,
                    label: `${country.name} (${country.code})`,
                  }))}
                  allLabel="Select country"
                  placeholder="Search countries…"
                />
              </div>
              <div>
                <label>Rotation</label>
                <select
                  value={fleetRotation}
                  onChange={(e) => {
                    setFleetRotation(e.target.value);
                    resetProxyCheck();
                  }}
                >
                  <option value="random">Random IP</option>
                  <option value="sticky">Sticky IP</option>
                </select>
              </div>
            </div>
            <div className="row">
              <div>
                <SearchableSelect
                  label="State / region"
                  value={fleetState}
                  onChange={(next) => {
                    setFleetState(next);
                    setFleetCity("");
                    resetProxyCheck();
                  }}
                  options={stateOptions}
                  allLabel="Any / random"
                  placeholder="Search states…"
                />
                {stateOptions.length === 0 && (
                  <input
                    className="fleet-custom-input"
                    value={fleetState}
                    onChange={(e) => {
                      setFleetState(e.target.value);
                      setFleetCity("");
                      resetProxyCheck();
                    }}
                    placeholder="Or type FleetProxy slug, e.g. alabama"
                  />
                )}
              </div>
              <div>
                <SearchableSelect
                  label="City"
                  value={fleetCity}
                  onChange={(next) => {
                    setFleetCity(next);
                    resetProxyCheck();
                  }}
                  options={cityOptions}
                  allLabel="Any / random"
                  placeholder="Search cities…"
                />
                {cityOptions.length === 0 && (
                  <input
                    className="fleet-custom-input"
                    value={fleetCity}
                    onChange={(e) => {
                      setFleetCity(e.target.value);
                      resetProxyCheck();
                    }}
                    placeholder="Or type slug, e.g. birmingham"
                  />
                )}
              </div>
            </div>
            <SearchableSelect
              label="ISP (optional)"
              value={fleetIsp}
              onChange={(next) => {
                setFleetIsp(next);
                resetProxyCheck();
              }}
              options={ispOptions}
              allLabel="Any / random"
              placeholder="Search ISPs…"
            />
            <input
              className="fleet-custom-input"
              value={fleetIsp}
              onChange={(e) => {
                setFleetIsp(e.target.value);
                resetProxyCheck();
              }}
              placeholder="Or type ISP slug from FleetProxy, e.g. comcast"
            />
            <div className="actions tight proxy-check-row">
              <button
                type="button"
                className="btn btn-info"
                disabled={checkingProxy || !fleetConfigured}
                onClick={checkSelectedProxy}
              >
                {checkingProxy ? "Checking…" : "Check proxy"}
              </button>
              {proxyCheck?.ok && (
                <span className="proxy-check-ok">
                  Working · IP {proxyCheck.ip || "unknown"} · {proxyCheck.ms}ms
                </span>
              )}
              {proxyCheck && !proxyCheck.ok && (
                <span className="proxy-check-bad">{proxyCheck.error || "Failed"}</span>
              )}
            </div>
          </div>
        )}

        {proxyMode === "saved" && (
          <div className="fleet-box">
            <select
              value={proxyId}
              onChange={(e) => {
                setProxyId(e.target.value);
                resetProxyCheck();
              }}
            >
              <option value="">Select a saved proxy</option>
              {proxies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.protocol}://{p.host}:{p.port})
                </option>
              ))}
            </select>
            <div className="actions tight proxy-check-row">
              <button
                type="button"
                className="btn btn-info"
                disabled={checkingProxy || !proxyId}
                onClick={checkSelectedProxy}
              >
                {checkingProxy ? "Checking…" : "Check proxy"}
              </button>
              {proxyCheck?.ok && (
                <span className="proxy-check-ok">
                  Working · IP {proxyCheck.ip || "unknown"} · {proxyCheck.ms}ms
                </span>
              )}
              {proxyCheck && !proxyCheck.ok && (
                <span className="proxy-check-bad">{proxyCheck.error || "Failed"}</span>
              )}
            </div>
          </div>
        )}

        <div className="actions">
          <button
            className="btn primary"
            type="submit"
            disabled={
              creatingPlan ||
              nameTaken ||
              ((proxyMode === "fleet" || proxyMode === "saved") && !proxyCheck?.ok)
            }
          >
            Schedule plan jobs
          </button>
        </div>
      </div>
    </form>
  );
}

function jobAccountName(job) {
  return String(job.name || "").split(" · ")[0].trim() || job.name || "—";
}

function jobKind(job) {
  return job.request_kind || shortEndpoint(job.url) || "request";
}

function jobTaskLabel(jobOrRun) {
  const kind = jobOrRun.request_kind || jobKind(jobOrRun);
  if (kind === "session") return "session";
  const fullName = jobOrRun.name || jobOrRun.job_name || "";
  const parts = String(fullName).split(" · ");
  if (parts.length > 1) {
    const task = parts.slice(1).join(" · ").trim();
    if (task && !/^day\s+\d+\s+session/i.test(task)) return task;
  }
  return kind === "event" ? "event" : kind || "—";
}

function SearchableSelect({ label, value, onChange, options, allLabel, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const selectedLabel = useMemo(() => {
    if (!value) return allLabel;
    const match = options.find((opt) => opt.value === value);
    return match ? match.label : value;
  }, [value, options, allLabel]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="search-select" ref={rootRef}>
      <label>{label}</label>
      <button
        type="button"
        className={`search-select-trigger ${open ? "open" : ""}`}
        onClick={() => {
          setOpen((prev) => !prev);
          setQuery("");
        }}
      >
        <span>{selectedLabel}</span>
        <span className="sub">▾</span>
      </button>
      {open && (
        <div className="search-select-menu">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || "Search…"}
          />
          <button
            type="button"
            className={`search-select-option ${!value ? "active" : ""}`}
            onClick={() => {
              onChange("");
              setOpen(false);
              setQuery("");
            }}
          >
            {allLabel}
          </button>
          {filtered.length === 0 && <div className="sub search-select-empty">No matches</div>}
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`search-select-option ${value === opt.value ? "active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                setQuery("");
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduledJobsPage({ jobs, onRefresh, setError, setMessage }) {
  const [showFull, setShowFull] = useState(false);
  const [accountFilter, setAccountFilter] = useState("");
  const [gameFilter, setGameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("today");

  const accountOptions = useMemo(() => {
    const names = new Set(jobs.map(jobAccountName).filter(Boolean));
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));
  }, [jobs]);

  const gameOptions = useMemo(() => {
    const map = new Map();
    for (const job of jobs) {
      if (job.game_id && job.game_name) map.set(String(job.game_id), job.game_name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [jobs]);

  const hasFilters = Boolean(
    accountFilter || gameFilter || statusFilter || kindFilter || (dateFilter && dateFilter !== "all")
  );

  const clearFilters = () => {
    setAccountFilter("");
    setGameFilter("");
    setStatusFilter("");
    setKindFilter("");
    setDateFilter("all");
  };

  const openAccountDetails = (job) => {
    setAccountFilter(jobAccountName(job));
    setGameFilter(job.game_id ? String(job.game_id) : "");
    setStatusFilter("");
    setKindFilter("");
    setShowFull(true);
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (accountFilter && jobAccountName(job) !== accountFilter) return false;
      if (gameFilter && String(job.game_id || "") !== gameFilter) return false;
      if (statusFilter && statusFilter !== "all" && job.status !== statusFilter) return false;
      if (kindFilter && jobKind(job) !== kindFilter) return false;
      if (!matchesDateFilter(job.run_at, dateFilter)) return false;
      return true;
    });
  }, [jobs, accountFilter, gameFilter, statusFilter, kindFilter, dateFilter]);

  const displayedJobs = useMemo(() => {
    if (showFull) {
      // Default: remaining only. "all" or a specific status uses the filtered set as-is.
      const list = filteredJobs.filter((job) => {
        if (statusFilter === "all") return true;
        if (statusFilter) return true;
        return job.status === "pending" || job.status === "running";
      });
      return list.sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
    }

    // Next upcoming job per account (pending/running only).
    const byAccount = new Map();
    for (const job of filteredJobs) {
      if (job.status === "done" || job.status === "failed") continue;
      const key = job.batch_id || jobAccountName(job);
      const current = byAccount.get(key);
      if (!current || new Date(job.run_at) < new Date(current.run_at)) {
        byAccount.set(key, job);
      }
    }
    return [...byAccount.values()].sort((a, b) => new Date(a.run_at) - new Date(b.run_at));
  }, [filteredJobs, showFull, statusFilter]);

  const remainingByAccount = useMemo(() => {
    const counts = new Map();
    for (const job of filteredJobs) {
      if (job.status === "done" || job.status === "failed") continue;
      const key = job.batch_id || jobAccountName(job);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [filteredJobs]);

  const accountDetails = useMemo(() => {
    if (!showFull || !accountFilter) return null;
    const accountJobs = jobs.filter((job) => jobAccountName(job) === accountFilter);
    if (accountJobs.length === 0) return null;
    const earliest = accountJobs.reduce((best, job) => {
      if (!best) return job;
      return new Date(job.created_at) < new Date(best.created_at) ? job : best;
    }, null);
    const sample = earliest || accountJobs[0];
    return {
      account: accountFilter,
      game: sample.game_name || "—",
      plan: sample.plan_name || "manual",
      proxy: sample.proxy_name || "direct",
      addedAt: sample.created_at,
      remaining: accountJobs.filter((j) => j.status === "pending" || j.status === "running").length,
      total: accountJobs.length,
    };
  }, [showFull, accountFilter, jobs]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Scheduled jobs</h2>
          <p className="sub">
            {showFull
              ? "Remaining schedule only (old finished jobs hidden unless you filter status). Auto-refreshes every 5s."
              : "Next job per account. Auto-refreshes every 5s."}
          </p>
        </div>
        <div className="actions tight">
          <button type="button" className="btn" onClick={() => onRefresh().catch((e) => setError(e.message))}>
            Refresh
          </button>
          <button type="button" className="btn" onClick={() => setShowFull((v) => !v)}>
            {showFull ? "Show next only" : "Show full schedule"}
          </button>
          <Link className="btn primary" to="/jobs">
            New job
          </Link>
        </div>
      </div>
      <div className="panel-body">
        <div className="filters">
          <SearchableSelect
            label="Account"
            value={accountFilter}
            onChange={setAccountFilter}
            options={accountOptions}
            allLabel="All accounts"
            placeholder="Search accounts…"
          />
          <SearchableSelect
            label="Game"
            value={gameFilter}
            onChange={setGameFilter}
            options={gameOptions}
            allLabel="All games"
            placeholder="Search games…"
          />
          <div>
            <label>Type</label>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="session">session</option>
              <option value="event">event</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Remaining only</option>
              <option value="all">All statuses</option>
              <option value="pending">pending</option>
              <option value="running">running</option>
              <option value="done">done</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div>
            <label>Date</label>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
              <option value="all">All dates</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="actions tight filter-actions">
            <button type="button" className="btn" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {displayedJobs.length === 0 && <p className="sub">No jobs match these filters.</p>}
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Task</th>
              <th>Run at</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {displayedJobs.map((job) => {
              const finished = job.status === "done" || job.status === "failed";
              const responseText =
                job.last_error || job.last_response_body || job.last_response_preview || "No response saved";
              const kind = jobKind(job);
              const task = jobTaskLabel(job);
              const accountKey = job.batch_id || jobAccountName(job);
              const remaining = remainingByAccount.get(accountKey) || 0;
              const viewingThisAccount = showFull && accountFilter === jobAccountName(job);
              return (
                <tr key={job.id}>
                  <td>
                    <strong>{jobAccountName(job)}</strong>
                    <div className="sub">
                      {job.game_name ? `${job.game_name} · ` : ""}
                      {job.plan_name || "manual"}
                    </div>
                    {!showFull && remaining > 1 && (
                      <div className="sub">{remaining - 1} more remaining</div>
                    )}
                  </td>
                  <td>
                    <span className={`kind-tag kind-${kind}`}>{task}</span>
                  </td>
                  <td>
                    <DateTimeCell value={job.run_at} />
                  </td>
                  <td>
                    <div className="status-cell">
                      <span className={`status ${job.status}`}>{job.status}</span>
                      {finished && (
                        <span className="info-tip" tabIndex={0}>
                          !
                          <span className="info-tip-panel">
                            <strong>Status code:</strong>{" "}
                            {job.last_status_code != null ? job.last_status_code : "n/a"}
                            <br />
                            <strong>Response:</strong>
                            <pre>{responseText}</pre>
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="row-actions">
                      {!viewingThisAccount && (
                        <button type="button" className="btn btn-info" onClick={() => openAccountDetails(job)}>
                          See details
                        </button>
                      )}
                      {!finished && (
                        <button
                          className="btn btn-run"
                          onClick={async () => {
                            if (
                              !(await confirmAction(`Run "${job.name}" now?`, {
                                title: "Run job",
                                confirmLabel: "Run now",
                              }))
                            ) {
                              return;
                            }
                            api.runNow(job.id).then(onRefresh).catch((e) => setError(e.message));
                          }}
                        >
                          Run now
                        </button>
                      )}
                      <button
                        className="btn btn-danger"
                        onClick={async () => {
                          if (
                            !(await confirmAction(`Delete job "${job.name}"?`, {
                              title: "Delete job",
                              confirmLabel: "Delete",
                              danger: true,
                            }))
                          ) {
                            return;
                          }
                          api
                            .deleteJob(job.id)
                            .then(() => {
                              setMessage(`Deleted ${job.name}`);
                              return onRefresh();
                            })
                            .catch((e) => setError(e.message));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {accountDetails && (
          <div className="account-details">
            <h3>{accountDetails.account}</h3>
            <div className="account-details-grid">
              <div>
                <div className="sub">Game / plan</div>
                <div>
                  {accountDetails.game} · {accountDetails.plan}
                </div>
              </div>
              <div>
                <div className="sub">Proxy</div>
                <div>{accountDetails.proxy}</div>
              </div>
              <div>
                <div className="sub">Added</div>
                <DateTimeCell value={accountDetails.addedAt} />
              </div>
              <div>
                <div className="sub">Jobs</div>
                <div>
                  {accountDetails.remaining} remaining · {accountDetails.total} total
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FinishedAccountsPage({ onRefresh, setError, setMessage }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const list = await api.finishedAccounts();
      setAccounts(list);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      loadAccounts({ silent: true });
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Finished accounts</h2>
          <p className="sub">Accounts whose plan jobs are all done or failed. Auto-refreshes every 5s.</p>
        </div>
        <button type="button" className="btn" onClick={() => loadAccounts()}>
          Refresh
        </button>
      </div>
      <div className="panel-body">
        {loading && <p className="sub">Loading…</p>}
        {!loading && accounts.length === 0 && <p className="sub">No finished accounts yet.</p>}
        {!loading && accounts.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Game / plan</th>
                <th>Jobs</th>
                <th>Finished</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.batch_id}>
                  <td>
                    <strong>{account.account_name}</strong>
                  </td>
                  <td>
                    <div>{account.game_name || "—"}</div>
                    <div className="sub">{account.plan_name || "—"}</div>
                  </td>
                  <td>
                    {account.job_count} total
                    <div className="sub">
                      <span className="status done">{account.done_count} ok</span>
                      {account.failed_count > 0 ? (
                        <>
                          {" · "}
                          <span className="status failed">{account.failed_count} failed</span>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <DateTimeCell value={account.finished_at} />
                  </td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn btn-info" to={`/history?account=${encodeURIComponent(account.account_name)}`}>
                        History
                      </Link>
                      <button
                        className="btn btn-danger"
                        onClick={async () => {
                          if (
                            !(await confirmAction(`Delete all jobs for "${account.account_name}"?`, {
                              title: "Delete account jobs",
                              confirmLabel: "Delete",
                              danger: true,
                            }))
                          ) {
                            return;
                          }
                          api
                            .deleteBatch(account.batch_id)
                            .then(() => {
                              setMessage(`Removed finished account ${account.account_name}`);
                              return Promise.all([loadAccounts(), onRefresh()]);
                            })
                            .catch((e) => setError(e.message));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function ProxiesPage({ proxies, settings, onRefresh, setError, setMessage }) {
  const emptyForm = {
    name: "",
    protocol: "http",
    host: "",
    port: "8080",
    username: "",
    password: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editingFleet, setEditingFleet] = useState(false);
  const [fleetCountry, setFleetCountry] = useState("US");
  const [fleetState, setFleetState] = useState("");
  const [fleetCity, setFleetCity] = useState("");
  const [fleetIsp, setFleetIsp] = useState("");
  const [fleetRotation, setFleetRotation] = useState("random");
  const [fleetSession, setFleetSession] = useState("");
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const countryRegions = useMemo(() => regionsForCountry(fleetCountry), [fleetCountry]);
  const regionCities = useMemo(() => {
    const match = countryRegions.find((item) => item.state === fleetState);
    return match?.cities || [];
  }, [fleetState, countryRegions]);
  const stateOptions = useMemo(
    () => countryRegions.map((region) => ({ value: region.state, label: region.state })),
    [countryRegions]
  );
  const cityOptions = useMemo(
    () => regionCities.map((city) => ({ value: city, label: city })),
    [regionCities]
  );
  const ispOptions = useMemo(
    () => FLEET_COMMON_ISPS.map((isp) => ({ value: isp, label: isp })),
    []
  );

  const startEdit = (proxy) => {
    setEditingId(proxy.id);
    const fleet = isFleetProxy(proxy);
    setEditingFleet(fleet);
    setForm({
      name: proxy.name || "",
      protocol: proxy.protocol || "http",
      host: proxy.host || "",
      port: String(proxy.port || "8080"),
      username: proxy.username || "",
      password: proxy.password || "",
    });
    if (fleet) {
      const parsed = parseFleetUsername(proxy.username);
      setFleetCountry(parsed.country || "US");
      setFleetState(parsed.state || "");
      setFleetCity(parsed.city || "");
      setFleetIsp(parsed.isp || "");
      setFleetRotation(parsed.rotation || "random");
      setFleetSession(parsed.session || "");
    } else {
      setFleetCountry("US");
      setFleetState("");
      setFleetCity("");
      setFleetIsp("");
      setFleetRotation("random");
      setFleetSession("");
    }
    setError("");
    setMessage(`Editing ${proxy.name}`);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingFleet(false);
    setForm(emptyForm);
    setFleetCountry("US");
    setFleetState("");
    setFleetCity("");
    setFleetIsp("");
    setFleetRotation("random");
    setFleetSession("");
  };

  const save = async (event) => {
    event.preventDefault();
    setError("");
    try {
      let payload = { ...form, port: Number(form.port) };
      if (editingFleet) {
        const baseUser = fleetBaseUsername(settings?.fleet_user || form.username);
        if (!baseUser) {
          setError("FleetProxy base username missing in Settings.");
          return;
        }
        const username = buildFleetUsernameClient(baseUser, {
          country: fleetCountry,
          state: fleetState,
          city: fleetCity,
          isp: fleetIsp,
          rotation: fleetRotation,
          session: fleetSession,
        });
        const labelParts = [fleetCountry, fleetState, fleetCity, fleetIsp, fleetRotation].filter(Boolean);
        const nameParts = String(form.name || "").split(" · ");
        const accountLabel =
          nameParts.length >= 2 && nameParts[0] === "Fleet" ? nameParts[1] : nameParts[0] || "account";
        payload = {
          ...payload,
          host: normalizeFleetHost(settings?.fleet_host || form.host),
          port: Number(settings?.fleet_port || form.port || 5000),
          protocol: settings?.fleet_protocol || form.protocol || "http",
          username,
          password: settings?.fleet_pass || form.password,
          name: `Fleet · ${accountLabel} · ${labelParts.join(" · ")}`.slice(0, 180),
        };
      }
      if (editingId) {
        await api.updateProxy(editingId, payload);
        setMessage("Proxy updated.");
      } else {
        await api.createProxy(payload);
        setMessage("Proxy saved. Attach it to a job.");
      }
      cancelEdit();
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="grid">
      <form className="panel" onSubmit={save}>
        <div className="panel-head">
          <div>
            <h2>{editingId ? (editingFleet ? "Edit FleetProxy" : "Edit proxy") : "Add proxy"}</h2>
            <p className="sub">
              {editingFleet
                ? "Same location controls as New job. Changing country/state/city rebuilds the FleetProxy username."
                : "HTTP, HTTPS, or SOCKS5. Rotation comes from your provider if the host rotates."}
            </p>
          </div>
        </div>
        <div className="panel-body">
          <label>Name</label>
          <input value={form.name} onChange={(e) => setField("name", e.target.value)} required />

          {editingFleet ? (
            <div className="fleet-box">
              <div className="row">
                <div>
                  <SearchableSelect
                    label="Country"
                    value={fleetCountry}
                    onChange={(next) => {
                      setFleetCountry(next || "US");
                      setFleetState("");
                      setFleetCity("");
                    }}
                    options={FLEET_COUNTRIES.map((country) => ({
                      value: country.code,
                      label: `${country.name} (${country.code})`,
                    }))}
                    allLabel="Select country"
                    placeholder="Search countries…"
                  />
                </div>
                <div>
                  <label>Rotation</label>
                  <select value={fleetRotation} onChange={(e) => setFleetRotation(e.target.value)}>
                    <option value="random">Random IP</option>
                    <option value="sticky">Sticky IP</option>
                  </select>
                </div>
              </div>
              <div className="row">
                <div>
                  <SearchableSelect
                    label="State / region"
                    value={fleetState}
                    onChange={(next) => {
                      setFleetState(next);
                      setFleetCity("");
                    }}
                    options={stateOptions}
                    allLabel="Any / random"
                    placeholder="Search states…"
                  />
                  {stateOptions.length === 0 && (
                    <input
                      className="fleet-custom-input"
                      value={fleetState}
                      onChange={(e) => {
                        setFleetState(e.target.value);
                        setFleetCity("");
                      }}
                      placeholder="Or type slug, e.g. alabama"
                    />
                  )}
                </div>
                <div>
                  <SearchableSelect
                    label="City"
                    value={fleetCity}
                    onChange={setFleetCity}
                    options={cityOptions}
                    allLabel="Any / random"
                    placeholder="Search cities…"
                  />
                  {cityOptions.length === 0 && (
                    <input
                      className="fleet-custom-input"
                      value={fleetCity}
                      onChange={(e) => setFleetCity(e.target.value)}
                      placeholder="Or type slug, e.g. birmingham"
                    />
                  )}
                </div>
              </div>
              <SearchableSelect
                label="ISP (optional)"
                value={fleetIsp}
                onChange={setFleetIsp}
                options={ispOptions}
                allLabel="Any / random"
                placeholder="Search ISPs…"
              />
              <input
                className="fleet-custom-input"
                value={fleetIsp}
                onChange={(e) => setFleetIsp(e.target.value)}
                placeholder="Or type ISP slug, e.g. comcast"
              />
              <p className="sub">
                Username preview:{" "}
                <code>
                  {buildFleetUsernameClient(settings?.fleet_user || form.username, {
                    country: fleetCountry,
                    state: fleetState,
                    city: fleetCity,
                    isp: fleetIsp,
                    rotation: fleetRotation,
                    session: fleetSession,
                  }) || "—"}
                </code>
              </p>
            </div>
          ) : (
            <>
              <div className="row-3">
                <div>
                  <label>Protocol</label>
                  <select value={form.protocol} onChange={(e) => setField("protocol", e.target.value)}>
                    <option value="http">http</option>
                    <option value="https">https</option>
                    <option value="socks5">socks5</option>
                  </select>
                </div>
                <div>
                  <label>Host</label>
                  <input value={form.host} onChange={(e) => setField("host", e.target.value)} required />
                </div>
                <div>
                  <label>Port</label>
                  <input value={form.port} onChange={(e) => setField("port", e.target.value)} required />
                </div>
              </div>
              <div className="row">
                <div>
                  <label>Username (optional)</label>
                  <input value={form.username} onChange={(e) => setField("username", e.target.value)} />
                </div>
                <div>
                  <label>Password (optional)</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="actions">
            <button className="btn primary" type="submit">
              {editingId ? "Update proxy" : "Save proxy"}
            </button>
            {editingId && (
              <button className="btn" type="button" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </form>
      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Saved proxies</h2>
          </div>
        </div>
        <div className="panel-body">
          {proxies.length === 0 && <p className="sub">None yet.</p>}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Endpoint</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {proxies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {isFleetProxy(p) && <div className="sub">FleetProxy</div>}
                  </td>
                  <td>
                    {p.protocol}://{p.host}:{p.port}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="btn btn-info" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={async () => {
                          if (
                            !(await confirmAction(`Delete proxy "${p.name}"?`, {
                              title: "Delete proxy",
                              confirmLabel: "Delete",
                              danger: true,
                            }))
                          ) {
                            return;
                          }
                          api
                            .deleteProxy(p.id)
                            .then(() => {
                              if (editingId === p.id) cancelEdit();
                              return onRefresh();
                            })
                            .catch((e) => setError(e.message));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function HistoryPage({ games }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [runs, setRuns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [gameId, setGameId] = useState("");
  const [account, setAccount] = useState(() => searchParams.get("account") || "");
  const [kindFilter, setKindFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");

  const loadRuns = async () => {
    const [list, accountList] = await Promise.all([
      api.runs({ gameId: gameId || undefined, account: account || undefined }),
      api.runAccounts(),
    ]);
    setRuns(list);
    setAccounts(accountList);
  };

  useEffect(() => {
    const fromQuery = searchParams.get("account") || "";
    if (fromQuery !== account) setAccount(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    loadRuns().catch((err) => setError(err.message));
  }, [gameId, account]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      loadRuns().catch(() => {});
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [gameId, account]);

  const accountOptions = useMemo(
    () => accounts.map((name) => ({ value: name, label: name })),
    [accounts]
  );
  const gameOptions = useMemo(
    () => games.map((game) => ({ value: String(game.id), label: game.name })),
    [games]
  );
  const filteredRuns = useMemo(
    () =>
      runs.filter((run) => {
        if (!matchesDateFilter(run.started_at, dateFilter)) return false;
        if (kindFilter) {
          const kind = run.request_kind || shortEndpoint(run.request_url || run.url) || "";
          if (kind !== kindFilter) return false;
        }
        if (statusFilter === "ok" && !run.ok) return false;
        if (statusFilter === "failed" && run.ok) return false;
        return true;
      }),
    [runs, dateFilter, kindFilter, statusFilter]
  );
  const hasFilters = Boolean(
    gameId || account || kindFilter || statusFilter || (dateFilter && dateFilter !== "all")
  );

  const clearFilters = () => {
    setGameId("");
    setAccount("");
    setKindFilter("");
    setStatusFilter("");
    setDateFilter("all");
    setSearchParams({});
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Run history</h2>
          <p className="sub">Same filters as Scheduled (account, game, type, result, date). Auto-refreshes every 5s.</p>
        </div>
        <button type="button" className="btn" onClick={() => loadRuns().catch((err) => setError(err.message))}>
          Refresh
        </button>
      </div>
      <div className="panel-body">
        {error && <p className="error">{error}</p>}
        <div className="filters">
          <SearchableSelect
            label="Account"
            value={account}
            onChange={(next) => {
              setAccount(next);
              if (next) setSearchParams({ account: next });
              else setSearchParams({});
            }}
            options={accountOptions}
            allLabel="All accounts"
            placeholder="Search accounts…"
          />
          <SearchableSelect
            label="Game"
            value={gameId}
            onChange={setGameId}
            options={gameOptions}
            allLabel="All games"
            placeholder="Search games…"
          />
          <div>
            <label>Type</label>
            <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="session">session</option>
              <option value="event">event</option>
            </select>
          </div>
          <div>
            <label>Result</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All results</option>
              <option value="ok">ok</option>
              <option value="failed">failed</option>
            </select>
          </div>
          <div>
            <label>Date</label>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
              <option value="all">All dates</option>
            </select>
          </div>
        </div>
        {hasFilters && (
          <div className="actions tight filter-actions">
            <button type="button" className="btn" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {filteredRuns.length === 0 && <p className="sub">No runs match these filters.</p>}
        <table className="history-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Task</th>
              <th>Game</th>
              <th>Started</th>
              <th>Result</th>
              <th>Status code</th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => {
              const kind = run.request_kind || shortEndpoint(run.request_url || run.url) || "request";
              const task = jobTaskLabel(run);
              const isOpen = open === run.id;
              const requestHeaders = run.request_headers
                ? JSON.stringify(run.request_headers, null, 2)
                : "";
              const responseHeaders = run.response_headers
                ? JSON.stringify(run.response_headers, null, 2)
                : "";
              return (
                <Fragment key={run.id}>
                  <tr
                    className={`history-row ${isOpen ? "open" : ""}`}
                    onClick={() => setOpen(isOpen ? null : run.id)}
                  >
                    <td>{run.account_name || "—"}</td>
                    <td>
                      <span className={`kind-tag kind-${kind}`}>{task}</span>
                    </td>
                    <td>{run.game_name || "—"}</td>
                    <td>
                      <DateTimeCell value={run.started_at} />
                    </td>
                    <td className="result-cell">
                      <span className={`status ${run.ok ? "done" : "failed"}`}>
                        {run.ok ? "ok" : "failed"}
                      </span>
                    </td>
                    <td>{run.status_code != null ? run.status_code : run.error || "—"}</td>
                  </tr>
                  {isOpen && (
                    <tr className="history-expand-row">
                      <td colSpan={6}>
                        <div className="history-detail inline">
                          <div className="history-detail-head">
                            <div>
                              <h3>
                                {run.job_name} · status {run.status_code != null ? run.status_code : "n/a"}
                              </h3>
                              <div className="sub">
                                {run.game_name || "no game"} · {run.account_name || "no account"}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpen(null);
                              }}
                            >
                              Close
                            </button>
                          </div>
                          {run.error && (
                            <>
                              <h4>Error</h4>
                              <pre>{run.error}</pre>
                            </>
                          )}
                          <h4>Request</h4>
                          <div className="sub">
                            {run.request_method || "?"} {run.request_url || run.url || ""}
                          </div>
                          <pre>{requestHeaders || "No request headers saved"}</pre>
                          <pre className="response-full">{run.request_body || "No request body"}</pre>
                          <h4>Response headers</h4>
                          <pre>{responseHeaders || "No response headers saved"}</pre>
                          <h4>Full response body</h4>
                          <pre className="response-full">
                            {run.response_body || run.response_preview || "No body"}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
