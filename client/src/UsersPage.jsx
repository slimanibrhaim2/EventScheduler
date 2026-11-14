import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

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

function roleLabel(role) {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  return "user";
}

export default function UsersPage({ setError, setMessage }) {
  const { appUser, isAdmin, isOwner } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await api.users());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const updateUser = async (user, patch, successMessage) => {
    setBusyId(user.id);
    setError("");
    try {
      await api.updateUser(user.id, patch);
      setMessage(successMessage);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <section className="panel">
        <div className="panel-body">
          <p className="error">Admin only. Normal users cannot open this page.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Users</h2>
          <p className="sub">
            {isOwner
              ? "Owner can approve as admin or user, and switch roles anytime."
              : "Admins can approve new people as normal users only."}
          </p>
        </div>
        <button type="button" className="btn" onClick={() => load()}>
          Refresh
        </button>
      </div>
      <div className="panel-body">
        {loading && <p className="sub">Loading…</p>}
        {!loading && users.length === 0 && <p className="sub">No users yet.</p>}
        {!loading && users.length > 0 && (
          <div className="user-cards">
            {users.map((user) => {
              const isTargetOwner = user.role === "owner";
              const pending = user.status === "pending" || user.status === "rejected";
              const approved = user.status === "approved";
              const busy = busyId === user.id;

              const canReject =
                !isTargetOwner &&
                user.status !== "rejected" &&
                user.id !== appUser?.id &&
                (user.role !== "admin" || isOwner);

              const canApproveAsUser = !isTargetOwner && pending;
              const canApproveAsAdmin = isOwner && !isTargetOwner && pending;
              const canMakeAdmin =
                isOwner && !isTargetOwner && approved && user.role === "user";
              const canMakeUser =
                isOwner && !isTargetOwner && approved && user.role === "admin";

              return (
                <article key={user.id} className="user-card">
                  <div className="user-card-top">
                    <div className="user-card-identity">
                      <strong>{user.display_name || user.email}</strong>
                      <div className="sub user-card-email">{user.email}</div>
                    </div>
                    <div className="user-card-badges">
                      <span className={`role-pill role-${user.role}`}>{roleLabel(user.role)}</span>
                      <span
                        className={`status ${
                          user.status === "approved"
                            ? "done"
                            : user.status === "rejected"
                              ? "failed"
                              : "pending"
                        }`}
                      >
                        {user.status}
                      </span>
                    </div>
                  </div>

                  <div className="user-card-meta">
                    <div>
                      <div className="sub">Signed up</div>
                      <DateTimeCell value={user.created_at} />
                    </div>
                    <div>
                      <div className="sub">Last login</div>
                      <DateTimeCell value={user.last_login_at} />
                    </div>
                  </div>

                  <div className="row-actions user-card-actions">
                    {isTargetOwner ? (
                      <span className="sub">Protected</span>
                    ) : (
                      <>
                        {canApproveAsUser && (
                          <button
                            type="button"
                            className="btn btn-run"
                            disabled={busy}
                            onClick={() =>
                              updateUser(
                                user,
                                isOwner
                                  ? { status: "approved", role: "user" }
                                  : { status: "approved" },
                                `Approved ${user.email} as user`
                              )
                            }
                          >
                            {isOwner ? "Accept as user" : "Approve"}
                          </button>
                        )}
                        {canApproveAsAdmin && (
                          <button
                            type="button"
                            className="btn btn-info"
                            disabled={busy}
                            onClick={() =>
                              updateUser(
                                user,
                                { status: "approved", role: "admin" },
                                `Approved ${user.email} as admin`
                              )
                            }
                          >
                            Accept as admin
                          </button>
                        )}
                        {canMakeAdmin && (
                          <button
                            type="button"
                            className="btn btn-info"
                            disabled={busy}
                            onClick={() =>
                              updateUser(user, { role: "admin" }, `${user.email} is now admin`)
                            }
                          >
                            Make admin
                          </button>
                        )}
                        {canMakeUser && (
                          <button
                            type="button"
                            className="btn"
                            disabled={busy}
                            onClick={() =>
                              updateUser(
                                user,
                                { role: "user" },
                                `${user.email} is now a normal user`
                              )
                            }
                          >
                            Make user
                          </button>
                        )}
                        {canReject && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={busy}
                            onClick={() =>
                              updateUser(
                                user,
                                { status: "rejected" },
                                `Rejected ${user.email}`
                              )
                            }
                          >
                            Reject
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
