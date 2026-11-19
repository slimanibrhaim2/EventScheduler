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
import { exportUnfinishedEventsExcel } from "./exportScheduleExcel";
import UsersPage from "./UsersPage";
import StatsPage from "./StatsPage";
import { confirmAction, setConfirmAsk } from "./confirm";
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

function ConfirmModalHost() {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    setConfirmAsk((message, options = {}) =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialog({
          message,
          title: options.title || "Please confirm",
          confirmLabel: options.confirmLabel || "Confirm",
          cancelLabel: options.cancelLabel || "Cancel",
          danger: Boolean(options.danger),
        });
      })
    );
    return () => {
      setConfirmAsk(null);
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
  { to: "/jobs/active", label: "Active" },
  { to: "/jobs/finished", label: "Finished" },
  { to: "/proxies", label: "Proxies" },
  { to: "/history", label: "History" },
  { to: "/settings", label: "Settings" },
  { to: "/stats", label: "Stats", ownerOnly: true },
  { to: "/users", label: "Users", adminOnly: true },
];

function batchNameFromFile(fileName) {
  return String(fileName || "").replace(/\.[^.]+$/, "").trim();
}

function accountNameTaken(accountNames, accountName) {
  const wanted = String(accountName || "").trim().toLowerCase();
  if (!wanted) return false;
  return (accountNames || []).some(
    (name) => String(name || "").trim().toLowerCase() === wanted
  );
}

const PAGE_SIZE = 15;

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

function personLabel(name, email) {
  const display = String(name || "").trim();
  const mail = String(email || "").trim();
  return display || mail || "";
}

function formatWhen(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function gameAuditLine(game) {
  const createdBy = personLabel(game.created_by_name, game.created_by_email);
  const updatedBy = personLabel(game.updated_by_name, game.updated_by_email);
  const createdAt = formatWhen(game.created_at);
  const updatedAt = formatWhen(game.updated_at);
  const parts = [];
  if (createdBy || createdAt) {
    parts.push(`Added${createdBy ? ` by ${createdBy}` : ""}${createdAt ? ` · ${createdAt}` : ""}`);
  }
  if (updatedAt && updatedAt !== createdAt) {
    parts.push(`Last edit${updatedBy ? ` by ${updatedBy}` : ""} · ${updatedAt}`);
  } else if (updatedBy && updatedBy !== createdBy) {
    parts.push(`Last edit by ${updatedBy}`);
  }
  return parts.join(" · ");
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

/** Browser-local day bounds as ISO strings for server filtering (avoids server TZ mismatch). */
function dateFilterBounds(filter) {
  if (!filter || filter === "all") return {};
  const today = startOfLocalDay();
  if (filter === "today") {
    const end = new Date(today);
    end.setDate(end.getDate() + 1);
    return { dateFrom: today.toISOString(), dateTo: end.toISOString() };
  }
  if (filter === "yesterday") {
    const start = new Date(today);
    start.setDate(start.getDate() - 1);
    return { dateFrom: start.toISOString(), dateTo: today.toISOString() };
  }
  if (filter === "7d") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { dateFrom: start.toISOString() };
  }
  return {};
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
    delay_days: index === 0 ? 0 : index,
    delay_hours: 0,
    delay_minutes: index === 0 ? 30 : 0,
    time_value: "",
  };
}

const TIME_SPENT_MAX_DIGITS = 6;
const TIME_SPENT_MAX = 10 ** TIME_SPENT_MAX_DIGITS - 1; // 999999

/**
 * Keep time_spent as digits only, max 6 characters.
 * Returns { value, truncated } so the UI can toast when the user typed too many digits.
 */
function clampTimeSpentInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return {
    value: digits.slice(0, TIME_SPENT_MAX_DIGITS),
    truncated: digits.length > TIME_SPENT_MAX_DIGITS,
  };
}

function clampTimeSpentNumber(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(TIME_SPENT_MAX, n);
}

