import { useState, useMemo, useRef, useEffect } from "react";
import {
  STAT_ORDER, DISTRICT_COLORS, DISTRICT_INDUSTRIES,
  computeOverall, computeArchetype,
} from "../rosterData.js";

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          "#f5f0e8",
  surface:     "#ede8dc",
  surfaceHi:   "#e4dece",
  border:      "#c8bfa8",
  borderDark:  "#a89878",
  ink:         "#1a1410",
  inkMid:      "#4a3e32",
  inkDim:      "#7a6858",
  amber:       "#b8820a",
  amberDim:    "#8a6108",
  amberLight:  "#f0e0b0",
  danger:      "#a82020",
  swap:        "#107888",
  swapLight:   "#d0eef2",
};
const mono = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";

function tierColor(t) {
  return t === "FAVORED" ? C.amber : t === "LONGSHOT" ? "#6a7a8a" : C.inkDim;
}

// ─── component ────────────────────────────────────────────────────────────────
export default function TributeCards({
  roster, setRoster, focusName, setFocusName, onViewArena, editMode = false,
}) {
  const [sort,    setSort]    = useState("overall");
  const [editId,  setEditId]  = useState(null);
  const [draft,   setDraft]   = useState(null);
  const [swapId,  setSwapId]  = useState(null);
  const focusRef = useRef(null);

  // scroll focused card into view
  useEffect(() => {
    if (focusName && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      setFocusName(null);
    }
  }, [focusName, setFocusName]);

  // derived tribute data with seeds and tiers
  const tributes = useMemo(() => {
    const derived = roster.map(t => {
      const [tag, line] = computeArchetype(t.stats, t.district);
      return { ...t, overall: computeOverall(t.stats), tag, line };
    });
    const ranked = [...derived].sort((a, b) => b.overall - a.overall);
    ranked.forEach((t, i) => {
      t.seed = i + 1;
      t.tier = i < 5 ? "FAVORED" : i < 10 ? "IN PLAY" : "LONGSHOT";
    });
    if (sort === "district")
      return [...ranked].sort((a, b) => a.district - b.district || a.name.localeCompare(b.name));
    return ranked;
  }, [roster, sort]);

  // ── edit handlers ──────────────────────────────────────────────────────────
  const startEdit = t => {
    setEditId(t.id);
    setDraft({ ...t, stats: { ...t.stats } });
  };

  const cancelEdit = () => { setEditId(null); setDraft(null); };

  const saveDraft = () => {
    setRoster(prev => prev.map(t => t.id === editId ? { ...draft } : t));
    setEditId(null);
    setDraft(null);
  };

  const setDraftField = (field, val) =>
    setDraft(d => ({ ...d, [field]: val }));

  const setDraftStat = (key, val) =>
    setDraft(d => ({ ...d, stats: { ...d.stats, [key]: Number(val) } }));

  // ── swap handlers ──────────────────────────────────────────────────────────
  const handleSwap = id => {
    if (swapId === null) { setSwapId(id); return; }
    if (swapId === id)   { setSwapId(null); return; }
    setRoster(prev => {
      const r = [...prev];
      const ai = r.findIndex(t => t.id === swapId);
      const bi = r.findIndex(t => t.id === id);
      [r[ai], r[bi]] = [r[bi], r[ai]];
      return r;
    });
    setSwapId(null);
  };

  // ── export ─────────────────────────────────────────────────────────────────
  const exportRoster = () => {
    const rows = roster.map(t => [
      t.name, t.district,
      t.stats.judge, t.stats.sponsor, t.stats.advantages,
      t.stats.kill, t.stats.fight, t.stats.survival,
    ]);
    const blob = new Blob(
      ["// Paste this into arena_sim.py as ROSTER:\n", JSON.stringify(rows, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "roster_export.json" });
    a.click(); URL.revokeObjectURL(url);
  };

  const resetRoster = () => {
    import("../rosterData.js").then(m => {
      setRoster(m.DEFAULT_ROSTER.map(t => ({ ...t, stats: { ...t.stats } })));
      setEditId(null); setDraft(null); setSwapId(null);
    });
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* header */}
      <div style={S.header}>
        <div>
          <div style={S.kicker}>CAPITOL ARCHIVE · TRIBUTE REGISTRY</div>
          <div style={S.title}>{editMode ? "MANAGE ROSTER" : "THE TRIBUTES"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {editMode && (
            <>
              <button style={S.actionBtn} onClick={exportRoster}>EXPORT JSON</button>
              <button style={{ ...S.actionBtn, color: C.danger, borderColor: C.danger }}
                onClick={resetRoster}>RESET</button>
            </>
          )}
          {swapId && (
            <span style={{ fontSize: 9, letterSpacing: 1.5, color: C.swap, fontWeight: 700,
              background: C.swapLight, padding: "5px 10px", borderRadius: 3 }}>
              SWAP ACTIVE — click another tribute to exchange
            </span>
          )}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <span style={{ fontSize: 9, letterSpacing: 1.5, color: C.inkDim }}>SORT</span>
            {[["overall", "BY THREAT"], ["district", "BY DISTRICT"]].map(([k, label]) => (
              <button key={k} style={{ ...S.sortBtn, ...(sort === k ? S.sortOn : {}) }}
                onClick={() => setSort(k)}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* card grid */}
      <div style={S.grid}>
        {tributes.map(t => {
          const isFocused = t.name === focusName;
          const isEditing = editMode && editId === t.id;
          const isSwapSrc = swapId === t.id;
          const hue = DISTRICT_COLORS[t.district] || C.amber;

          return (
            <div
              key={t.id}
              ref={isFocused ? focusRef : null}
              className="tcard"
              style={{
                ...S.card,
                borderTop: `3px solid ${hue}`,
                outline: isFocused ? `2px solid ${C.amber}` : isSwapSrc ? `2px solid ${C.swap}` : "none",
                outlineOffset: 2,
              }}
            >
              {/* tier stamp */}
              <div style={{ ...S.stamp, color: tierColor(t.tier), borderColor: tierColor(t.tier) }}>
                {t.tier}
              </div>

              {/* card head */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ ...S.distBadge, color: hue, borderColor: hue }}>
                  {String(t.district).padStart(2, "0")}
                </span>
                <span style={S.industry}>{DISTRICT_INDUSTRIES[t.district]}</span>
              </div>

              {isEditing ? (
                <EditPanel draft={draft} setDraftField={setDraftField} setDraftStat={setDraftStat}
                  hue={hue} onSave={saveDraft} onCancel={cancelEdit} />
              ) : (
                <ReadPanel t={t} hue={hue} editMode={editMode}
                  onStartEdit={() => startEdit(t)}
                  onSwap={() => handleSwap(t.id)}
                  isSwapSrc={isSwapSrc}
                  swapPending={swapId !== null}
                  onViewArena={() => onViewArena(t.name)} />
              )}
            </div>
          );
        })}
      </div>

      <div style={S.foot}>
        {roster.length} TRIBUTES · ONE VICTOR · THREAT = WEIGHTED PROJECTION, NOT DESTINY
      </div>
    </div>
  );
}

// ─── read panel (card display) ─────────────────────────────────────────────────
function ReadPanel({ t, hue, editMode, onStartEdit, onSwap, isSwapSrc, swapPending, onViewArena }) {
  return (
    <>
      <div style={S.name}>{t.name}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        margin: "10px 0 10px" }}>
        <div>
          <div style={S.metaLabel}>SEED</div>
          <div style={S.metaVal}>#{t.seed}<span style={S.metaSub}>/15</span></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={S.metaLabel}>THREAT RATING</div>
          <div style={{ ...S.metaVal, color: hue }}>{t.overall}</div>
        </div>
      </div>

      <div style={{ ...S.tag, color: hue, borderColor: hue + "66" }}>{t.tag}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 12 }}>
        {STAT_ORDER.map(([key, lab, max]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 8, letterSpacing: 1.2, color: C.inkDim, width: 54 }}>{lab}</span>
            <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(t.stats[key] / max) * 100}%`,
                background: hue, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.inkMid, width: 14, textAlign: "right" }}>
              {t.stats[key]}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 10.5, color: C.inkDim, lineHeight: 1.5, marginTop: 12,
        paddingTop: 10, borderTop: `1px solid ${C.border}`, fontStyle: "italic" }}>
        {t.line}
      </div>

      {/* action row */}
      <div style={{ display: "flex", gap: 5, marginTop: 12, flexWrap: "wrap" }}>
        <button style={S.cardBtn} onClick={onViewArena}>VIEW IN ARENA</button>
        {editMode && (
          <>
            <button style={S.cardBtn} onClick={onStartEdit}>EDIT</button>
            <button
              style={{
                ...S.cardBtn,
                color: isSwapSrc ? "#fff" : C.swap,
                borderColor: C.swap,
                background: isSwapSrc ? C.swap : swapPending ? C.swapLight : "transparent",
              }}
              onClick={onSwap}
            >
              {isSwapSrc ? "CANCEL SWAP" : "SWAP"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── edit panel (inline editor) ────────────────────────────────────────────────
function EditPanel({ draft, setDraftField, setDraftStat, hue, onSave, onCancel }) {
  const liveOverall = computeOverall(draft.stats);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
        <span style={{ ...S.editingBadge }}>EDITING</span>
        <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>
          Threat: {liveOverall}
        </span>
      </div>

      {/* name */}
      <label style={S.fieldLabel}>NAME</label>
      <input
        type="text"
        value={draft.name}
        onChange={e => setDraftField("name", e.target.value)}
        style={{ ...S.textInput, width: "100%", marginBottom: 8 }}
      />

      {/* district */}
      <label style={S.fieldLabel}>DISTRICT</label>
      <select
        value={draft.district}
        onChange={e => setDraftField("district", Number(e.target.value))}
        style={{ ...S.textInput, width: "100%", marginBottom: 12 }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(d => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {/* stat sliders */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {STAT_ORDER.map(([key, lab, max]) => (
          <div key={key}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 8, letterSpacing: 1.5, color: C.inkDim }}>{lab}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: hue }}>{draft.stats[key]}</span>
            </div>
            <input
              type="range" min={1} max={max} value={draft.stats[key]}
              onChange={e => setDraftStat(key, e.target.value)}
              style={{ width: "100%", accentColor: hue }}
            />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
        <button style={{ ...S.saveBtn, background: hue, borderColor: hue }}
          onClick={onSave}>SAVE</button>
        <button style={S.cancelBtn} onClick={onCancel}>CANCEL</button>
      </div>
    </div>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  root: { background: C.bg, color: C.ink, fontFamily: mono,
    minHeight: "calc(100vh - 48px)", padding: "20px 16px", boxSizing: "border-box" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end",
    flexWrap: "wrap", gap: 12, paddingBottom: 16,
    borderBottom: `2px solid ${C.border}`, marginBottom: 18 },
  kicker: { fontSize: 9, letterSpacing: 3, color: C.amberDim, fontWeight: 700 },
  title:  { fontSize: 28, fontWeight: 900, letterSpacing: 6, marginTop: 4 },

  sortBtn: { background: "transparent", color: C.inkDim, border: `1px solid ${C.border}`,
    fontFamily: mono, fontSize: 8, letterSpacing: 1.5, padding: "5px 10px",
    cursor: "pointer", borderRadius: 3 },
  sortOn: { color: C.amber, borderColor: C.amberDim, background: C.amberLight },
  actionBtn: { background: "transparent", color: C.amber, border: `1px solid ${C.amberDim}`,
    fontFamily: mono, fontSize: 8, letterSpacing: 1.5, padding: "5px 10px",
    cursor: "pointer", borderRadius: 3, fontWeight: 700 },

  grid: { display: "grid", gap: 12,
    gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" },

  card: { position: "relative", background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 4, padding: 16, overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
    transition: "transform 0.12s, box-shadow 0.12s" },
  stamp: { position: "absolute", top: 18, right: -28, transform: "rotate(34deg)",
    border: "1.5px solid", borderRadius: 2, fontSize: 7.5, letterSpacing: 1.5,
    padding: "2px 32px", fontWeight: 700, opacity: 0.8 },

  distBadge: { fontSize: 12, fontWeight: 800, border: "1.5px solid",
    borderRadius: 3, padding: "1px 6px", letterSpacing: 1 },
  industry: { fontSize: 8, letterSpacing: 1.5, color: C.inkDim, textTransform: "uppercase" },
  name: { fontSize: 22, fontWeight: 800, letterSpacing: 0.5 },
  metaLabel: { fontSize: 8, letterSpacing: 2, color: C.inkDim },
  metaVal: { fontSize: 20, fontWeight: 800, letterSpacing: 1, lineHeight: 1.1 },
  metaSub: { fontSize: 11, color: C.inkDim, fontWeight: 400 },
  tag: { display: "inline-block", fontSize: 9, fontWeight: 700, letterSpacing: 2,
    border: "1px solid", borderRadius: 2, padding: "3px 8px" },

  cardBtn: { background: "transparent", color: C.inkDim, border: `1px solid ${C.border}`,
    fontFamily: mono, fontSize: 8, letterSpacing: 1.5, padding: "5px 9px",
    cursor: "pointer", borderRadius: 3, fontWeight: 700 },

  editingBadge: { background: C.amber, color: "#fff", fontSize: 8, letterSpacing: 2,
    padding: "2px 7px", borderRadius: 2, fontWeight: 700 },
  fieldLabel: { display: "block", fontSize: 8, letterSpacing: 2, color: C.inkDim,
    marginBottom: 3, fontWeight: 700 },
  textInput: { background: C.bg, color: C.ink, border: `1px solid ${C.border}`,
    borderRadius: 3, padding: "5px 8px", fontFamily: mono, fontSize: 12 },
  saveBtn: { flex: 1, color: "#fff", border: "1.5px solid",
    fontFamily: mono, fontSize: 9, letterSpacing: 2, padding: "7px 0",
    cursor: "pointer", borderRadius: 3, fontWeight: 700 },
  cancelBtn: { flex: 1, background: "transparent", color: C.inkDim,
    border: `1px solid ${C.border}`, fontFamily: mono, fontSize: 9, letterSpacing: 2,
    padding: "7px 0", cursor: "pointer", borderRadius: 3 },

  foot: { marginTop: 20, paddingTop: 14, borderTop: `1px solid ${C.border}`,
    fontSize: 8, letterSpacing: 2, color: C.inkDim, textAlign: "center" },
};

const CSS = `
  .tcard:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12) !important; }
`;
