const crypto = require("crypto");
const axios = require("axios");
const { query } = require("./db");
const { axiosProxyConfig } = require("./proxyAgent");

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
}

function countryCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
}

async function getFleetSettings() {
  const result = await query(
    `SELECT key, value FROM settings
     WHERE key IN (
       'fleet_host', 'fleet_port', 'fleet_user', 'fleet_pass', 'fleet_protocol'
     )`
  );
  const map = {};
  for (const row of result.rows) map[row.key] = row.value;
  let host = map.fleet_host || "residential-v2.fleetproxy.io";
  if (host === "v2.fleetproxy.io" || host === "fleetproxy.io") {
    host = "residential-v2.fleetproxy.io";
  }
  return {
    host,
    port: Number(map.fleet_port) || 5000,
    user: map.fleet_user || "",
    pass: map.fleet_pass || "",
    protocol: map.fleet_protocol || "http",
  };
}

/**
 * FleetProxy encodes targeting inside the username, e.g.
 * r_xxx-country-US-region-alaska-city-anchorage
 * Sticky keeps one exit IP via -session-...
 */
function buildFleetUsername(baseUser, targeting = {}) {
  const base = String(baseUser || "").trim();
  if (!base) throw new Error("FleetProxy username is missing. Add it in Settings.");

  let user = base.replace(/-(country|region|city|isp|session)-.*$/i, "");
  const country = countryCode(targeting.country);
  const region = slug(targeting.state);
  const city = slug(targeting.city);
  const isp = slug(targeting.isp);
  const rotation = String(targeting.rotation || "random").toLowerCase();

  if (country) user += `-country-${country}`;
  if (region) user += `-region-${region}`;
  if (city) user += `-city-${city}`;
  if (isp) user += `-isp-${isp}`;

  if (rotation === "sticky") {
    const session =
      slug(targeting.session) ||
      crypto.randomBytes(4).toString("hex");
    user += `-session-${session}`;
  }

  return user;
}

function buildFleetProxyConfig(targeting = {}, accountHint = "check") {
  return getFleetSettings().then((fleet) => {
    if (!fleet.user || !fleet.pass) {
      throw new Error(
        "FleetProxy is not configured. Open Settings and paste your FleetProxy username and password from the generator."
      );
    }
    if (!targeting.country) {
      throw new Error("Select a FleetProxy country.");
    }
    const sessionSeed = slug(accountHint) || crypto.randomBytes(3).toString("hex");
    const username = buildFleetUsername(fleet.user, {
      ...targeting,
      session: sessionSeed,
    });
    return {
      protocol: fleet.protocol || "http",
      host: fleet.host,
      port: fleet.port,
      username,
      password: fleet.pass,
    };
  });
}

async function testProxyConnection(proxy) {
  if (!proxy?.host || !proxy?.port) {
    throw new Error("Proxy host and port are required");
  }

  const started = Date.now();
  try {
    const response = await axios({
      method: "GET",
      url: "https://api.ipify.org?format=json",
      timeout: 20000,
      validateStatus: () => true,
      ...axiosProxyConfig(proxy),
    });
    const ms = Date.now() - started;
    if (response.status < 200 || response.status >= 400) {
      return {
        ok: false,
        status_code: response.status,
        ms,
        error: `Proxy responded with HTTP ${response.status}`,
        username: proxy.username || null,
      };
    }
    const ip =
      (response.data && response.data.ip) ||
      (typeof response.data === "string" ? response.data.trim() : null);
    return {
      ok: true,
      status_code: response.status,
      ms,
      ip: ip || null,
      username: proxy.username || null,
      host: proxy.host,
      port: proxy.port,
    };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: err.message || "Proxy check failed",
      username: proxy.username || null,
      host: proxy.host,
      port: proxy.port,
    };
  }
}

async function createFleetProxyForAccount(accountName, targeting = {}) {
  const proxy = await buildFleetProxyConfig(targeting, accountName);
  const country = countryCode(targeting.country);
  const labelParts = [
    country,
    slug(targeting.state),
    slug(targeting.city),
    slug(targeting.isp),
    String(targeting.rotation || "random"),
  ].filter(Boolean);
  const name = `Fleet · ${accountName} · ${labelParts.join(" · ")}`.slice(0, 180);

  const result = await query(
    `INSERT INTO proxies (name, protocol, host, port, username, password)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [name, proxy.protocol, proxy.host, proxy.port, proxy.username, proxy.password]
  );
  return result.rows[0];
}

module.exports = {
  getFleetSettings,
  buildFleetUsername,
  buildFleetProxyConfig,
  testProxyConnection,
  createFleetProxyForAccount,
};
