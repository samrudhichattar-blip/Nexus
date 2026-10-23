
const express = require("express");
const fs = require("node:fs");
const path = require("path");

const app = express();
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "state.json");

app.use(express.json());

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
    fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
    res.json({ ok: true, message: "Saved successfully" });
  } catch {
    res.status(500).json({ ok: false, error: "Save failed" });
  }
});

app.listen(4000, () => {
  console.log("NEXUS API running at http://localhost:4000");
});
