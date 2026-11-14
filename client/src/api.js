let authToken = null;
let refreshAuthToken = null;

export function setAuthToken(token) {
  authToken = token || null;
}

/** Register a callback that returns a fresh Firebase ID token (or null). */
export function setAuthTokenRefresher(fn) {
  refreshAuthToken = typeof fn === "function" ? fn : null;
}

async function request(path, options = {}, _retried = false) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(path, {
    ...options,
    headers,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Firebase ID tokens expire ~1h; refresh once and retry.
    if (res.status === 401 && !_retried && refreshAuthToken) {
      try {
        const next = await refreshAuthToken();
        if (next) {
          setAuthToken(next);
          return request(path, options, true);
        }
      } catch {
        // fall through to original error
      }
    }
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    err.user = data.user;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request("/api/auth/me"),
  users: () => request("/api/auth/users"),
  updateUser: (id, body) =>
    request(`/api/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  jobs: () => request("/api/jobs"),
  createJob: (body) => request("/api/jobs", { method: "POST", body: JSON.stringify(body) }),
  createJobsFromPlan: (body) =>
    request("/api/jobs/from-plan", { method: "POST", body: JSON.stringify(body) }),
  parseHttp: (raw) => request("/api/jobs/parse", { method: "POST", body: JSON.stringify({ raw }) }),
  runNow: (id) => request(`/api/jobs/${id}/run-now`, { method: "POST" }),
  deleteJob: (id) => request(`/api/jobs/${id}`, { method: "DELETE" }),
  finishedAccounts: () => request("/api/jobs/accounts/finished"),
  deleteBatch: (batchId) => request(`/api/jobs/batches/${batchId}`, { method: "DELETE" }),
  deleteAllFinished: () => request("/api/jobs/accounts/finished", { method: "DELETE" }),
  proxies: () => request("/api/proxies"),
  createProxy: (body) => request("/api/proxies", { method: "POST", body: JSON.stringify(body) }),
  updateProxy: (id, body) => request(`/api/proxies/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  testProxy: (body) => request("/api/proxies/test", { method: "POST", body: JSON.stringify(body) }),
  deleteProxy: (id) => request(`/api/proxies/${id}`, { method: "DELETE" }),
  runs: ({ gameId, account } = {}) => {
    const params = new URLSearchParams();
    if (gameId) params.set("game_id", gameId);
    if (account) params.set("account", account);
    const qs = params.toString();
    return request(`/api/runs${qs ? `?${qs}` : ""}`);
  },
  runAccounts: () => request("/api/runs/accounts"),
  games: () => request("/api/games"),
  createGame: (body) => request("/api/games", { method: "POST", body: JSON.stringify(body) }),
  updateGame: (id, body) => request(`/api/games/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteGame: (id) => request(`/api/games/${id}`, { method: "DELETE" }),
  plans: (gameId) => request(gameId ? `/api/plans?game_id=${gameId}` : "/api/plans"),
  getPlan: (id) => request(`/api/plans/${id}`),
  createPlan: (body) => request("/api/plans", { method: "POST", body: JSON.stringify(body) }),
  updatePlan: (id, body) => request(`/api/plans/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePlan: (id) => request(`/api/plans/${id}`, { method: "DELETE" }),
  settings: () => request("/api/settings"),
  saveSettings: (body) => request("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
  testTelegram: (body = {}) =>
    request("/api/settings/telegram-test", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  ownerStats: () => request("/api/stats"),
};
