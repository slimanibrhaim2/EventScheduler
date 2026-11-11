function parseRawHttp(raw) {
  const text = String(raw || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    throw new Error("Request text is empty");
  }

  const [head, ...bodyParts] = text.split("\n\n");
  const lines = head.split("\n").filter((line) => line.length > 0);
  const requestLine = lines[0];
  const match = requestLine.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)/i);
  if (!match) {
    throw new Error("First line must look like: POST /event HTTP/2");
  }

  const method = match[1].toUpperCase();
  let url = match[2];
  const headers = {};

  for (const line of lines.slice(1)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    headers[key] = value;
  }

  if (!/^https?:\/\//i.test(url)) {
    const host = headers.Host || headers.host;
    if (!host) {
      throw new Error("Relative URL needs a Host header");
    }
    url = `https://${host}${url.startsWith("/") ? url : `/${url}`}`;
  }

  const skip = new Set(["host", "content-length", "connection", "transfer-encoding"]);
  const cleaned = {};
  for (const [key, value] of Object.entries(headers)) {
    if (skip.has(key.toLowerCase())) continue;
    cleaned[key] = value;
  }

  return {
    method,
    url,
    headers: cleaned,
    body: bodyParts.join("\n\n"),
  };
}

module.exports = { parseRawHttp };
