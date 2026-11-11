const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { SocksProxyAgent } = require("socks-proxy-agent");

function proxyUrl(proxy) {
  const protocol = (proxy.protocol || "http").replace(/:$/, "");
  const auth = proxy.username
    ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || "")}@`
    : "";
  return `${protocol}://${auth}${proxy.host}:${proxy.port}`;
}

function axiosProxyConfig(proxy) {
  if (!proxy || !proxy.host || !proxy.port) return {};

  const url = proxyUrl(proxy);
  const protocol = (proxy.protocol || "http").toLowerCase();

  if (protocol.startsWith("socks")) {
    const agent = new SocksProxyAgent(url);
    return { httpAgent: agent, httpsAgent: agent, proxy: false };
  }

  return {
    httpAgent: new HttpProxyAgent(url),
    httpsAgent: new HttpsProxyAgent(url),
    proxy: false,
  };
}

module.exports = { axiosProxyConfig };
