import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

function startOfLocalDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

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

function formatDay(day) {
  if (!day) return "—";
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(day);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function periodLabel(filter) {
  if (filter === "today") return "Today";
  if (filter === "yesterday") return "Yesterday";
  if (filter === "7d") return "Last 7 days";
  return "All time";
}

export default function StatsPage({ setError }) {
  const { isOwner } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("today");

  const load = async () => {
    setLoading(true);
    try {
      const bounds = dateFilterBounds(dateFilter);
      setData(await api.ownerStats(bounds));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOwner) return;
    load().catch(() => {});
  }, [isOwner, dateFilter]);

  const maxDay = useMemo(() => {
    const rows = data?.accounts_by_day || [];
    return Math.max(1, ...rows.map((row) => Number(row.accounts) || 0));
  }, [data]);

  if (!isOwner) {
    return (
      <section className="panel">
        <div className="panel-body">
          <p className="error">Owner only. Admins and users cannot open statistics.</p>
        </div>
      </section>
    );
  }

  const summary = data?.summary || {};
  const label = periodLabel(dateFilter);

  return (
    <section className="panel settings-wide">
      <div className="panel-head">
        <div>
          <h2>Statistics</h2>
          <p className="sub">Owner overview — filter by period for ok / failed runs and accounts added.</p>
        </div>
        <div className="actions tight">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Stats period"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </select>
          <button type="button" className="btn" onClick={() => load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="panel-body stats-page">
        {loading && <p className="sub">Loading…</p>}

        {!loading && (
          <>
            <p className="sub stats-period-label">Showing: {label}</p>

            <div className="stats-summary">
              <div className="stats-metric">
                <div className="sub">Accounts added</div>
                <strong>{summary.accounts_in_period ?? summary.accounts_today ?? 0}</strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Runs ok</div>
                <strong className="stats-ok">{summary.runs_ok ?? 0}</strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Runs failed</div>
                <strong className="stats-failed">{summary.runs_failed ?? 0}</strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Success rate</div>
                <strong>
                  {summary.success_rate != null ? `${summary.success_rate}%` : "—"}
                </strong>
              </div>
            </div>

            <div className="stats-summary">
              <div className="stats-metric">
                <div className="sub">Sessions ok / failed</div>
                <strong>
                  {summary.sessions_ok ?? 0}
                  <span className="sub stats-inline"> / {summary.sessions_failed ?? 0}</span>
                </strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Events ok / failed</div>
                <strong>
                  {summary.events_ok ?? 0}
                  <span className="sub stats-inline"> / {summary.events_failed ?? 0}</span>
                </strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Active now</div>
                <strong>
                  {summary.active_accounts ?? 0}
                  <span className="sub stats-inline">
                    {" "}
                    accounts · {summary.active_jobs ?? 0} jobs
                  </span>
                </strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Users</div>
                <strong>
                  {summary.users_approved ?? 0}
                  <span className="sub stats-inline">
                    {" "}
                    approved · {summary.users_pending ?? 0} pending
                  </span>
                </strong>
              </div>
            </div>

            <div className="stats-summary">
              <div className="stats-metric">
                <div className="sub">Accounts total (all time)</div>
                <strong>{summary.accounts_total ?? 0}</strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Jobs (all time)</div>
                <strong>
                  {summary.jobs_total ?? 0}
                  <span className="sub stats-inline">
                    {" "}
                    · {summary.jobs_pending ?? 0} pending · {summary.jobs_done ?? 0} ok ·{" "}
                    {summary.jobs_failed ?? 0} failed
                  </span>
                </strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Runs in period</div>
                <strong>{summary.runs_total ?? 0}</strong>
              </div>
            </div>

            <div className="stats-block">
              <h3 className="settings-section-title">Accounts added per day</h3>
              <p className="sub">
                {dateFilter === "all"
                  ? "Last 30 days · each batch/account counted once on the day it was created."
                  : `${label} · each batch/account counted once on the day it was created.`}
              </p>
              {(data?.accounts_by_day || []).length === 0 ? (
                <p className="sub">No accounts in this period.</p>
              ) : (
                <div className="stats-day-list">
                  {data.accounts_by_day.map((row) => {
                    const count = Number(row.accounts) || 0;
                    const width = `${Math.max(8, (count / maxDay) * 100)}%`;
                    return (
                      <div key={row.day} className="stats-day-row">
                        <div className="stats-day-label">{formatDay(row.day)}</div>
                        <div className="stats-day-bar-wrap">
                          <div className="stats-day-bar" style={{ width }} />
                        </div>
                        <div className="stats-day-count">{count}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="stats-block">
              <h3 className="settings-section-title">Per user</h3>
              <p className="sub">Accounts added and run results for {label.toLowerCase()}.</p>
              {(data?.users || []).length === 0 ? (
                <p className="sub">No users yet.</p>
              ) : (
                <div className="stats-user-cards">
                  {(data?.users || []).map((user) => (
                    <article key={user.id} className="stats-user-card">
                      <div className="stats-user-identity">
                        <strong className="stats-user-email">{user.email}</strong>
                        <div className="sub">
                          {user.display_name ? `${user.display_name} · ` : ""}
                          {user.role} · {user.status}
                        </div>
                      </div>
                      <div className="stats-user-metrics">
                        <div>
                          <div className="sub">Accounts</div>
                          <strong>{user.accounts_in_period ?? 0}</strong>
                        </div>
                        <div>
                          <div className="sub">Ok</div>
                          <strong className="stats-ok">{user.runs_ok ?? 0}</strong>
                        </div>
                        <div>
                          <div className="sub">Failed</div>
                          <strong className="stats-failed">{user.runs_failed ?? 0}</strong>
                        </div>
                        <div>
                          <div className="sub">Jobs total</div>
                          <strong>{user.jobs_total ?? 0}</strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
