import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Login from "./Login";
import "./index.css";
import "./enhance.css";

function Root() {
  const [authed, setAuthed] = useState(() => { try { return !!localStorage.getItem("nexus_session_role"); } catch { return false; } });
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return (
    <div className="nx-enter">
      <App />
      <button className="nx-logout" onClick={() => { try { localStorage.removeItem("nexus_session_role"); } catch {} setAuthed(false); }}>⎋ Logout</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
