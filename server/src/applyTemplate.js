function replaceParam(text, key, value) {
  if (value == null) return String(text || "");
  let next = String(text || "");
  const encoded = encodeURIComponent(String(value));

  if (new RegExp(`${key}=`, "i").test(next)) {
    next = next.replace(new RegExp(`(${key}=)([^&]*)`, "i"), `$1${encoded}`);
  }

  if (new RegExp(`"${key}"\\s*:`, "i").test(next)) {
    next = next.replace(new RegExp(`("${key}"\\s*:\\s*")([^"]*)(")`, "i"), `$1${String(value)}$3`);
  }

  next = next.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi"), String(value));
  return next;
}

function requestKindFromUrl(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.includes("session")) return "session";
    if (path.includes("event")) return "event";
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || "request";
  } catch {
    const lower = String(url || "").toLowerCase();
    if (lower.includes("session")) return "session";
    if (lower.includes("event")) return "event";
    return "request";
  }
}

function withEndpoint(rawParts, kind) {
  let url = rawParts.url;
  try {
    const parsed = new URL(rawParts.url);
    parsed.pathname = `/${kind}`;
    url = parsed.toString();
  } catch {
    url = String(rawParts.url || "").replace(/\/(session|event)(\b|$)/i, `/${kind}$2`);
    if (!/\/(session|event)(\b|$)/i.test(String(rawParts.url || ""))) {
      url = `${String(rawParts.url || "").replace(/\/$/, "")}/${kind}`;
    }
  }
  return { ...rawParts, url };
}

function addTimeSpentNoise(value, noiseSeconds = 300) {
  const base = Number(value);
  if (!Number.isFinite(base)) return String(value ?? "");
  const span = Math.max(0, Number(noiseSeconds) || 0);
  const delta = Math.floor(Math.random() * (span * 2 + 1)) - span;
  return String(Math.max(0, Math.round(base + delta)));
}

function applyTemplate(rawParts, values) {
  const eventToken = values.event_token ?? values.value ?? "";
  const timeSpent = values.time_spent ?? values.time_value ?? "";

  const mapText = (text) => {
    let next = String(text || "");
    next = replaceParam(next, "event_token", eventToken);
    next = replaceParam(next, "time_spent", timeSpent);
    next = next.replace(/\{\{\s*value\s*\}\}/gi, String(eventToken));
    next = next.replace(/\{\{\s*time_value\s*\}\}/gi, String(timeSpent));
    if (values.variable_name) {
      next = next.replace(/\{\{\s*name\s*\}\}/gi, String(values.variable_name));
    }
    return next;
  };

  const headers = {};
  for (const [key, value] of Object.entries(rawParts.headers || {})) {
    headers[key] = mapText(value);
  }

  return {
    method: rawParts.method,
    url: mapText(rawParts.url),
    headers,
    body: mapText(rawParts.body),
  };
}

module.exports = {
  applyTemplate,
  withEndpoint,
  requestKindFromUrl,
  addTimeSpentNoise,
};
