import { useState } from "react";
import ArenaConsole from "./ArenaConsole.jsx";
import TributeCards from "./assets/TributeCards.jsx";
import { DEFAULT_ROSTER } from "./rosterData.js";

const mono = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
const C = { bg: "#f5f0e8", nav: "#ede8dc", border: "#c8bfa8", ink: "#1a1410", inkDim: "#7a6858", amber: "#b8820a" };

const TABS = [
  ["arena",  "ARENA FEED"],
  ["cards",  "TRIBUTE CARDS"],
  ["roster", "MANAGE ROSTER"],
];

export default function App() {
  const [tab, setTab]           = useState("arena");
  const [roster, setRoster]     = useState(DEFAULT_ROSTER);
  const [focusName, setFocusName] = useState(null);

  const goToCard  = (name) => { setFocusName(name); setTab("cards"); };
  const goToArena = (name) => { setFocusName(name); setTab("arena"); };

  return (
    <div style={{ fontFamily: mono, background: C.bg, color: C.ink, minHeight: "100vh" }}>
      <nav style={{
        background: C.nav, borderBottom: `2px solid ${C.border}`,
        display: "flex", alignItems: "stretch", padding: "0 16px",
        position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}>
        <div style={{
          display: "flex", alignItems: "center",
          padding: "0 20px 0 4px", borderRight: `1px solid ${C.border}`,
          marginRight: 6,
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 5, color: C.amber }}>
            THE HUNGER GAMES
          </span>
        </div>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: 2,
            color: tab === k ? C.amber : C.inkDim,
            padding: "14px 16px 12px",
            borderBottom: tab === k ? `2px solid ${C.amber}` : "2px solid transparent",
            marginBottom: "-2px",
            transition: "color 0.12s",
          }}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "arena" && (
        <ArenaConsole roster={roster} onViewCard={goToCard} focusName={focusName} setFocusName={setFocusName} />
      )}
      {tab === "cards" && (
        <TributeCards roster={roster} setRoster={setRoster}
          focusName={focusName} setFocusName={setFocusName}
          onViewArena={goToArena} editMode={false} />
      )}
      {tab === "roster" && (
        <TributeCards roster={roster} setRoster={setRoster}
          focusName={focusName} setFocusName={setFocusName}
          onViewArena={goToArena} editMode={true} />
      )}
    </div>
  );
}
