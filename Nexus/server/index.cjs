
const express = require("express");
const fs = require("node:fs");
const path = require("path");

const app = express();
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "state.json");

app.use(express.json({ limit: "50mb" })); // photos are sent as base64; the old 100kb default silently rejected them

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "NEXUS API" });
});

app.get("/api/state", (req, res) => {
  try {
    res.json(JSON.parse(fs.readFileSync(dataFile, "utf8")));
  } catch {
    res.json({ donations: [], demands: [], deliveries: [] });
  }
});

app.put("/api/state", (req, res) => {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const state = {
      donations: Array.isArray(req.body.donations) ? req.body.donations : [],
      demands: Array.isArray(req.body.demands) ? req.body.demands : [],
      deliveries: Array.isArray(req.body.deliveries) ? req.body.deliveries : []
    };
    const tmp = dataFile + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, dataFile); // atomic: a crash mid-write never corrupts saved data
    try { fs.copyFileSync(dataFile, path.join(dataDir, "state.backup.json")); } catch {}
    res.json({ ok: true, message: "Saved successfully", savedAt: Date.now() });
  } catch {
    res.status(500).json({ ok: false, error: "Save failed" });
  }
});

app.get("/api/stats", (req, res) => {
  try {
    const st = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    res.json({ donations: st.donations.length, demands: st.demands.length, deliveries: st.deliveries.length,
      delivered: st.deliveries.filter(d => d.status === "Delivered").length, file: dataFile });
  } catch { res.json({ donations: 0, demands: 0, deliveries: 0, delivered: 0 }); }
});

const server = app.listen(4000, () => {
  console.log("NEXUS API running at http://localhost:4000 · data file:", dataFile);
});
server.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.log("NEXUS API already running on port 4000 — reusing it.");
  else throw e;
});
