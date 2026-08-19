import { useState } from "react";
import { C } from "../lib/constants";

export default function ImportPreviewModal({ rows, existingNames, onConfirm, onClose }) {
  const existingLower = existingNames.map((n) => n.toLowerCase());
  const [checked, setChecked] = useState(() =>
    Object.fromEntries(rows.map((r, i) => [i, !existingLower.includes(r.name.toLowerCase())]))
  );
  const [busy, setBusy] = useState(false);

  const selectedCount = Object.values(checked).filter(Boolean).length;
  const hasTutorCols = rows.some((r) => r.tutorName || r.tutorPhone);

  function toggle(i) {
    setChecked((p) => ({ ...p, [i]: !p[i] }));
  }

  function toggleAll(value) {
    setChecked(Object.fromEntries(rows.map((_, i) => [i, value])));
  }

  async function confirm() {
    const selected = rows.filter((_, i) => checked[i]);
    if (!selected.length) return;
    setBusy(true);
    await onConfirm(selected);
    setBusy(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeUp .2s ease" }}>
      <div style={{ background: C.card, border: `1px solid ${C.accent}55`, borderRadius: 20, padding: "24px", width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: `${C.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📥</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Revisar importación</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
              {rows.length} detectados en el archivo{hasTutorCols ? " · con tutor/teléfono" : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button className="btn" onClick={() => toggleAll(true)} style={{ background: "none", color: C.accent, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontFamily: "inherit" }}>
            Marcar todos
          </button>
          <button className="btn" onClick={() => toggleAll(false)} style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontFamily: "inherit" }}>
            Desmarcar todos
          </button>
          <span style={{ marginLeft: "auto", fontSize: 12, color: C.muted, alignSelf: "center" }}>{selectedCount} seleccionados</span>
        </div>

        <div style={{ overflowY: "auto", flex: 1, display: "grid", gap: 6, marginBottom: 16, paddingRight: 4 }}>
          {rows.map((r, i) => {
            const isDup = existingLower.includes(r.name.toLowerCase());
            return (
              <label
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                  background: C.surface, border: `1px solid ${isDup ? C.warning + "55" : C.border}`,
                  borderRadius: 10, cursor: "pointer", opacity: checked[i] ? 1 : 0.55,
                }}
              >
                <input type="checkbox" checked={!!checked[i]} onChange={() => toggle(i)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  {(r.tutorName || r.tutorPhone) && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {r.tutorName && `👤 ${r.tutorName}`} {r.tutorPhone && `📱 ${r.tutorPhone}`}
                    </div>
                  )}
                </div>
                {isDup && (
                  <span style={{ background: `${C.warning}22`, color: C.warning, border: `1px solid ${C.warning}44`, borderRadius: 6, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    Ya existe
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={confirm} disabled={busy || selectedCount === 0}
            style={{ flex: 1, background: `linear-gradient(135deg,${C.accent},${C.purple})`, color: "#fff", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, fontFamily: "inherit", opacity: busy || selectedCount === 0 ? 0.6 : 1 }}>
            {busy ? "Importando..." : `Importar ${selectedCount || ""}`.trim()}
          </button>
          <button className="btn" onClick={onClose} style={{ background: "none", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 18px", fontSize: 14, fontFamily: "inherit" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
