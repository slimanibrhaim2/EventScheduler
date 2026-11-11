require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { migrate } = require("./db");
const { startScheduler } = require("./scheduler");
const { initFirebaseAdmin } = require("./authFirebase");
const { requireAuth, requireApproved } = require("./middleware/auth");
const auth = require("./routes/auth");
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
  res.json({ ok: true, firebase: initFirebaseAdmin() });
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

const protect = [requireAuth, requireApproved];

app.use("/api/auth", asyncRouter(auth));
app.use("/api/jobs", ...protect, asyncRouter(jobs));
app.use("/api/proxies", ...protect, asyncRouter(proxies));
app.use("/api/runs", ...protect, asyncRouter(runs));
app.use("/api/games", ...protect, asyncRouter(games));
app.use("/api/plans", ...protect, asyncRouter(plans));
app.use("/api/settings", ...protect, asyncRouter(settings));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

const port = Number(process.env.PORT || 4000);

migrate()
  .then(() => {
    initFirebaseAdmin();
    app.listen(port, () => {
      console.log(`api listening on http://localhost:${port}`);
      startScheduler();
    });
  })
  .catch((err) => {
    console.error("database migrate failed:", err.message);
    process.exit(1);
  });
