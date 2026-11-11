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

export default function UsersPage({ setError, setMessage }) {
  const { appUser, isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (!isAdmin) {
    return (
      <section className="panel">
        <div className="panel-body">
          <p className="error">Admin only.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Users</h2>
          <p className="sub">Approve Google sign-ins before they can use the app.</p>
        </div>
        <button type="button" className="btn" onClick={() => load()}>
          Refresh
        </button>
      </div>
      <div className="panel-body">
        {loading && <p className="sub">Loading…</p>}
        {!loading && users.length === 0 && <p className="sub">No users yet.</p>}
        {!loading && users.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.display_name || user.email}</strong>
                    <div className="sub">{user.email}</div>
                  </td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`status ${user.status === "approved" ? "done" : user.status === "rejected" ? "failed" : "pending"}`}>
                      {user.status}
                    </span>
                  </td>
                  <td>
                    <DateTimeCell value={user.last_login_at} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {user.status !== "approved" && (
                        <button
                          type="button"
                          className="btn btn-run"
                          onClick={async () => {
                            try {
                              await api.updateUser(user.id, { status: "approved" });
                              setMessage(`Approved ${user.email}`);
                              await load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Approve
                        </button>
                      )}
                      {user.status !== "rejected" && user.id !== appUser?.id && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={async () => {
                            try {
                              await api.updateUser(user.id, { status: "rejected" });
                              setMessage(`Rejected ${user.email}`);
                              await load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Reject
                        </button>
                      )}
                      {user.role !== "admin" && user.status === "approved" && (
                        <button
                          type="button"
                          className="btn btn-info"
                          onClick={async () => {
                            try {
                              await api.updateUser(user.id, { role: "admin" });
                              setMessage(`${user.email} is now admin`);
                              await load();
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Make admin
                        </button>
                      )}
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
