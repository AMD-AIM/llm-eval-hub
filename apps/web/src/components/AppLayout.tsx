import {
  Activity,
  Braces,
  Database,
  Gauge,
  KeyRound,
  Menu,
  Play,
  Server,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { getApiKey, setApiKey } from "../api/client";
import { Modal } from "./Modal";

const navItems = [
  { to: "/", label: "Overview", icon: Gauge, end: true },
  { to: "/endpoints", label: "Endpoints", icon: Server },
  { to: "/datasets", label: "Datasets", icon: Database },
  { to: "/evaluations/new", label: "New Evaluation", icon: Play },
  { to: "/runs", label: "Runs", icon: Activity },
];

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [apiKey, updateApiKey] = useState(getApiKey());

  const saveKey = () => {
    setApiKey(apiKey.trim());
    setKeyOpen(false);
    window.location.reload();
  };

  return (
    <div className="app-shell">
      <aside className={menuOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark"><Braces size={18} /></span>
          <div><strong>LLM Eval Hub</strong><small>Internal Quality Lab</small></div>
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} title="Close navigation">
            <X size={18} />
          </button>
        </div>
        <nav>
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}>
              <Icon size={17} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="environment-dot" />
          <div><strong>Local Environment</strong><small>Phase 1 · v0.1.0</small></div>
        </div>
      </aside>
      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <div className="content-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} title="Open navigation">
            <Menu size={19} />
          </button>
          <span className="topbar-context">Model API Evaluation Console</span>
          <button className="quiet-button" onClick={() => setKeyOpen(true)}>
            <KeyRound size={15} /> API Credentials
          </button>
        </header>
        <main><Outlet /></main>
      </div>
      <Modal title="API Credentials" open={keyOpen} onClose={() => setKeyOpen(false)}>
        <div className="form-stack">
          <label>Admin API Key<input type="password" value={apiKey} onChange={(e) => updateApiKey(e.target.value)} /></label>
          <div className="form-actions"><button className="primary-button" onClick={saveKey}>Save</button></div>
        </div>
      </Modal>
    </div>
  );
}
