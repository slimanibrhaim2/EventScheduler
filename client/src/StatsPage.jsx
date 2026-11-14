import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

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

export default function StatsPage({ setError }) {
  const { isOwner } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setData(await api.ownerStats());
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
  }, [isOwner]);

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

  return (
    <section className="panel settings-wide">
      <div className="panel-head">
        <div>
          <h2>Statistics</h2>
          <p className="sub">Owner overview of accounts added across all users.</p>
        </div>
        <button type="button" className="btn" onClick={() => load()}>
          Refresh
        </button>
      </div>

      <div className="panel-body stats-page">
        {loading && <p className="sub">Loading…</p>}

        {!loading && (
          <>
            <div className="stats-summary">
              <div className="stats-metric">
                <div className="sub">Accounts today</div>
                <strong>{summary.accounts_today ?? 0}</strong>
              </div>
              <div className="stats-metric">
                <div className="sub">Accounts total</div>
                <strong>{summary.accounts_total ?? 0}</strong>
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
              <div className="stats-metric">
                <div className="sub">Jobs</div>
                <strong>
                  {summary.jobs_total ?? 0}
                  <span className="sub stats-inline">
                    {" "}
                    · {summary.jobs_pending ?? 0} pending · {summary.jobs_done ?? 0} ok ·{" "}
                    {summary.jobs_failed ?? 0} failed
                  </span>
                </strong>
              </div>
            </div>

            <div className="stats-block">
              <h3 className="settings-section-title">Accounts added per day</h3>
              <p className="sub">Last 30 days · each batch/account counted once on the day it was created.</p>
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
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Today</th>
                    <th>Last 7 days</th>
                    <th>Total accounts</th>
                    <th>Jobs</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.users || []).map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>{user.email}</strong>
                        <div className="sub">
                          {user.display_name ? `${user.display_name} · ` : ""}
                          {user.role} · {user.status}
                        </div>
                      </td>
                      <td>{user.accounts_today}</td>
                      <td>{user.accounts_7d}</td>
                      <td>{user.accounts_total}</td>
                      <td>{user.jobs_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
