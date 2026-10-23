const express = require("express");
const fs = require("node:fs");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.API_PORT || 4000);
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "state.json");

app.use(express.json({ limit: "2mb" }));

const emptyState = { donations: [], demands: [], deliveries: [] };
function readState() {
  try {
    if (!fs.existsSync(dataFile)) return emptyState;
    const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return {
      donations: Array.isArray(data.donations) ? data.donations : [],
      demands: Array.isArray(data.demands) ? data.demands : [],
      deliveries: Array.isArray(data.deliveries) ? data.deliveries : []
    };
  } catch (err) {
    console.error("Could not read state file:", err.message);
    return emptyState;
  }
}
function writeState(state) {
  fs.mkdirSync(dataDir, { recursive: true });
  const tempFile = `${dataFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tempFile, dataFile);
}
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "nexus-api", persistence: "json-file" }));
app.get("/api/state", (_req, res) => res.json(readState()));
app.put("/api/state", (req, res) => {
  const body = req.body || {};
  const state = {
    donations: Array.isArray(body.donations) ? body.donations : [],
    demands: Array.isArray(body.demands) ? body.demands : [],
    deliveries: Array.isArray(body.deliveries) ? body.deliveries : []
  };
  try {
    writeState(state);
    res.json({ ok: true, savedAt: new Date().toISOString(), counts: {
      donations: state.donations.length, demands: state.demands.length, deliveries: state.deliveries.length
    }});
  } catch (err) {
    console.error("Could not persist state:", err);
    res.status(500).json({ ok: false, error: "Could not save application state" });
  }
});
app.listen(PORT, "0.0.0.0", () => {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`NEXUS API listening on http://localhost:${PORT}`);
  console.log("Health check: http://localhost:" + PORT + "/api/health");
});
