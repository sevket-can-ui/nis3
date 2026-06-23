// src/ui.js — geteilte Design-Tokens und Bausteine
export const C = {
  bg: "#0D1117", surface: "#161B22", surface2: "#1C2129", border: "#21262D",
  borderLight: "#30363D", accent: "#58A6FF", accentDim: "rgba(88,166,255,0.1)",
  green: "#3FB950", greenDim: "rgba(63,185,80,0.12)", red: "#F85149", redDim: "rgba(248,81,73,0.12)",
  amber: "#D29922", amberDim: "rgba(210,153,34,0.12)", text: "#E6EDF3", muted: "#7D8590", mutedLight: "#9DA7B0",
};
export const MONO = "'DM Mono', 'SF Mono', Menlo, monospace";
export const SANS = "'Inter', -apple-system, sans-serif";
export const SCORE_COLOR = (s) => s >= 70 ? C.green : s >= 40 ? C.amber : C.red;
export const RISK_COLOR = { niedrig: C.green, mittel: C.amber, hoch: C.red, kritisch: C.red };
export const BEW_COLOR = { stark: C.green, mittel: C.amber, schwach: C.red, fehlend: C.red, ausreichend: C.green, "teilweise ausreichend": C.amber, hochgeladen: C.accent, "kritisch unvollständig": C.red };
export const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 };
export const btn = (v = "primary", extra = {}) => ({
  padding: "11px 20px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: SANS,
  fontWeight: 600, fontSize: 14, transition: "all 0.15s",
  background: v === "primary" ? C.accent : v === "ghost" ? "transparent" : C.surface2,
  color: v === "primary" ? "#fff" : v === "ghost" ? C.muted : C.text,
  ...(v === "ghost" || v === "sec" ? { border: `1px solid ${C.borderLight}` } : {}), ...extra,
});
export const inp = { width: "100%", background: C.bg, border: `1px solid ${C.borderLight}`, borderRadius: 7, padding: "11px 12px", fontSize: 15, color: C.text, fontFamily: SANS, boxSizing: "border-box" };
export const lbl = { fontSize: 12, color: C.muted, display: "block", marginBottom: 6, fontWeight: 500 };

export function safeParse(text) {
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch {}
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  return null;
}
