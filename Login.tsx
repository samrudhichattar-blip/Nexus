import { useState } from "react";
import "./Login.css";

const ROLES = [
  { key: "Donor", label: "Donor", emoji: "🍱", desc: "Restaurants, messes & pharmacies posting surplus", email: "donor@nexus.demo" },
  { key: "Shelter / Community Kitchen", label: "Shelter / Needy", emoji: "🏠", desc: "Camps & shelters requesting what they need", email: "shelter@nexus.demo" },
  { key: "Coordinator", label: "Coordinator", emoji: "🧭", desc: "Nexus team routing food before it spoils", email: "admin@nexus.demo" },
];

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [pick, setPick] = useState(0);
  const [email, setEmail] = useState(ROLES[0].email);
  const [pass, setPass] = useState("demo");
  const [busy, setBusy] = useState(false);

  const choose = (i: number) => { setPick(i); setEmail(ROLES[i].email); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      localStorage.setItem("nexus_session_role", ROLES[pick].key);
      localStorage.setItem("nexus_session_email", email);
    } catch { /* storage blocked */ }
    setTimeout(onLogin, 650);
  };

  return (
    <div className="lg-wrap">
      <div className="lg-blob b1" /><div className="lg-blob b2" /><div className="lg-blob b3" />
      <div className="lg-orbit"><span>🥖</span><span>🍎</span><span>🥛</span><span>🍚</span></div>

      <section className="lg-hero">
        <div className="lg-logo"><span className="lg-pulse" />N</div>
        <h1>Nexus</h1>
        <p>The connecting link between surplus food and people in need — delivered before it spoils.</p>
        <div className="lg-stats">
          <div><b>0%</b><span>food wasted in demo</span></div>
          <div><b>2-way</b><span>ghost detection</span></div>
          <div><b>Live</b><span>reroutes mid-trip</span></div>
        </div>
      </section>

      <form className="lg-card" onSubmit={submit}>
        <h2>Sign in</h2>
        <p className="lg-sub">Choose how you use Nexus</p>
        <div className="lg-roles">
          {ROLES.map((r, i) => (
            <button type="button" key={r.key} className={`lg-role ${pick === i ? "on" : ""}`} onClick={() => choose(i)} style={{ animationDelay: `${i * 90}ms` }}>
              <span className="lg-emoji">{r.emoji}</span>
              <span><strong>{r.label}</strong><small>{r.desc}</small></span>
            </button>
          ))}
        </div>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={pass} onChange={(e) => setPass(e.target.value)} type="password" required /></label>
        <button className="lg-go" disabled={busy}>{busy ? <span className="lg-spin" /> : `Continue as ${ROLES[pick].label} →`}</button>
        <p className="lg-hint">Demo accounts are pre-filled · password <code>demo</code></p>
      </form>
    </div>
  );
}
