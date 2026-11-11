async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  jobs: () => request("/api/jobs"),
  createJob: (body) => request("/api/jobs", { method: "POST", body: JSON.stringify(body) }),
  createJobsFromPlan: (body) =>
    request("/api/jobs/from-plan", { method: "POST", body: JSON.stringify(body) }),
  parseHttp: (raw) => request("/api/jobs/parse", { method: "POST", body: JSON.stringify({ raw }) }),
  runNow: (id) => request(`/api/jobs/${id}/run-now`, { method: "POST" }),
  deleteJob: (id) => request(`/api/jobs/${id}`, { method: "DELETE" }),
  finishedAccounts: () => request("/api/jobs/accounts/finished"),
  deleteBatch: (batchId) => request(`/api/jobs/batches/${batchId}`, { method: "DELETE" }),
  proxies: () => request("/api/proxies"),
  createProxy: (body) => request("/api/proxies", { method: "POST", body: JSON.stringify(body) }),
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
};
