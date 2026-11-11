/** Common FleetProxy country codes (username uses -country-XX). */
export const FLEET_COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "India" },
  { code: "ID", name: "Indonesia" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "PH", name: "Philippines" },
  { code: "MY", name: "Malaysia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "TR", name: "Turkey" },
  { code: "IL", name: "Israel" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "NG", name: "Nigeria" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "CZ", name: "Czechia" },
  { code: "RO", name: "Romania" },
  { code: "HU", name: "Hungary" },
  { code: "NZ", name: "New Zealand" },
];

/**
 * Local catalog of FleetProxy-style slugs (lowercase, no spaces).
 * FleetProxy does not publish a public API for these generator lists,
 * so we keep a curated copy (especially US) and allow custom slug typing.
 */
export const FLEET_REGIONS_BY_COUNTRY = {
  US: [
    { state: "alabama", cities: ["birmingham", "montgomery", "mobile", "huntsville"] },
    { state: "alaska", cities: ["anchorage", "fairbanks", "juneau"] },
    { state: "arizona", cities: ["phoenix", "tucson", "mesa", "scottsdale"] },
    { state: "arkansas", cities: ["littlerock", "fayetteville", "fortsmith"] },
    { state: "california", cities: ["losangeles", "sanfrancisco", "sandiego", "sacramento", "sanjose", "oakland", "fresno"] },
    { state: "colorado", cities: ["denver", "coloradosprings", "aurora", "boulder"] },
    { state: "connecticut", cities: ["bridgeport", "newhaven", "hartford", "stamford"] },
    { state: "delaware", cities: ["wilmington", "dover", "newark"] },
    { state: "florida", cities: ["miami", "orlando", "tampa", "jacksonville", "tallahassee"] },
    { state: "georgia", cities: ["atlanta", "savannah", "augusta", "columbus"] },
    { state: "hawaii", cities: ["honolulu", "hilo"] },
    { state: "idaho", cities: ["boise", "idahofalls"] },
    { state: "illinois", cities: ["chicago", "springfield", "aurora", "naperville"] },
    { state: "indiana", cities: ["indianapolis", "fortwayne", "evansville"] },
    { state: "iowa", cities: ["desmoines", "cedarrapids", "davenport"] },
    { state: "kansas", cities: ["wichita", "overlandpark", "kansascity"] },
    { state: "kentucky", cities: ["louisville", "lexington", "bowlinggreen"] },
    { state: "louisiana", cities: ["neworleans", "batonrouge", "shreveport"] },
    { state: "maine", cities: ["portland", "augusta", "lewiston"] },
    { state: "maryland", cities: ["baltimore", "annapolis", "frederick"] },
    { state: "massachusetts", cities: ["boston", "worcester", "springfield", "cambridge"] },
    { state: "michigan", cities: ["detroit", "grandrapids", "annarbor", "lansing"] },
    { state: "minnesota", cities: ["minneapolis", "stpaul", "rochester"] },
    { state: "mississippi", cities: ["jackson", "gulfport", "biloxi"] },
    { state: "missouri", cities: ["kansascity", "stlouis", "springfield"] },
    { state: "montana", cities: ["billings", "missoula", "greatfalls"] },
    { state: "nebraska", cities: ["omaha", "lincoln"] },
    { state: "nevada", cities: ["lasvegas", "reno", "henderson"] },
    { state: "newhampshire", cities: ["manchester", "nashua", "concord"] },
    { state: "newjersey", cities: ["newark", "jerseycity", "paterson", "trenton"] },
    { state: "newmexico", cities: ["albuquerque", "santafe", "lascruces"] },
    { state: "newyork", cities: ["newyork", "buffalo", "rochester", "albany", "syracuse"] },
    { state: "northcarolina", cities: ["charlotte", "raleigh", "durham", "greensboro"] },
    { state: "northdakota", cities: ["fargo", "bismarck"] },
    { state: "ohio", cities: ["columbus", "cleveland", "cincinnati", "toledo"] },
    { state: "oklahoma", cities: ["oklahomacity", "tulsa"] },
    { state: "oregon", cities: ["portland", "salem", "eugene"] },
    { state: "pennsylvania", cities: ["philadelphia", "pittsburgh", "allentown", "harrisburg"] },
    { state: "rhodeisland", cities: ["providence", "warwick"] },
    { state: "southcarolina", cities: ["columbia", "charleston", "greenville"] },
    { state: "southdakota", cities: ["siouxfalls", "rapidcity"] },
    { state: "tennessee", cities: ["nashville", "memphis", "knoxville", "chattanooga"] },
    { state: "texas", cities: ["houston", "dallas", "austin", "sanantonio", "fortworth"] },
    { state: "utah", cities: ["saltlakecity", "provo", "ogden"] },
    { state: "vermont", cities: ["burlington", "montpelier"] },
    { state: "virginia", cities: ["virginiabeach", "norfolk", "richmond", "arlington"] },
    { state: "washington", cities: ["seattle", "spokane", "tacoma", "bellevue"] },
    { state: "westvirginia", cities: ["charleston", "huntington"] },
    { state: "wisconsin", cities: ["milwaukee", "madison", "greenbay"] },
    { state: "wyoming", cities: ["cheyenne", "casper"] },
    { state: "districtofcolumbia", cities: ["washington"] },
  ],
  GB: [
    { state: "england", cities: ["london", "manchester", "birmingham", "liverpool", "leeds"] },
    { state: "scotland", cities: ["edinburgh", "glasgow"] },
    { state: "wales", cities: ["cardiff", "swansea"] },
    { state: "northernireland", cities: ["belfast"] },
  ],
  CA: [
    { state: "ontario", cities: ["toronto", "ottawa", "mississauga", "hamilton"] },
    { state: "quebec", cities: ["montreal", "quebeccity", "laval"] },
    { state: "britishcolumbia", cities: ["vancouver", "victoria", "burnaby"] },
    { state: "alberta", cities: ["calgary", "edmonton"] },
  ],
  AE: [
    { state: "abuzaby", cities: ["abudhabi"] },
    { state: "dubai", cities: ["dubai"] },
    { state: "ashshariqah", cities: ["sharjah"] },
  ],
  DE: [
    { state: "berlin", cities: ["berlin"] },
    { state: "bavaria", cities: ["munich", "nuremberg"] },
    { state: "hamburg", cities: ["hamburg"] },
    { state: "hesse", cities: ["frankfurt"] },
  ],
  FR: [
    { state: "iledefrance", cities: ["paris"] },
    { state: "provence", cities: ["marseille", "nice"] },
    { state: "auvergne", cities: ["lyon"] },
  ],
};

