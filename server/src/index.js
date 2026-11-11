require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { migrate } = require("./db");
const { startScheduler } = require("./scheduler");
const jobs = require("./routes/jobs");
const proxies = require("./routes/proxies");
const runs = require("./routes/runs");
const games = require("./routes/games");
const plans = require("./routes/plans");
const settings = require("./routes/settings");

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

function asyncRouter(router) {
  router.stack.forEach((layer) => {
    if (layer.route) {
      layer.route.stack.forEach((handler) => {
        const fn = handler.handle;
        handler.handle = (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
      });
    }
  });
  return router;
}

app.use("/api/jobs", asyncRouter(jobs));
app.use("/api/proxies", asyncRouter(proxies));
app.use("/api/runs", asyncRouter(runs));
app.use("/api/games", asyncRouter(games));
app.use("/api/plans", asyncRouter(plans));
app.use("/api/settings", asyncRouter(settings));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

const port = Number(process.env.PORT || 4000);

migrate()
  .then(() => {
    app.listen(port, () => {
      console.log(`api listening on http://localhost:${port}`);
      startScheduler();
    });
  })
  .catch((err) => {
    console.error("database migrate failed:", err.message);
    process.exit(1);
  });