/** Resize/compress an image file to a JPEG data URL for upload. */
function readImageAsDataUrl(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      reject(new Error("Please choose an image file"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load image"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function localDayKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDayHeading(dayKey) {
  if (!dayKey || dayKey === "unknown") return "Unknown date";
  const today = localDayKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDayKey(yesterdayDate);
  if (dayKey === today) return "Today";
  if (dayKey === yesterday) return "Yesterday";
  const date = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dayKey;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function gameSelectOptions(games) {
  return (games || [])
    .map((game) => ({
      value: String(game.id),
      label: game.name,
      photo: game.photo_url || "",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Cumulative time_spent: each calendar day from the previous event adds dailyBudget
 * (skipped empty days still count). Multiple events on the same day split that day's total.
 */
function applyTimeSpent(selected, orderedVariableIds, dailyBudget = 30000) {
  const checked = orderedVariableIds
    .map((id) => ({ id, ...(selected[id] || {}) }))
    .filter((step) => step.checked);

  const byDay = new Map();
  for (const step of checked) {
    const day = Math.max(0, Number(step.delay_days) || 0);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(step.id);
  }

  const next = { ...selected };
  let last = 0;
  let previousDay = -1;
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const budget = Number(dailyBudget) || 30000;
  for (const day of days) {
    const ids = byDay.get(day);
    // Include empty days between previous event and this one (e.g. 8 → 23 adds 15 days).
    const daysPassed = day - previousDay;
    const dayTotal = budget * daysPassed;
    const perEvent = dayTotal / ids.length;
    for (const id of ids) {
      last += perEvent;
      next[id] = {
        ...next[id],
        time_value: String(clampTimeSpentNumber(last)),
      };
    }
    previousDay = day;
  }
  return next;
}

const PLAN_SHARE_TYPE = "event-scheduler-plan";

function uniquePlanName(plans, gameId, desired) {
  const base = String(desired || "Plan").trim() || "Plan";
  const taken = new Set(
    plans
      .filter((plan) => String(plan.game_id) === String(gameId))
      .map((plan) => String(plan.name || "").trim().toLowerCase())
  );
  if (!taken.has(base.toLowerCase())) return base;
  let i = 2;
  while (taken.has(`${base} ${i}`.toLowerCase())) i += 1;
  return `${base} ${i}`;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function planToSharePayload(full) {
  return {
    type: PLAN_SHARE_TYPE,
    version: 1,
    exported_at: new Date().toISOString(),
    game_name: full.game_name || "",
    plan_name: full.name || "Plan",
    steps: (full.steps || []).map((step) => ({
      variable_name: step.variable_name || "",
      variable_value: step.variable_value || "",
      delay_days: Number(step.delay_days) || 0,
      delay_hours: Number(step.delay_hours) || 0,
      delay_minutes: Number(step.delay_minutes) || 0,
      time_value: step.time_value || "",
      sort_order: Number(step.sort_order) || 0,
    })),
  };
}

function matchVariableForImport(game, step) {
  const name = String(step.variable_name || "").trim().toLowerCase();
  const value = String(step.variable_value || "").trim();
  return (
    game.variables.find((variable) => variable.name.trim().toLowerCase() === name) ||
    (value
      ? game.variables.find((variable) => String(variable.value).trim() === value)
      : null)
  );
}

function stepsFromSharePayload(game, data) {
  const steps = [];
  const missing = [];
  for (const [index, step] of (data.steps || []).entries()) {
    const variable = matchVariableForImport(game, step);
    if (!variable) {
      missing.push(step.variable_name || step.variable_value || `step ${index + 1}`);
      continue;
    }
    steps.push({
      variable_id: variable.id,
      delay_days: Number(step.delay_days) || 0,
      delay_hours: Number(step.delay_hours) || 0,
      delay_minutes: Number(step.delay_minutes) || 0,
      time_value: step.time_value || "",
      sort_order: Number.isFinite(step.sort_order) ? step.sort_order : index,
    });
  }
  return { steps, missing };
}

export default function App() {
  const {
    loading,
    firebaseUser,
    isApproved,
    isAdmin,
    isOwner,
    appUser,
    logout,
    refreshAppUser,
    error: authError,
  } = useAuth();
  const location = useLocation();
  const [accountNames, setAccountNames] = useState([]);
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
    telegram_enabled: "false",
    telegram_chat_id: "",
  });
  const [theme, setTheme] = useState(() => getPreferredTheme());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  /** False until the first games/plans/settings fetch finishes — avoids "No games yet" flash. */
  const [dataReady, setDataReady] = useState(false);

  const loadCore = async () => {
    const [proxyPage, g, pl, s, names] = await Promise.all([
      api.proxies({ limit: 100, offset: 0 }),
      api.games(),
      api.plans(),
      api.settings(),
      api.jobAccountNames(),
    ]);
    setProxies(proxyPage.items || (Array.isArray(proxyPage) ? proxyPage : []));
    setGames(g);
    setPlans(pl);
    setSettings(s);
    setAccountNames(names);
  };

  const load = async () => {
    await loadCore();
    setDataReady(true);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (!isApproved) return undefined;
    let cancelled = false;
    (async () => {
      try {
        await loadCore();
        if (!cancelled) setDataReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setDataReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
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

  useEffect(() => {
    setError("");
    setMessage("");
  }, [location.pathname]);

  useEffect(() => {
    if (!message && !error) return undefined;
    const id = window.setTimeout(() => {
      setMessage("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(id);
  }, [message, error]);

  if (loading) return <AuthLoadingScreen />;
  if (!firebaseUser) return <LoginScreen />;
  if (!appUser) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <h2>Account sync failed</h2>
          <p className="error">{authError || "Could not verify your account with the server."}</p>
          <p className="sub">
            Usually the API was down or the login token expired. Retry after the API is running —
            you should not need to sign in again.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                refreshAppUser().catch(() => {});
              }}
            >
              Retry
            </button>
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
  const navItems = NAV.filter(
    (item) => (!item.adminOnly || isAdmin) && (!item.ownerOnly || isOwner)
  );

  return (
    <div className="app-shell">
      <ConfirmModalHost />
      <header className="topbar">
        <Link to="/games" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg className="brand-mark-icon" viewBox="0 0 64 64" fill="none">
              <rect x="8" y="20" width="48" height="26" rx="12" stroke="currentColor" strokeWidth="3" />
              <path d="M22 27.5v11M16.5 33h11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <circle cx="42" cy="29" r="2.6" fill="currentColor" />
              <circle cx="47.5" cy="33.5" r="2.6" fill="currentColor" />
              <circle cx="42" cy="38" r="2.6" fill="currentColor" />
              <circle cx="36.5" cy="33.5" r="2.6" fill="currentColor" />
            </svg>
          </span>
          <div>
            <strong>Event Scheduler</strong>
            <div className="sub">Games · plans · timed requests</div>
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
                dataReady={dataReady}
                onRefresh={load}
                {...flash}
              />
            }
          />
          <Route
            path="/games/new"
            element={
              isAdmin ? (
                <GameFormPage games={games} onRefresh={load} {...flash} />
              ) : (
                <Navigate to="/games" replace />
              )
            }
          />
          <Route
            path="/games/:id/edit"
            element={
              isAdmin ? (
                <GameFormPage games={games} onRefresh={load} {...flash} />
              ) : (
                <Navigate to="/games" replace />
              )
            }
          />
          <Route
            path="/jobs"
            element={
              <JobsPage
                accountNames={accountNames}
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
            element={<ScheduledJobsPage games={games} onRefresh={load} {...flash} />}
          />
          <Route
            path="/jobs/active"
            element={<ActiveAccountsPage games={games} onRefresh={load} {...flash} />}
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
          <Route
            path="/stats"
            element={isOwner ? <StatsPage {...flash} /> : <Navigate to="/games" replace />}
          />
          <Route path="/users" element={<UsersPage {...flash} />} />
          <Route path="*" element={<Navigate to="/games" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function GamesPage({ games, plans, settings, dataReady = true, onRefresh, setError, setMessage }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dailyBudget = Number(settings?.daily_time_spent) || 30000;
  const [mode, setMode] = useState("list");
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [planGameId, setPlanGameId] = useState("");
  const [planName, setPlanName] = useState("");
  const [planNameError, setPlanNameError] = useState("");
  const [selected, setSelected] = useState({});
  const [openPlan, setOpenPlan] = useState(null);
  const [expandedGameId, setExpandedGameId] = useState(null);
  const planNameRef = useRef(null);
  const importFileRef = useRef(null);
  const [importGameId, setImportGameId] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [importPlanName, setImportPlanName] = useState("");
  const [importNameError, setImportNameError] = useState("");
  const importNameRef = useRef(null);

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
    setPlanNameError("");
    setSelected({});
    setOpenPlan(null);
  };

  const startCreatePlan = (game) => {
    setEditingPlanId(null);
    setPlanGameId(String(game.id));
    setPlanName("");
    setPlanNameError("");
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
    setSelected((prev) => ({
      ...prev,
      [variableId]: { ...(prev[variableId] || defaultStepDelay(0)), checked: true, ...patch },
    }));
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
    setPlanNameError("");
    if (!selectedGame) {
      setError("Select a game first");
      return;
    }
    if (!planName.trim()) {
      setPlanNameError("Plan name is required — give this plan a name before saving.");
      planNameRef.current?.focus();
      return;
    }
    const steps = selectedGame.variables
      .filter((variable) => selected[variable.id]?.checked)
      .map((variable, index) => ({
        variable_id: variable.id,
        delay_days: Number(selected[variable.id]?.delay_days) || 0,
        delay_hours: Number(selected[variable.id]?.delay_hours) || 0,
        delay_minutes: Number(selected[variable.id]?.delay_minutes) || 0,
        time_value: clampTimeSpentInput(selected[variable.id]?.time_value || "").value,
        sort_order: index,
      }));
    try {
      if (editingPlanId) {
        await api.updatePlan(editingPlanId, { name: planName.trim(), steps });
        setMessage("Plan updated.");
      } else {
        await api.createPlan({
          game_id: selectedGame.id,
          name: planName.trim(),
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

  const duplicatePlan = async (plan) => {
    setError("");
    try {
      const full = await api.getPlan(plan.id);
      const name = uniquePlanName(plans, full.game_id, `${full.name} (copy)`);
      const steps = (full.steps || []).map((step, index) => ({
        variable_id: step.variable_id,
        delay_days: Number(step.delay_days) || 0,
        delay_hours: Number(step.delay_hours) || 0,
        delay_minutes: Number(step.delay_minutes) || 0,
        time_value: step.time_value || "",
        sort_order: Number.isFinite(step.sort_order) ? step.sort_order : index,
      }));
      const created = await api.createPlan({
        game_id: full.game_id,
        name,
        steps,
      });
      setMessage(`Duplicated as "${created.name}".`);
      setExpandedGameId(full.game_id);
      await onRefresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const exportPlan = async (plan) => {
    setError("");
    try {
      const full = await api.getPlan(plan.id);
      const payload = planToSharePayload(full);
      const safeName = String(full.name || "plan")
        .trim()
        .replace(/[^\w\-]+/g, "_")
        .slice(0, 60);
      downloadJson(`${safeName || "plan"}.json`, payload);
      setMessage(`Exported "${full.name}". Share the JSON file to import elsewhere.`);
    } catch (err) {
      setError(err.message);
    }
  };

  const startImportForGame = (game) => {
    setImportGameId(String(game.id));
    importFileRef.current?.click();
  };

  const cancelPendingImport = () => {
    setPendingImport(null);
    setImportPlanName("");
    setImportNameError("");
    setImportGameId("");
  };

  const confirmImportPlan = async (event) => {
    event?.preventDefault?.();
    if (!pendingImport) return;
    const typed = importPlanName.trim();
    if (!typed) {
      setImportNameError("Enter a plan name before importing.");
      importNameRef.current?.focus();
      return;
    }
    setError("");
    setImportNameError("");
    const { game, steps, missing } = pendingImport;
    try {
      const name = uniquePlanName(plans, game.id, typed);
      const created = await api.createPlan({
        game_id: game.id,
        name,
        steps,
      });
      setExpandedGameId(game.id);
      cancelPendingImport();
      await onRefresh();
      if (missing.length) {
        setMessage(
          `Imported "${created.name}" (${steps.length} steps). Skipped unmatched: ${missing.join(", ")}.`
        );
      } else {
        setMessage(`Imported "${created.name}" into ${game.name}.`);
      }
    } catch (err) {
      setError(err.message || "Could not import plan file.");
    }
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.type !== PLAN_SHARE_TYPE || !Array.isArray(data.steps)) {
        setError("Not a valid Event Scheduler plan file.");
        setImportGameId("");
        return;
      }
      let game =
        games.find((item) => String(item.id) === String(importGameId)) ||
        games.find(
          (item) =>
            item.name.trim().toLowerCase() === String(data.game_name || "").trim().toLowerCase()
        );
      if (!game && games.length === 1) game = games[0];
      if (!game) {
        setError(
          data.game_name
            ? `No matching game for "${data.game_name}". Open a game and use Import plan there.`
            : "Pick a game first, then use Import plan on that game."
        );
        setImportGameId("");
        return;
      }
      const { steps, missing } = stepsFromSharePayload(game, data);
      if (steps.length === 0) {
        setError(
          `No levels matched on "${game.name}". Import needs the same level names (or values) as the shared plan.`
        );
        setImportGameId("");
        return;
      }
      setPendingImport({ game, steps, missing, sourceName: data.plan_name || "" });
      setImportPlanName("");
      setImportNameError("");
      setImportGameId("");
      window.setTimeout(() => importNameRef.current?.focus(), 0);
    } catch (err) {
      setError(err.message || "Could not import plan file.");
      setImportGameId("");
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
              Delays are relative. Press Calculate at the bottom to rebuild time_spent from delays — skipped days
              between levels still add to the total. Manual edits stay until you calculate again. Max 6 digits.
            </p>
          </div>
          <button className="btn" type="button" onClick={goList}>
            Back to games
          </button>
        </div>
        <form className="panel-body" onSubmit={savePlan}>
          <label className="field-label">
            Plan name <span className="req-mark">*</span>
          </label>
          <input
            ref={planNameRef}
            value={planName}
            onChange={(e) => {
              setPlanName(e.target.value);
              if (planNameError) setPlanNameError("");
            }}
            placeholder="e.g. Standard plan"
            className={planNameError ? "input-error" : undefined}
            aria-invalid={Boolean(planNameError)}
            aria-required="true"
          />
          {planNameError ? <p className="field-error">{planNameError}</p> : null}
          <p className="sub">Required. This name is how you pick the plan when adding jobs.</p>
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
                          setSelected((prev) => ({
                            ...prev,
                            [variable.id]: { ...step, checked: e.target.checked },
                          }));
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
                        inputMode="numeric"
                        maxLength={TIME_SPENT_MAX_DIGITS + 1}
                        onChange={(e) => {
                          const { value, truncated } = clampTimeSpentInput(e.target.value);
                          if (truncated) {
                            setMessage(`time_spent is limited to ${TIME_SPENT_MAX_DIGITS} digits (max ${TIME_SPENT_MAX}).`);
                          }
                          setSelected((prev) => ({
                            ...prev,
                            [variable.id]: { ...step, time_value: value },
                          }));
                        }}
                        placeholder="e.g. 30000"
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
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSelected((prev) => regenerateTimeSpent(prev));
                setMessage("time_spent recalculated from delays (empty days in between also count).");
              }}
            >
              Calculate time_spent
            </button>
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
            <button className="btn" type="button" onClick={() => duplicatePlan(openPlan)}>
              Duplicate
            </button>
            <button className="btn" type="button" onClick={() => exportPlan(openPlan)}>
              Export
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
      <input
        ref={importFileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={onImportFile}
      />
      {pendingImport && (
        <div className="modal-backdrop" onClick={cancelPendingImport}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Name this imported plan</h3>
            <p>
              Delays will be imported into <strong>{pendingImport.game.name}</strong>
              {pendingImport.sourceName ? ` (from “${pendingImport.sourceName}”).` : "."} Choose your own
              plan name.
            </p>
            <form onSubmit={confirmImportPlan}>
              <label className="field-label">
                Plan name <span className="req-mark">*</span>
              </label>
              <input
                ref={importNameRef}
                value={importPlanName}
                onChange={(e) => {
                  setImportPlanName(e.target.value);
                  if (importNameError) setImportNameError("");
                }}
                placeholder="e.g. My shared plan"
                className={importNameError ? "input-error" : undefined}
                aria-invalid={Boolean(importNameError)}
                required
              />
              {importNameError ? <p className="field-error">{importNameError}</p> : null}
              <div className="modal-actions">
                <button type="button" className="btn" onClick={cancelPendingImport}>
                  Cancel
                </button>
                <button type="submit" className="btn primary">
                  Import plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="panel-head">
        <div>
          <h2>Games</h2>
          <p className="sub">
            Games are shared. Plans are yours only. Duplicate a plan, or Export/Import JSON to share delays.
            {isAdmin ? " Admins can also add or edit games." : ""}
          </p>
        </div>
        {isAdmin && (
          <Link className="btn primary" to="/games/new">
            Add game
          </Link>
        )}
      </div>

      <div className="panel-body">
        {!dataReady && <p className="sub">Loading games…</p>}
        {dataReady && games.length === 0 && (
          <div className="empty">
            <p>No games yet.</p>
            {isAdmin ? (
              <Link className="btn primary" to="/games/new">
                Add your first game
              </Link>
            ) : (
              <p className="sub">Ask an admin to add a game.</p>
            )}
          </div>
        )}

        <div className="game-list">
          {games.map((game) => {
            const gamePlans = plansByGame[game.id] || [];
            const expanded = expandedGameId === game.id;
            const audit = gameAuditLine(game);
            return (
              <article key={game.id} className="game-item">
                <div className="game-item-main">
                  <button
                    type="button"
                    className="game-title"
                    onClick={() => setExpandedGameId(expanded ? null : game.id)}
                  >
                    <span className="game-title-row">
                      {game.photo_url ? (
                        <img className="game-thumb" src={game.photo_url} alt="" />
                      ) : (
                        <span className="game-thumb game-thumb-empty" aria-hidden="true" />
                      )}
                      <span className="game-title-text">
                        <strong>{game.name}</strong>
                        <span className="sub">
                          {game.variables.length} variable{game.variables.length === 1 ? "" : "s"} ·{" "}
                          {gamePlans.length} plan{gamePlans.length === 1 ? "" : "s"}
                          {game.notices ? " · has notices" : ""}
                        </span>
                        {isAdmin && audit ? <span className="sub game-audit">{audit}</span> : null}
                      </span>
                    </span>
                  </button>
                  <div className="actions tight">
                    {isAdmin && (
                      <button className="btn" type="button" onClick={() => navigate(`/games/${game.id}/edit`)}>
                        Edit game
                      </button>
                    )}
                    <button className="btn" type="button" onClick={() => startCreatePlan(game)}>
                      Create plan
                    </button>
                    <button className="btn" type="button" onClick={() => startImportForGame(game)}>
                      Import plan
                    </button>
                    {isAdmin && (
                      <button className="btn danger" type="button" onClick={() => deleteGame(game)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div className="game-item-detail">
                    {game.photo_url ? (
                      <div className="game-photo-preview">
                        <img src={game.photo_url} alt={`${game.name} cover`} />
                      </div>
                    ) : null}
                    {game.notices ? (
                      <div className="game-notices">
                        <h3>Notices</h3>
                        <p className="game-notices-text">{game.notices}</p>
                      </div>
                    ) : null}
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
                      <p className="sub">No plans for this game yet. Create one, or Import a shared JSON.</p>
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
                                <div className="actions tight">
                                  <button className="btn" type="button" onClick={() => viewPlan(plan.id)}>
                                    View
                                  </button>
                                  <button className="btn" type="button" onClick={() => startEditPlan(plan)}>
                                    Edit
                                  </button>
                                  <button className="btn" type="button" onClick={() => duplicatePlan(plan)}>
                                    Duplicate
                                  </button>
                                  <button className="btn" type="button" onClick={() => exportPlan(plan)}>
                                    Export
                                  </button>
                                  <button className="btn danger" type="button" onClick={() => deletePlan(plan)}>
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
  const dirtyRef = useRef(false);
  const photoInputRef = useRef(null);
  const [gameName, setGameName] = useState(existing?.name || "");
  const [notices, setNotices] = useState(existing?.notices || "");
  const [photoPreview, setPhotoPreview] = useState(existing?.photo_url || "");
  const [photoData, setPhotoData] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
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
    dirtyRef.current = false;
  }, [editingId]);

  useEffect(() => {
    if (!editingId) {
      if (dirtyRef.current) return;
      setGameName("");
      setNotices("");
      setPhotoPreview("");
      setPhotoData("");
      setRemovePhoto(false);
      setVariables(emptyVariables);
      return;
    }
    if (!existing || dirtyRef.current) return;
    setGameName(existing.name);
    setNotices(existing.notices || "");
    setPhotoPreview(existing.photo_url || "");
    setPhotoData("");
    setRemovePhoto(false);
    setVariables(
      existing.variables.map((variable) => ({
        id: variable.id,
        name: variable.name,
        value: variable.value,
      }))
    );
  }, [editingId, existing]);

  const addVariable = () => {
    dirtyRef.current = true;
    setVariables((prev) => [...prev, { name: `Level ${prev.length + 1}`, value: "" }]);
  };

  const updateVariable = (index, key, value) => {
    dirtyRef.current = true;
    setVariables((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const reorderVariable = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= variables.length || toIndex >= variables.length) {
      return;
    }
    dirtyRef.current = true;
    setVariables((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
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
    dirtyRef.current = true;
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const onPickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const dataUrl = await readImageAsDataUrl(file);
      dirtyRef.current = true;
      setPhotoData(dataUrl);
      setPhotoPreview(dataUrl);
      setRemovePhoto(false);
      setMessage("Photo ready — save the game to keep it.");
    } catch (err) {
      setError(err.message || "Could not read photo");
    }
  };

  const clearPhoto = () => {
    dirtyRef.current = true;
    setPhotoData("");
    setPhotoPreview("");
    setRemovePhoto(Boolean(existing?.photo_url));
  };

  const saveGame = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        name: gameName,
        notices,
        // Persist current UI order so a new middle level can sit between others.
        variables: variables.map((variable, index) => ({
          ...variable,
          sort_order: index,
        })),
        remove_photo: removePhoto,
      };
      if (photoData) payload.photo_data = photoData;
      if (editingId) {
        await api.updateGame(editingId, payload);
        setMessage("Game updated.");
      } else {
        await api.createGame(payload);
        setMessage("Game saved.");
      }
      dirtyRef.current = false;
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
          <p className="sub">Name, optional photo & notices, then levels.</p>
        </div>
        <Link className="btn" to="/games">
          Back to games
        </Link>
      </div>
      <form className="panel-body" onSubmit={saveGame}>
        <label>Game name</label>
        <input
          value={gameName}
          onChange={(e) => {
            dirtyRef.current = true;
            setGameName(e.target.value);
          }}
          required
          placeholder="Game-1"
        />
        <label>
          Photo <span className="sub">(optional)</span>
        </label>
        <div className="game-photo-editor">
          {photoPreview ? (
            <img className="game-photo-editor-preview" src={photoPreview} alt="Game preview" />
          ) : (
            <div className="game-photo-editor-empty">No photo</div>
          )}
          <div className="actions tight">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onPickPhoto}
            />
            <button type="button" className="btn" onClick={() => photoInputRef.current?.click()}>
              {photoPreview ? "Change photo" : "Add photo"}
            </button>
            {photoPreview ? (
              <button type="button" className="btn danger" onClick={clearPhoto}>
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
        <label>
          Notices <span className="sub">(optional)</span>
        </label>
        <textarea
          value={notices}
          onChange={(e) => {
            dirtyRef.current = true;
            setNotices(e.target.value);
          }}
          placeholder="Tips, warnings, or notes for users of this game…"
          rows={4}
        />
        <label>
          Levels <span className="sub">(drag ⋮⋮ to reorder)</span>
        </label>
        {variables.map((variable, index) => (
          <div
            className={`delay-row level-row ${dragIndex === index ? "dragging" : ""} ${
              dragOverIndex === index ? "drag-over" : ""
            }`}
            key={variable.id || `new-${index}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverIndex !== index) setDragOverIndex(index);
            }}
            onDragLeave={() => {
              if (dragOverIndex === index) setDragOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              reorderVariable(Number.isFinite(from) ? from : dragIndex, index);
              setDragIndex(null);
              setDragOverIndex(null);
            }}
          >
            <button
              type="button"
              className="level-drag-handle"
              title="Drag to reorder"
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(index));
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
            >
              ⋮⋮
            </button>
            <span className="level-order sub">{index + 1}</span>
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
  const { appUser, logout, isAdmin, isOwner } = useAuth();
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

  const testTelegram = async () => {
    setError("");
    try {
      const chatId = String(form.telegram_chat_id || "").trim();
      if (dirtyRef.current) {
        const saved = await api.saveSettings({
          ...form,
          fleet_host: normalizeFleetHost(form.fleet_host),
          fleet_user: fleetBaseUsername(form.fleet_user),
          fleet_port: String(form.fleet_port || "5000"),
          fleet_pass: String(form.fleet_pass || ""),
          fleet_protocol: form.fleet_protocol || "http",
          telegram_enabled: String(form.telegram_enabled || "false"),
          telegram_chat_id: chatId,
        });
        dirtyRef.current = false;
        setForm(saved);
      }
      await api.testTelegram({ telegram_chat_id: chatId });
      setMessage("Telegram test sent. Check your chat.");
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

  const roleLabel = isOwner ? "owner" : isAdmin ? "admin" : "user";

  return (
    <section className="panel settings-card settings-wide">
      <div className="panel-head">
        <div>
          <h2>Settings</h2>
          <p className="sub">Account, Telegram, timing, and FleetProxy.</p>
        </div>
      </div>

      <div className="settings-sections">
        <div className="settings-block">
          <h3 className="settings-section-title">Account</h3>
          <div className="settings-account-row">
            <div className="settings-account-stack">
              <div>
                <strong>{appUser?.email || "—"}</strong>
                <div className="sub">
                  {appUser?.display_name ? `${appUser.display_name} · ` : ""}
                  {roleLabel}
                </div>
                <div className="settings-account-meta">
                  <div>
                    <div className="sub">Signed up</div>
                    <div>
                      {appUser?.created_at
                        ? new Date(appUser.created_at).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="sub">Last login</div>
                    <div>
                      {appUser?.last_login_at
                        ? new Date(appUser.last_login_at).toLocaleString()
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-telegram">
                <div className="sub">Telegram alerts</div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={String(form.telegram_enabled || "false") === "true"}
                    onChange={(e) =>
                      patchForm({
                        telegram_enabled: e.target.checked ? "true" : "false",
                      })
                    }
                  />
                  <span>Notify on failures &amp; finished accounts</span>
                </label>
                <div className="plan-picker">
                  <input
                    value={form.telegram_chat_id || ""}
                    onChange={(e) => patchForm({ telegram_chat_id: e.target.value })}
                    placeholder="Chat ID"
                    autoComplete="off"
                  />
                  <button type="button" className="btn" onClick={testTelegram}>
                    Test
                  </button>
                </div>
                <details className="settings-details">
                  <summary>How to get chat ID</summary>
                  <ol className="settings-help-list">
                    <li>Open the bot in Telegram and press <strong>Start</strong>.</li>
                    <li>The bot will reply with your chat ID — copy it.</li>
                    <li>
                      Paste it here, enable alerts, then Save / Test. You&apos;ll get messages for
                      failed requests and when an account finishes.
                    </li>
                  </ol>
                </details>
              </div>
            </div>
            <button type="button" className="btn btn-danger" onClick={() => logout()}>
              Sign out
            </button>
          </div>
        </div>

        <form className="settings-block" onSubmit={save}>
          <h3 className="settings-section-title">Timing</h3>
          <div className="settings-grid">
            <label>
              <span>Daily time_spent (sec)</span>
              <input
                type="number"
                min="1"
                value={form.daily_time_spent || "30000"}
                onChange={(e) => patchForm({ daily_time_spent: e.target.value })}
              />
            </label>
            <label>
              <span>Noise ± (sec)</span>
              <input
                type="number"
                min="0"
                value={form.time_spent_noise || "300"}
                onChange={(e) => patchForm({ time_spent_noise: e.target.value })}
              />
            </label>
          </div>

          <h3 className="settings-section-title">FleetProxy</h3>
          <details className="settings-details">
            <summary>How to get proxy details</summary>
            <ol className="settings-help-list">
              <li>
                Log in at{" "}
                <a
                  href="https://dashboard.fleetproxy.io/residential/generator"
                  target="_blank"
                  rel="noreferrer"
                >
                  dashboard.fleetproxy.io
                </a>
                , buy a residential proxy if you don’t have one yet.
              </li>
              <li>
                Open <strong>Active proxies</strong>, then <strong>Generator</strong> (or go
                straight to the generator link above).
              </li>
              <li>
                On the left, under <strong>Generated proxies</strong>, copy the proxy line plus
                username and password.
              </li>
              <li>Paste the line below (or fill Host / Port / Username / Password), then Save.</li>
            </ol>
            <pre className="fleet-example">
              residential-v2.fleetproxy.io:5000:YOUR_USER-country-US-region-california:YOUR_PASSWORD
            </pre>
          </details>
          <label>
            <span>Paste proxy line</span>
            <div className="plan-picker">
              <input
                value={pasteLine}
                onChange={(e) => setPasteLine(e.target.value)}
                placeholder="host:port:user:pass"
              />
              <button type="button" className="btn primary" onClick={applyPasteLine}>
                Apply & save
              </button>
            </div>
          </label>

          <div className="settings-grid">
            <label>
              <span>Host</span>
              <input
                value={form.fleet_host || ""}
                onChange={(e) => patchForm({ fleet_host: e.target.value })}
                placeholder="residential-v2.fleetproxy.io"
              />
            </label>
            <label>
              <span>Port</span>
              <input
                value={form.fleet_port || ""}
                onChange={(e) => patchForm({ fleet_port: e.target.value })}
                placeholder="5000"
              />
            </label>
            <label>
              <span>Username</span>
              <input
                value={form.fleet_user || ""}
                onChange={(e) => patchForm({ fleet_user: e.target.value })}
                placeholder="YOUR_USER"
              />
            </label>
            <label>
              <span>Protocol</span>
              <select
                value={form.fleet_protocol || "http"}
                onChange={(e) => patchForm({ fleet_protocol: e.target.value })}
              >
                <option value="http">http / https</option>
                <option value="socks5">socks5</option>
              </select>
            </label>
          </div>

          <label>
            <span>Password</span>
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
          </label>

          <div className="actions">
            <button className="btn primary" type="submit">
              Save settings
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function InlinePlanCreator({ game, settings, onCancel, onCreated, setError, setMessage }) {
  const dailyBudget = Number(settings?.daily_time_spent) || 30000;
  const [planName, setPlanName] = useState("");
  const [planNameError, setPlanNameError] = useState("");
  const planNameRef = useRef(null);
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
    setSelected((prev) => ({
      ...prev,
      [variableId]: { ...(prev[variableId] || defaultStepDelay(0)), checked: true, ...patch },
    }));
  };

  const savePlan = async () => {
    setError("");
    setPlanNameError("");
    if (!planName.trim()) {
      setPlanNameError("Plan name is required — give this plan a name before saving.");
      planNameRef.current?.focus();
      return;
    }
    const steps = game.variables
      .filter((variable) => selected[variable.id]?.checked)
      .map((variable, index) => ({
        variable_id: variable.id,
        delay_days: Number(selected[variable.id]?.delay_days) || 0,
        delay_hours: Number(selected[variable.id]?.delay_hours) || 0,
        delay_minutes: Number(selected[variable.id]?.delay_minutes) || 0,
        time_value: clampTimeSpentInput(selected[variable.id]?.time_value || "").value,
        sort_order: index,
      }));
    try {
      const created = await api.createPlan({
        game_id: game.id,
        name: planName.trim(),
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
        <label className="field-label">
          Plan name <span className="req-mark">*</span>
        </label>
        <input
          ref={planNameRef}
          value={planName}
          onChange={(e) => {
            setPlanName(e.target.value);
            if (planNameError) setPlanNameError("");
          }}
          placeholder="e.g. Standard plan"
          className={planNameError ? "input-error" : undefined}
          aria-invalid={Boolean(planNameError)}
          aria-required="true"
        />
        {planNameError ? <p className="field-error">{planNameError}</p> : null}
        <p className="sub">Required. This name is how you pick the plan when adding jobs.</p>
        <p className="sub">Filled once at start. Edits stay until you press Calculate. Max 6 digits.</p>
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
                        setSelected((prev) => ({
                          ...prev,
                          [variable.id]: { ...step, checked: e.target.checked },
                        }))
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
                      inputMode="numeric"
                      maxLength={TIME_SPENT_MAX_DIGITS + 1}
                      onChange={(e) => {
                        const { value, truncated } = clampTimeSpentInput(e.target.value);
                        if (truncated) {
                          setMessage(
                            `time_spent is limited to ${TIME_SPENT_MAX_DIGITS} digits (max ${TIME_SPENT_MAX}).`
                          );
                        }
                        setSelected((prev) => ({
                          ...prev,
                          [variable.id]: { ...step, time_value: value },
                        }));
                      }}
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
          <button
            type="button"
            className="btn"
            onClick={() => {
              setSelected((prev) => regenerateTimeSpent(prev));
              setMessage("time_spent recalculated from delays (empty days in between also count).");
            }}
          >
            Calculate time_spent
          </button>
          <button className="btn primary" type="button" onClick={savePlan}>
            Save plan
          </button>
        </div>
      </div>
    </div>
  );
}

function JobsPage({ accountNames, proxies, games, plans, settings, onRefresh, setError, setMessage }) {
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
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [planPreview, setPlanPreview] = useState(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [nameError, setNameError] = useState("");
  const [notes, setNotes] = useState("");

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
    if (accountNameTaken(accountNames, trimmed)) {
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
    if (accountNameTaken(accountNames, batch)) {
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
      setError("Choose a game, a plan, and a request .txt file");
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
        notes: notes.trim(),
      });
      setMessage(`Scheduled ${result.count} jobs from the plan.`);
      setName("");
      setNameError("");
      setNotes("");
      setNotesExpanded(false);
      setRaw("");
      setFileName("");
      setPlanPreview(null);
      setCreatingPlan(false);
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
  const nameTaken = accountNameTaken(accountNames, name);

  return (
    <form className="panel" onSubmit={save}>
      <div className="panel-head">
        <div>
          <h2>New job</h2>
          <p className="sub">
            Upload one session or event request file.
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
            <label>
              Notes <span className="sub">(optional)</span>
            </label>
            <button
              type="button"
              className="btn"
              onClick={() => setNotesExpanded((open) => !open)}
            >
              {notesExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
          {!notesExpanded ? (
            <div className="request-collapsed sub">
              {notes.trim()
                ? "Notes saved. Press Expand to edit."
                : "Press Expand to add optional notes for this account."}
            </div>
          ) : (
            <textarea
              className="notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything useful about this account…"
              rows={3}
            />
          )}
        </div>

        <SearchableSelect
          label="Game"
          value={gameId}
          onChange={onPickGame}
          options={gameSelectOptions(games)}
          allLabel="Select a game"
          placeholder="Search games…"
        />
        {selectedGame?.notices ? (
          <div className="game-notices">
            <h3>Notices · {selectedGame.name}</h3>
            <p className="game-notices-text">{selectedGame.notices}</p>
          </div>
        ) : null}

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
              Pick location + rotation. Check the proxy before scheduling — schedule is
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

async function copyAccountName(value, setMessage, setError) {
  const text = String(value || "").trim();
  if (!text || text === "—") return;
  try {
    await navigator.clipboard.writeText(text);
    if (setMessage) setMessage(`Copied account: ${text}`);
  } catch (err) {
    if (setError) setError(err.message || "Could not copy");
  }
}

function CopyableAccount({ value, setMessage, setError }) {
  const text = String(value || "").trim() || "—";
  return (
    <button
      type="button"
      className="copyable-account"
      title="Click to copy"
      onClick={() => copyAccountName(text, setMessage, setError)}
    >
      {text}
    </button>
  );
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

  const selected = useMemo(() => {
    if (!value) return null;
    return options.find((opt) => opt.value === value) || null;
  }, [value, options]);

  const selectedLabel = selected ? selected.label : allLabel;
  const showPhotos = useMemo(() => options.some((opt) => opt.photo), [options]);

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

  const renderPhoto = (photo, className = "search-select-thumb") => {
    if (!showPhotos) return null;
    if (photo) return <img className={className} src={photo} alt="" />;
    return <span className={`${className} search-select-thumb-empty`} aria-hidden="true" />;
  };

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
        <span className="search-select-trigger-main">
          {renderPhoto(selected?.photo || "")}
          <span>{selectedLabel}</span>
        </span>
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
            {showPhotos ? (
              <span className="search-select-option-main">
                <span className="search-select-thumb search-select-thumb-empty" aria-hidden="true" />
                <span>{allLabel}</span>
              </span>
            ) : (
              allLabel
            )}
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
              <span className="search-select-option-main">
                {renderPhoto(opt.photo || "")}
                <span>{opt.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduledJobsPage({ games, onRefresh, setError, setMessage }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const accountFromUrl = searchParams.get("account") || "";
  const [showFull, setShowFull] = useState(Boolean(accountFromUrl));
  const [accountFilter, setAccountFilter] = useState(accountFromUrl);
  const [gameFilter, setGameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [accountNames, setAccountNames] = useState([]);

  const queryOpts = useMemo(() => {
    const bounds = dateFilterBounds(dateFilter);
    return {
      view: showFull ? undefined : "next",
      gameId: gameFilter || undefined,
      account: accountFilter || undefined,
      status: statusFilter || "remaining",
      kind: kindFilter || undefined,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
    };
  }, [showFull, gameFilter, accountFilter, statusFilter, kindFilter, dateFilter]);

  const jobsLenRef = useRef(0);
  jobsLenRef.current = jobs.length;

  const loadPage = async ({
    offset = 0,
    append = false,
    silent = false,
    limit = PAGE_SIZE,
  } = {}) => {
    if (!silent) {
      if (append) setLoadingMore(true);
      else setLoading(true);
    }
    try {
      const page = await api.jobs({ ...queryOpts, limit, offset });
      setJobs((prev) => (append ? [...prev, ...(page.items || [])] : page.items || []));
      setTotal(page.total || 0);
      setHasMore(Boolean(page.has_more));
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const reload = async () => {
    await Promise.all([
      loadPage({ offset: 0, append: false }),
      api.jobAccountNames().then(setAccountNames).catch(() => {}),
      onRefresh?.(),
    ]);
  };

  useEffect(() => {
    const next = searchParams.get("account") || "";
    if (!next) return;
    setAccountFilter(next);
    setShowFull(true);
  }, [searchParams]);

  useEffect(() => {
    loadPage({ offset: 0 }).catch(() => {});
  }, [queryOpts]);

  useEffect(() => {
    api.jobAccountNames().then(setAccountNames).catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      const keep = Math.max(PAGE_SIZE, jobsLenRef.current || PAGE_SIZE);
      loadPage({ offset: 0, silent: true, limit: keep }).catch(() => {});
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [queryOpts]);

  const accountOptions = useMemo(
    () =>
      accountNames
        .map((name) => ({ value: name, label: name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [accountNames]
  );

  const gameOptions = useMemo(() => gameSelectOptions(games), [games]);

  const hasFilters = Boolean(
    accountFilter || gameFilter || statusFilter || kindFilter || (dateFilter && dateFilter !== "all")
  );

  const clearFilters = () => {
    setAccountFilter("");
    setGameFilter("");
    setStatusFilter("");
    setKindFilter("");
    setDateFilter("all");
    if (searchParams.get("account")) setSearchParams({}, { replace: true });
  };

  const openAccountDetails = (job) => {
    setAccountFilter(jobAccountName(job));
    setGameFilter(job.game_id ? String(job.game_id) : "");
    setStatusFilter("");
    setKindFilter("");
    setShowFull(true);
  };

  const accountDetails = useMemo(() => {
    if (!showFull || !accountFilter || jobs.length === 0) return null;
    const sample = jobs[0];
    return {
      account: accountFilter,
      batchId: sample.batch_id || null,
      game: sample.game_name || "—",
      plan: sample.plan_name || "manual",
      proxy: sample.proxy_name || "direct",
      notes: sample.notes || "",
      addedAt: sample.created_at,
      remaining: total,
      total,
    };
  }, [showFull, accountFilter, jobs, total]);

  const deleteWholeAccount = async () => {
    if (!accountDetails?.account) return;
    if (
      !(await confirmAction(
        `Delete account "${accountDetails.account}" and all its jobs? This removes sessions, events, history, and unused proxies.`,
        {
          title: "Delete account",
          confirmLabel: "Delete account",
          danger: true,
        }
      ))
    ) {
      return;
    }
    try {
      const result = await api.deleteAccountByName(accountDetails.account);
      setAccountFilter("");
      setShowFull(false);
      setMessage(
        `Deleted account ${accountDetails.account} (${result.deleted_jobs} jobs${
          result.deleted_proxies ? `, ${result.deleted_proxies} proxies` : ""
        }).`
      );
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Scheduled jobs</h2>
          <p className="sub">
            {showFull
              ? "Remaining schedule (paginated). Auto-refreshes every 5s."
              : "Next job per account (paginated). Auto-refreshes every 5s."}
          </p>
        </div>
        <div className="actions tight">
          <button type="button" className="btn" onClick={() => reload().catch((e) => setError(e.message))}>
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-info"
            onClick={async () => {
              try {
                let all = [];
                let offset = 0;
                let hasMoreExport = true;
                while (hasMoreExport && all.length < 2000) {
                  const page = await api.jobs({ status: "remaining", limit: 100, offset });
                  all = all.concat(page.items || []);
                  offset = all.length;
                  hasMoreExport = Boolean(page.has_more);
                }
                await exportUnfinishedEventsExcel(
                  all,
                  `unfinished-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`
                );
                setMessage("Excel exported: yellow = done, red = failed, blue date = scheduled.");
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            Export Excel
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
              <option value="all">All dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
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

        {loading && jobs.length === 0 && <p className="sub">Loading schedule…</p>}
        {!loading && jobs.length === 0 && <p className="sub">No jobs match these filters.</p>}
        {jobs.length > 0 && (
          <p className="sub">
            Showing {jobs.length} of {total}
          </p>
        )}
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
            {jobs.map((job) => {
              const finished = job.status === "done" || job.status === "failed";
              const responseText =
                job.last_error || job.last_response_preview || "No response saved";
              const kind = jobKind(job);
              const task = jobTaskLabel(job);
              const viewingThisAccount = showFull && accountFilter === jobAccountName(job);
              return (
                <tr key={job.id}>
                  <td>
                    <CopyableAccount
                      value={jobAccountName(job)}
                      setMessage={setMessage}
                      setError={setError}
                    />
                    <div className="sub">
                      {job.game_name ? `${job.game_name} · ` : ""}
                      {job.plan_name || "manual"}
                    </div>
                    {job.notes ? <div className="sub account-notes">{job.notes}</div> : null}
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
                            api.runNow(job.id).then(reload).catch((e) => setError(e.message));
                          }}
                        >
                          Run now
                        </button>
                      )}
                      {job.status === "failed" && (
                        <button
                          type="button"
                          className="btn btn-run"
                          onClick={async () => {
                            if (
                              !(await confirmAction(`Resend failed job "${job.name}"?`, {
                                title: "Resend request",
                                confirmLabel: "Resend",
                              }))
                            ) {
                              return;
                            }
                            try {
                              const updated = await api.runNow(job.id);
                              if (updated?.status === "done") {
                                setJobs((prev) =>
                                  prev.map((row) =>
                                    row.id === job.id ? { ...row, status: "done" } : row
                                  )
                                );
                                setMessage(`Resent ${job.name} — now ok`);
                              } else {
                                setMessage(`Resent ${job.name} — still failed`);
                              }
                              await reload();
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          Resend
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
                              return reload();
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

        {hasMore && (
          <div className="show-more-wrap">
            <button
              type="button"
              className="btn"
              disabled={loadingMore}
              onClick={() => loadPage({ offset: jobs.length, append: true }).catch(() => {})}
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          </div>
        )}

        {accountDetails && (
          <div className="account-details">
            <div className="account-details-head">
              <h3>
                <CopyableAccount
                  value={accountDetails.account}
                  setMessage={setMessage}
                  setError={setError}
                />
              </h3>
              <button type="button" className="btn btn-danger" onClick={deleteWholeAccount}>
                Delete account
              </button>
            </div>
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
                  {accountDetails.remaining} matching · showing {jobs.length}
                </div>
              </div>
              {accountDetails.notes ? (
                <div className="account-details-notes">
                  <div className="sub">Notes</div>
                  <div className="account-notes">{accountDetails.notes}</div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ActiveAccountsPage({ games, onRefresh, setError, setMessage }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [gameFilter, setGameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const accountsLenRef = useRef(0);
  accountsLenRef.current = accounts.length;

  const gameOptions = useMemo(() => gameSelectOptions(games), [games]);

  const queryOpts = useMemo(() => {
    const bounds = dateFilterBounds(dateFilter);
    return {
      gameId: gameFilter || undefined,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
    };
  }, [gameFilter, dateFilter]);

  const loadAccounts = async ({
    silent = false,
    append = false,
    offset = 0,
    limit = PAGE_SIZE,
  } = {}) => {
    if (!silent) {
      if (append) setLoadingMore(true);
      else setLoading(true);
    }
    try {
      const page = await api.activeAccounts({ ...queryOpts, limit, offset });
      const items = page.items || (Array.isArray(page) ? page : []);
      setAccounts((prev) => (append ? [...prev, ...items] : items));
      setTotal(page.total != null ? page.total : items.length);
      setHasMore(Boolean(page.has_more));
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadAccounts({ offset: 0 }).catch(() => {});
  }, [queryOpts]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      const keep = Math.max(PAGE_SIZE, accountsLenRef.current || PAGE_SIZE);
      loadAccounts({ silent: true, offset: 0, limit: keep }).catch(() => {});
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [queryOpts]);

  const dayGroups = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      const key = localDayKey(account.added_at) || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(account);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [accounts]);

  const hasFilters = Boolean(gameFilter || (dateFilter && dateFilter !== "all"));

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Active accounts</h2>
          <p className="sub">
            Pending/running accounts, grouped by the day they were added. Auto-refreshes every 5s.
          </p>
        </div>
        <div className="actions tight">
          <button type="button" className="btn" onClick={() => loadAccounts({ offset: 0 })}>
            Refresh
          </button>
          <Link className="btn" to="/jobs/scheduled">
            Scheduled
          </Link>
        </div>
      </div>
      <div className="panel-body">
        <div className="filters">
          <SearchableSelect
            label="Game"
            value={gameFilter}
            onChange={setGameFilter}
            options={gameOptions}
            allLabel="All games"
            placeholder="Search games…"
          />
          <div>
            <label>Added</label>
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
            <button
              type="button"
              className="btn"
              onClick={() => {
                setGameFilter("");
                setDateFilter("today");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        {loading && accounts.length === 0 && <p className="sub">Loading…</p>}
        {!loading && accounts.length === 0 && (
          <p className="sub">
            {hasFilters
              ? "No active accounts match these filters."
              : "No active accounts — everything finished or nothing scheduled."}
          </p>
        )}
        {accounts.length > 0 && (
          <div className="active-account-list">
            <p className="sub">
              Showing {accounts.length} of {total} active account{total === 1 ? "" : "s"}
              {dayGroups.length > 1 ? ` · ${dayGroups.length} days` : ""}
            </p>
            {dayGroups.map(([dayKey, dayAccounts]) => (
              <section key={dayKey} className="active-day-group">
                <div className="active-day-header">
                  <h3>{formatDayHeading(dayKey)}</h3>
                  <span className="sub">
                    {dayAccounts.length} account{dayAccounts.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="active-account-names">
                  {dayAccounts.map((account) => (
                    <li
                      key={`${account.account_name}-${account.game_id || "none"}`}
                      className="active-account-item"
                    >
                      <div>
                        <CopyableAccount
                          value={account.account_name}
                          setMessage={setMessage}
                          setError={setError}
                        />
                        <div className="sub">
                          {account.game_name ? `${account.game_name} · ` : ""}
                          added{" "}
                          {account.added_at
                            ? new Date(account.added_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </div>
                        {account.notes ? (
                          <div className="sub account-notes">{account.notes}</div>
                        ) : null}
                      </div>
                      <div className="actions tight">
                        <Link
                          className="btn btn-info"
                          to={`/jobs/scheduled?account=${encodeURIComponent(account.account_name)}`}
                        >
                          Open schedule
                        </Link>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={async () => {
                            if (
                              !(await confirmAction(
                                `Delete account "${account.account_name}" and all its jobs?`,
                                {
                                  title: "Delete account",
                                  confirmLabel: "Delete account",
                                  danger: true,
                                }
                              ))
                            ) {
                              return;
                            }
                            try {
                              const result = await api.deleteAccountByName(account.account_name);
                              setMessage(
                                `Deleted ${account.account_name} (${result.deleted_jobs} jobs).`
                              );
                              await Promise.all([
                                loadAccounts({
                                  silent: true,
                                  offset: 0,
                                  limit: Math.max(PAGE_SIZE, accountsLenRef.current || PAGE_SIZE),
                                }),
                                onRefresh(),
                              ]);
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
        {hasMore && (
          <div className="show-more-wrap">
            <button
              type="button"
              className="btn"
              disabled={loadingMore}
              onClick={() =>
                loadAccounts({ append: true, offset: accounts.length }).catch(() => {})
              }
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function FinishedAccountsPage({ onRefresh, setError, setMessage }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const accountsLenRef = useRef(0);
  accountsLenRef.current = accounts.length;

  const loadAccounts = async ({
    silent = false,
    append = false,
    offset = 0,
    limit = PAGE_SIZE,
  } = {}) => {
    if (!silent) {
      if (append) setLoadingMore(true);
      else setLoading(true);
    }
    try {
      const page = await api.finishedAccounts({ limit, offset });
      const items = page.items || (Array.isArray(page) ? page : []);
      setAccounts((prev) => (append ? [...prev, ...items] : items));
      setTotal(page.total != null ? page.total : items.length);
      setHasMore(Boolean(page.has_more));
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    loadAccounts({ offset: 0 });
  }, []);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      const keep = Math.max(PAGE_SIZE, accountsLenRef.current || PAGE_SIZE);
      loadAccounts({ silent: true, offset: 0, limit: keep });
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Finished accounts</h2>
          <p className="sub">
            Accounts whose plan jobs are all done or failed. Auto-removed after 20 days with jobs, history,
            request data, and unused account proxies. Auto-refreshes every 5s.
          </p>
        </div>
        <div className="actions tight">
          <button type="button" className="btn" onClick={() => loadAccounts({ offset: 0 })}>
            Refresh
          </button>
          {total > 0 && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={async () => {
                if (
                  !(await confirmAction(
                    `Delete all ${total} finished account(s)? This removes their jobs, history, request data, and unused account proxies.`,
                    { title: "Delete all finished", confirmLabel: "Delete all", danger: true }
                  ))
                ) {
                  return;
                }
                try {
                  const result = await api.deleteAllFinished();
                  const proxyPart =
                    result.deleted_proxies > 0 ? `, ${result.deleted_proxies} proxy(ies)` : "";
                  setMessage(
                    `Deleted ${result.deleted_accounts} finished account(s) (${result.deleted_jobs} jobs${proxyPart}).`
                  );
                  await Promise.all([loadAccounts({ offset: 0 }), onRefresh()]);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Delete all
            </button>
          )}
        </div>
      </div>
      <div className="panel-body">
        {loading && accounts.length === 0 && <p className="sub">Loading…</p>}
        {!loading && accounts.length === 0 && <p className="sub">No finished accounts yet.</p>}
        {accounts.length > 0 && (
          <p className="sub">
            Showing {accounts.length} of {total}
          </p>
        )}
        {accounts.length > 0 && (
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
                    <CopyableAccount
                      value={account.account_name}
                      setMessage={setMessage}
                      setError={setError}
                    />
                    {account.notes ? (
                      <div className="sub account-notes">{account.notes}</div>
                    ) : null}
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
                            !(await confirmAction(
                              `Delete all jobs for "${account.account_name}"? This also removes history, request data, and unused account proxies.`,
                              {
                                title: "Delete account jobs",
                                confirmLabel: "Delete",
                                danger: true,
                              }
                            ))
                          ) {
                            return;
                          }
                          api
                            .deleteBatch(account.batch_id)
                            .then(() => {
                              setMessage(
                                `Removed finished account ${account.account_name} (jobs, history, unused proxies).`
                              );
                              return Promise.all([
                                loadAccounts({
                                  offset: 0,
                                  limit: Math.max(PAGE_SIZE, accountsLenRef.current || PAGE_SIZE),
                                }),
                                onRefresh(),
                              ]);
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
        {hasMore && (
          <div className="show-more-wrap">
            <button
              type="button"
              className="btn"
              disabled={loadingMore}
              onClick={() =>
                loadAccounts({ append: true, offset: accounts.length }).catch(() => {})
              }
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ProxiesPage({ proxies: proxiesProp, settings, onRefresh, setError, setMessage }) {
  const emptyForm = {
    name: "",
    protocol: "http",
    host: "",
    port: "8080",
    username: "",
    password: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [proxies, setProxies] = useState(proxiesProp || []);
  const [proxyTotal, setProxyTotal] = useState((proxiesProp || []).length);
  const [proxyHasMore, setProxyHasMore] = useState(false);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyLoadingMore, setProxyLoadingMore] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingFleet, setEditingFleet] = useState(false);

  const loadProxies = async ({ offset = 0, append = false } = {}) => {
    if (append) setProxyLoadingMore(true);
    else setProxyLoading(true);
    try {
      const page = await api.proxies({ limit: PAGE_SIZE, offset });
      const items = page.items || (Array.isArray(page) ? page : []);
      setProxies((prev) => (append ? [...prev, ...items] : items));
      setProxyTotal(page.total != null ? page.total : items.length);
      setProxyHasMore(Boolean(page.has_more));
    } catch (err) {
      setError(err.message);
    } finally {
      setProxyLoading(false);
      setProxyLoadingMore(false);
    }
  };

  useEffect(() => {
    loadProxies({ offset: 0 }).catch(() => {});
  }, []);

  const refreshProxies = async () => {
    await loadProxies({ offset: 0 });
    await onRefresh?.();
  };
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
      await refreshProxies();
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
            {proxyTotal > 0 && (
              <p className="sub">
                Showing {proxies.length} of {proxyTotal}
              </p>
            )}
          </div>
          <button type="button" className="btn" onClick={() => loadProxies({ offset: 0 }).catch(() => {})}>
            Refresh
          </button>
        </div>
        <div className="panel-body">
          {proxyLoading && proxies.length === 0 && <p className="sub">Loading proxies…</p>}
          {!proxyLoading && proxies.length === 0 && <p className="sub">None yet.</p>}
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
                              return refreshProxies();
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
          {proxyHasMore && (
            <div className="show-more-wrap">
              <button
                type="button"
                className="btn"
                disabled={proxyLoadingMore}
                onClick={() => loadProxies({ offset: proxies.length, append: true }).catch(() => {})}
              >
                {proxyLoadingMore ? "Loading…" : "Show more"}
              </button>
            </div>
          )}
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
  const [openDetail, setOpenDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [resendingId, setResendingId] = useState(null);
  const runsLenRef = useRef(0);
  runsLenRef.current = runs.length;

  const historyQuery = useMemo(() => {
    const bounds = dateFilterBounds(dateFilter);
    return {
      gameId: gameId || undefined,
      account: account || undefined,
      kind: kindFilter || undefined,
      result: statusFilter || undefined,
      dateFrom: bounds.dateFrom,
      dateTo: bounds.dateTo,
    };
  }, [gameId, account, kindFilter, statusFilter, dateFilter]);

  const loadRuns = async ({ silent = false, append = false, offset = 0, limit = PAGE_SIZE } = {}) => {
    if (!silent) {
      if (append) setLoadingMore(true);
      else setListLoading(true);
    }
    try {
      const [page, accountList] = await Promise.all([
        api.runs({
          ...historyQuery,
          limit,
          offset,
        }),
        append ? Promise.resolve(null) : api.runAccounts(),
      ]);
      const items = page.items || (Array.isArray(page) ? page : []);
      setRuns((prev) => (append ? [...prev, ...items] : items));
      setTotal(page.total != null ? page.total : items.length);
      setHasMore(Boolean(page.has_more));
      if (accountList) setAccounts(accountList);
    } finally {
      if (!silent) {
        setListLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const openRun = async (runId) => {
    if (open === runId) {
      setOpen(null);
      setOpenDetail(null);
      return;
    }
    setOpen(runId);
    setOpenDetail(null);
    setDetailLoading(true);
    setError("");
    try {
      setOpenDetail(await api.runDetail(runId));
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const resendRun = async (run) => {
    if (!run?.job_id) {
      setError("Cannot resend — job is missing.");
      return;
    }
    if (
      !(await confirmAction(`Resend failed request for "${run.job_name || run.account_name}"?`, {
        title: "Resend request",
        confirmLabel: "Resend",
      }))
    ) {
      return;
    }
    setError("");
    setMessage("");
    setResendingId(run.id);
    try {
      const updated = await api.runNow(run.job_id, { from_run_id: run.id });
      if (updated?.status === "done") {
        setRuns((prev) =>
          prev.map((row) =>
            row.id === run.id
              ? { ...row, ok: true, error: null, status_code: row.status_code || 200 }
              : row
          )
        );
        setMessage(`Resent ${run.job_name || "request"} — now ok`);
      } else {
        setMessage(`Resent ${run.job_name || "request"} — still failed`);
      }
      const keep = Math.max(PAGE_SIZE, runsLenRef.current || PAGE_SIZE);
      await loadRuns({ silent: true, offset: 0, limit: keep });
    } catch (err) {
      setError(err.message);
    } finally {
      setResendingId(null);
    }
  };

  useEffect(() => {
    const fromQuery = searchParams.get("account") || "";
    if (fromQuery !== account) setAccount(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    loadRuns({ offset: 0 }).catch((err) => setError(err.message));
  }, [historyQuery]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      const keep = Math.max(PAGE_SIZE, runsLenRef.current || PAGE_SIZE);
      loadRuns({ silent: true, offset: 0, limit: keep }).catch(() => {});
    };
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, [historyQuery]);

  const accountOptions = useMemo(
    () => accounts.map((name) => ({ value: name, label: name })),
    [accounts]
  );
  const gameOptions = useMemo(() => gameSelectOptions(games), [games]);
  const filteredRuns = runs;
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
          <p className="sub">
            Finished accounts are removed automatically 20 days after they complete (jobs, history, request data, and unused account proxies).
          </p>
        </div>
        <button type="button" className="btn" onClick={() => loadRuns().catch((err) => setError(err.message))}>
          Refresh
        </button>
      </div>
      <div className="panel-body">
        {error && <p className="error">{error}</p>}
        {message && <p className="banner ok">{message}</p>}
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

        {listLoading && runs.length === 0 && <p className="sub">Loading history…</p>}
        {!listLoading && filteredRuns.length === 0 && (
          <p className="sub">No runs match these filters.</p>
        )}
        {runs.length > 0 && (
          <p className="sub">
            Showing {runs.length} of {total}
          </p>
        )}
        <table className="history-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Task</th>
              <th>Game</th>
              <th>Started</th>
              <th>Result</th>
              <th>Status code</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((run) => {
              const kind = run.request_kind || shortEndpoint(run.request_url || run.url) || "request";
              const task = jobTaskLabel(run);
              const isOpen = open === run.id;
              const detail = isOpen && openDetail?.id === run.id ? openDetail : null;
              const requestHeaders = detail?.request_headers
                ? JSON.stringify(detail.request_headers, null, 2)
                : "";
              const responseHeaders = detail?.response_headers
                ? JSON.stringify(detail.response_headers, null, 2)
                : "";
              return (
                <Fragment key={run.id}>
                  <tr
                    className={`history-row ${isOpen ? "open" : ""}`}
                    onClick={() => openRun(run.id).catch(() => {})}
                  >
                    <td>
                      <CopyableAccount value={run.account_name || "—"} setError={setError} />
                    </td>
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
                    <td>
                      {!run.ok && run.job_id ? (
                        <button
                          type="button"
                          className="btn btn-run"
                          disabled={resendingId === run.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            resendRun(run).catch(() => {});
                          }}
                        >
                          {resendingId === run.id ? "Resending…" : "Resend"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="history-expand-row">
                      <td colSpan={7}>
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
                            <div className="actions tight">
                              {!run.ok && run.job_id ? (
                                <button
                                  type="button"
                                  className="btn btn-run"
                                  disabled={resendingId === run.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    resendRun(run).catch(() => {});
                                  }}
                                >
                                  {resendingId === run.id ? "Resending…" : "Resend"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpen(null);
                                  setOpenDetail(null);
                                }}
                              >
                                Close
                              </button>
                            </div>
                          </div>
                          {detailLoading && !detail && <p className="sub">Loading details…</p>}
                          {detail?.error && (
                            <>
                              <h4>Error</h4>
                              <pre>{detail.error}</pre>
                            </>
                          )}
                          {detail && (
                            <>
                              <h4>Request</h4>
                              <div className="sub">
                                {detail.request_method || "?"} {detail.request_url || detail.url || ""}
                              </div>
                              <pre>{requestHeaders || "No request headers saved"}</pre>
                              <pre className="response-full">
                                {detail.request_body || "No request body"}
                              </pre>
                              <h4>Response headers</h4>
                              <pre>{responseHeaders || "No response headers saved"}</pre>
                              <h4>Full response body</h4>
                              <pre className="response-full">
                                {detail.response_body || detail.response_preview || "No body"}
                              </pre>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {hasMore && (
          <div className="show-more-wrap">
            <button
              type="button"
              className="btn"
              disabled={loadingMore}
              onClick={() =>
                loadRuns({ append: true, offset: runs.length }).catch((err) => setError(err.message))
              }
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