/** Common ISP / ASN style slugs users can pick; leave empty for random. */
export const FLEET_COMMON_ISPS = [
  "comcast",
  "verizon",
  "att",
  "spectrum",
  "cox",
  "centurylink",
  "frontier",
  "optimum",
  "t-mobile",
  "bt",
  "virginmedia",
  "skybroadband",
  "rogers",
  "bell",
  "telus",
];

/** Keep only the account prefix; targeting is added later per job. */
export function fleetBaseUsername(user) {
  return String(user || "")
    .trim()
    .replace(/-(country|region|city|isp|session)-.*$/i, "");
}

export function isFleetProxy(proxy) {
  const host = String(proxy?.host || "").toLowerCase();
  const name = String(proxy?.name || "");
  const user = String(proxy?.username || "");
  return (
    host.includes("fleetproxy.io") ||
    name.startsWith("Fleet ·") ||
    /-(country|region|city)-/i.test(user)
  );
}

/** Parse FleetProxy username targeting back into form fields. */
export function parseFleetUsername(username) {
  const raw = String(username || "").trim();
  const base = fleetBaseUsername(raw);
  const country = (raw.match(/-country-([A-Za-z]{2})/i) || [])[1]?.toUpperCase() || "";
  const state = (raw.match(/-region-([a-z0-9_-]+)/i) || [])[1] || "";
  const city = (raw.match(/-city-([a-z0-9_-]+)/i) || [])[1] || "";
  const isp = (raw.match(/-isp-([a-z0-9_-]+)/i) || [])[1] || "";
  const session = (raw.match(/-session-([a-z0-9_-]+)/i) || [])[1] || "";
  return {
    base,
    country: country || "US",
    state,
    city,
    isp,
    rotation: session ? "sticky" : "random",
    session,
  };
}

export function buildFleetUsernameClient(baseUser, targeting = {}) {
  let user = fleetBaseUsername(baseUser);
  if (!user) return "";
  const country = String(targeting.country || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 2);
  const region = String(targeting.state || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
  const city = String(targeting.city || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
  const isp = String(targeting.isp || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
  if (country) user += `-country-${country}`;
  if (region) user += `-region-${region}`;
  if (city) user += `-city-${city}`;
  if (isp) user += `-isp-${isp}`;
  if (String(targeting.rotation || "").toLowerCase() === "sticky") {
    const session =
      String(targeting.session || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "") || `s${Date.now().toString(36)}`;
    user += `-session-${session}`;
  }
  return user;
}

export function normalizeFleetHost(host) {
  const value = String(host || "").trim();
  if (!value) return "residential-v2.fleetproxy.io";
  if (value === "v2.fleetproxy.io" || value === "fleetproxy.io") {
    return "residential-v2.fleetproxy.io";
  }
  return value;
}

export function parseFleetProxyLine(line) {
  const text = String(line || "").trim();
  if (!text) return null;

  // user:pass@host:port
  const atMatch = text.match(/^(.*?):(.*?)@([^:]+):(\d+)$/);
  if (atMatch) {
    return {
      user: fleetBaseUsername(atMatch[1]),
      pass: atMatch[2],
      host: normalizeFleetHost(atMatch[3]),
      port: atMatch[4],
    };
  }

  // host:port:user:pass
  const parts = text.split(":");
  if (parts.length >= 4) {
    const [host, port, user, ...passParts] = parts;
    return {
      host: normalizeFleetHost(host),
      port,
      user: fleetBaseUsername(user),
      pass: passParts.join(":"),
    };
  }
  return null;
}

export function regionsForCountry(countryCode) {
  return FLEET_REGIONS_BY_COUNTRY[String(countryCode || "").toUpperCase()] || [];
}
