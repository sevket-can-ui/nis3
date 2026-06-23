import { useState, useRef } from "react";
import { DOCUMENT_GUIDE, GLOSSARY } from "./knowledge";

// ─── Design Tokens — Audit-Werkzeug, aber zugänglich ───
const C = {
  bg: "#0D1117", surface: "#161B22", surface2: "#1C2129", border: "#21262D",
  borderLight: "#30363D", accent: "#58A6FF", accentDim: "rgba(88,166,255,0.1)",
  green: "#3FB950", greenDim: "rgba(63,185,80,0.12)", red: "#F85149", redDim: "rgba(248,81,73,0.12)",
  amber: "#D29922", amberDim: "rgba(210,153,34,0.12)", text: "#E6EDF3", muted: "#7D8590", mutedLight: "#9DA7B0",
};
const MONO = "'DM Mono', 'SF Mono', Menlo, monospace";
const SANS = "'Inter', -apple-system, sans-serif";

const SCORE_COLOR = (s) => s >= 70 ? C.green : s >= 40 ? C.amber : C.red;
const RISK_COLOR = { niedrig: C.green, mittel: C.amber, hoch: C.red, kritisch: C.red };
const BEW_COLOR = { stark: C.green, mittel: C.amber, schwach: C.red, fehlend: C.red };

async function extractText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (["txt", "csv", "md"].includes(ext)) return await file.text();
  if (ext === "pdf") {
    const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs";
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(" ") + "\n";
    }
    return text;
  }
  if (ext === "docx") {
    const mammoth = await import("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
    const buf = await file.arrayBuffer();
    return (await mammoth.extractRawText({ arrayBuffer: buf })).value;
  }
  throw new Error("Format nicht unterstützt: " + ext);
}

function safeParse(text) {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    return null;
  }
}

const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 };
const btn = (v = "primary", extra = {}) => ({
  padding: "11px 20px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: SANS,
  fontWeight: 600, fontSize: 14, transition: "all 0.15s",
  background: v === "primary" ? C.accent : v === "ghost" ? "transparent" : C.surface2,
  color: v === "primary" ? "#fff" : v === "ghost" ? C.muted : C.text,
  ...(v === "ghost" || v === "sec" ? { border: `1px solid ${C.borderLight}` } : {}), ...extra,
});
const inp = { width: "100%", background: C.bg, border: `1px solid ${C.borderLight}`, borderRadius: 7, padding: "10px 12px", fontSize: 14, color: C.text, fontFamily: SANS, boxSizing: "border-box" };
const lbl = { fontSize: 12, color: C.muted, display: "block", marginBottom: 6, fontWeight: 500 };

function ScoreBar({ score, size = "md" }) {
  const col = SCORE_COLOR(score);
  const h = size === "lg" ? 10 : 6;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flex: 1, height: h, background: C.surface2, borderRadius: h, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: col, borderRadius: h, transition: "width 1s cubic-bezier(.4,0,.2,1)" }} />
      </div>
      <span style={{ fontFamily: MONO, fontSize: size === "lg" ? 18 : 14, fontWeight: 500, color: col, minWidth: 44, textAlign: "right" }}>{score}</span>
    </div>
  );
}

function Pill({ label, color }) {
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: `${color}1f`, color, border: `1px solid ${color}40`, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</span>;
}

// Begriff mit Klartext-Erklärung (klickbar)
function Term({ children, k, onOpen }) {
  return (
    <button onClick={() => onOpen(k)} style={{ background: "none", border: "none", borderBottom: `1px dotted ${C.accent}`, color: C.accent, cursor: "help", fontSize: "inherit", fontFamily: "inherit", padding: 0 }}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════
export default function App() {
  const [page, setPage] = useState("home");
  const [glossarTerm, setGlossarTerm] = useState(null); // aktiver Begriff im Glossar-Popup
  const [glossarOpen, setGlossarOpen] = useState(false);

  const [profil, setProfil] = useState({
    name: "", branche: "", mitarbeiter: "", umsatz: "", bilanz: "", rolle: "", kritischeDienste: "",
  });
  const [betroffenheit, setBetroffenheit] = useState(null);
  const [loadingBetroffen, setLoadingBetroffen] = useState(false);

  const [evidences, setEvidences] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileRef = useRef();
  const [pendingType, setPendingType] = useState(DOCUMENT_GUIDE[0].name);
  const [error, setError] = useState("");

  const openTerm = (k) => { setGlossarTerm(k); setGlossarOpen(true); };

  const pruefeBetroffenheit = async () => {
    setLoadingBetroffen(true); setError("");
    try {
      const res = await fetch("/api/betroffenheit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profil }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const parsed = safeParse(data.result);
      if (!parsed) throw new Error("Antwort konnte nicht verarbeitet werden");
      setBetroffenheit(parsed);
    } catch (e) { setError(e.message); }
    setLoadingBetroffen(false);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true); setError(""); setUploadStatus("Dokument wird gelesen…");
    const entry = { name: file.name, type: pendingType, result: null, status: "processing" };
    setEvidences(prev => [entry, ...prev]);
    try {
      const text = await extractText(file);
      if (!text || text.trim().length < 20) throw new Error("Das Dokument enthält zu wenig Text zum Prüfen.");
      setUploadStatus("KI prüft den Nachweis…");
      const res = await fetch("/api/evidence-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: text, documentName: file.name, documentType: pendingType, firma: profil.name, branche: profil.branche }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const parsed = safeParse(data.result);
      if (!parsed) throw new Error("Analyse konnte nicht verarbeitet werden");
      setEvidences(prev => prev.map(e => e.name === file.name && e.status === "processing" ? { ...e, result: parsed, status: "done" } : e));
    } catch (e) {
      setError(e.message);
      setEvidences(prev => prev.map(ev => ev.name === file.name && ev.status === "processing" ? { ...ev, status: "error", errorMsg: e.message } : ev));
    }
    setUploading(false); setUploadStatus("");
  };

  const doneEvidences = evidences.filter(e => e.status === "done" && e.result);
  const avgEvidence = doneEvidences.length ? Math.round(doneEvidences.reduce((s, e) => s + (e.result.evidenceScore || 0), 0) / doneEvidences.length) : null;
  const geprüfteTypen = new Set(doneEvidences.map(e => e.type));
  const fehlendeDocs = DOCUMENT_GUIDE.filter(d => !geprüfteTypen.has(d.name));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0% { background-position:-400px 0; } 100% { background-position:400px 0; } }
        .fade { animation: fadeUp 0.35s ease forwards; }
        button:hover { filter: brightness(1.1); }
        button:active { transform: scale(0.98); }
        input:focus, select:focus { outline:none; border-color:${C.accent}!important; }
        ::-webkit-scrollbar { width:8px; height:8px; } ::-webkit-scrollbar-track { background:${C.bg}; }
        ::-webkit-scrollbar-thumb { background:${C.borderLight}; border-radius:8px; }
        .skel { background:linear-gradient(90deg,${C.surface2} 0px,${C.border} 200px,${C.surface2} 400px); background-size:800px; animation:shimmer 1.4s infinite; }
      `}</style>

      {/* Glossar-Popup */}
      {glossarOpen && (
        <div onClick={() => setGlossarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 440, width: "100%", borderColor: C.accent }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.accent }}>BEGRIFF ERKLÄRT</div>
              <button onClick={() => setGlossarOpen(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{glossarTerm}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: C.text }}>{GLOSSARY[glossarTerm]}</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, background: `${C.bg}f0`, backdropFilter: "blur(8px)", zIndex: 50 }}>
        <button onClick={() => setPage("home")} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", color: C.text, cursor: "pointer" }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 500, fontSize: 13, color: "#fff" }}>N2</div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.2px", lineHeight: 1 }}>NIS2 Agent</div>
            <div style={{ fontSize: 10, color: C.muted, fontFamily: MONO, marginTop: 2 }}>Schritt für Schritt zur Compliance</div>
          </div>
        </button>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[["home", "Start"], ["anleitung", "Anleitung"], ["profil", "1 · Betroffenheit"], ["evidence", "2 · Dokumente prüfen"], ["dashboard", "3 · Ergebnis"]].map(([k, l]) => (
            <button key={k} onClick={() => setPage(k)} style={{ padding: "7px 12px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", fontFamily: SANS, background: page === k ? C.surface2 : "transparent", color: page === k ? C.text : C.muted }}>{l}</button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* ════ HOME ════ */}
        {page === "home" && (
          <div className="fade">
            <div style={{ marginBottom: 40 }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 16, letterSpacing: "0.5px" }}>// IHR GEFÜHRTER WEG DURCH NIS2</div>
              <h1 style={{ fontSize: "clamp(28px,4.5vw,42px)", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 16 }}>
                NIS2 verstehen, ohne<br />Experte zu sein.
              </h1>
              <p style={{ fontSize: 16, color: C.mutedLight, lineHeight: 1.7, maxWidth: 580 }}>
                Dieser Assistent führt Sie Schritt für Schritt durch die <Term k="NIS2" onOpen={openTerm}>NIS2</Term>-Anforderungen. Sie laden Ihre echten Dokumente hoch, wir prüfen sie kritisch und sagen Ihnen in Klartext, was fehlt — mit konkreten nächsten Schritten. Jeder Fachbegriff ist erklärt.
              </p>
            </div>

            {/* 3 Schritte */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { n: "01", t: "Bin ich betroffen?", d: "Wenige Fragen zu Ihrem Unternehmen. Wir sagen Ihnen, ob und wie NIS2 für Sie gilt.", k: "profil" },
                { n: "02", t: "Dokumente prüfen", d: "Laden Sie hoch, was Sie haben. Die KI bewertet, ob es einer Prüfung standhält.", k: "evidence" },
                { n: "03", t: "Ergebnis & Plan", d: "Ihr Reifegrad auf einen Blick, mit priorisierten nächsten Schritten.", k: "dashboard" },
              ].map(m => (
                <div key={m.n} style={{ ...card }}>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 12 }}>{m.n}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{m.t}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{m.d}</div>
                </div>
              ))}
            </div>

            <div style={{ ...card, borderColor: C.accent, background: C.accentDim, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Neu bei NIS2? Lesen Sie zuerst die Anleitung.</div>
                  <div style={{ fontSize: 13, color: C.muted }}>Sie erfahren genau, welche Dokumente Sie brauchen und was jeder Begriff bedeutet.</div>
                </div>
                <button onClick={() => setPage("anleitung")} style={btn("primary")}>Zur Anleitung →</button>
              </div>
            </div>
            <button onClick={() => setPage("profil")} style={btn("sec", { width: "100%", padding: "13px" })}>Direkt mit Schritt 1 starten →</button>
          </div>
        )}

        {/* ════ ANLEITUNG ════ */}
        {page === "anleitung" && (
          <div className="fade">
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Anleitung</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>Welche Dokumente brauchen Sie für NIS2? Hier ist jedes erklärt — in Klartext, ohne Fachchinesisch.</p>

            {/* Dokumenten-Guide */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
              {DOCUMENT_GUIDE.map(doc => (
                <details key={doc.id} style={{ ...card, cursor: "pointer" }}>
                  <summary style={{ display: "flex", alignItems: "center", gap: 14, listStyle: "none", cursor: "pointer" }}>
                    <div style={{ fontSize: 26 }}>{doc.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{doc.name}</div>
                      <div style={{ fontSize: 13, color: C.muted }}>{doc.kurz}</div>
                    </div>
                    <div style={{ color: C.muted, fontSize: 18 }}>›</div>
                  </summary>
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 14, lineHeight: 1.7, color: C.text, marginBottom: 18 }}>{doc.laie}</div>

                    <div style={{ padding: 14, background: C.amberDim, borderRadius: 8, border: `1px solid ${C.amber}30`, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 6 }}>WARUM NIS2 DAS VERLANGT</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text }}>{doc.warum}</div>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Das muss drin sein</div>
                    {doc.mussRein.map((m, i) => (
                      <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 18, position: "relative" }}>
                        <span style={{ position: "absolute", left: 0, color: C.green }}>✓</span>{m}
                      </div>
                    ))}

                    <div style={{ padding: 14, background: C.bg, borderRadius: 8, marginTop: 16 }}>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}><strong style={{ color: C.accent }}>💡 Tipp: </strong>{doc.tipp}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: MONO, marginTop: 12 }}>📎 {doc.nis2}</div>
                  </div>
                </details>
              ))}
            </div>

            {/* Glossar */}
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Begriffe-Lexikon</h3>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>Alle Fachbegriffe in einem Satz erklärt.</p>
            <div style={{ ...card }}>
              {Object.entries(GLOSSARY).map(([term, def], i, arr) => (
                <div key={term} style={{ padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.accent, marginBottom: 4 }}>{term}</div>
                  <div style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6 }}>{def}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setPage("profil")} style={btn("primary", { width: "100%", marginTop: 24, padding: "13px" })}>Verstanden — mit Schritt 1 starten →</button>
          </div>
        )}

        {/* ════ PROFIL + BETROFFENHEIT ════ */}
        {page === "profil" && (
          <div className="fade">
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 8 }}>SCHRITT 1 VON 3</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Sind Sie von NIS2 betroffen?</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>Beantworten Sie ein paar Fragen zu Ihrem Unternehmen. Wir sagen Ihnen, ob NIS2 für Sie gilt und als welche Art von Einrichtung.</p>

            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div><label style={lbl}>Unternehmensname</label><input style={inp} value={profil.name} onChange={e => setProfil({ ...profil, name: e.target.value })} placeholder="Mustermann GmbH" /></div>
                <div><label style={lbl}>Branche / Sektor</label>
                  <select style={inp} value={profil.branche} onChange={e => setProfil({ ...profil, branche: e.target.value })}>
                    <option value="">Wählen…</option>
                    <optgroup label="Besonders kritisch (Anlage 1)">
                      {["Energie", "Verkehr", "Finanzwesen", "Gesundheitswesen", "Trinkwasser", "Abwasser", "Digitale Infrastruktur", "IKT-Dienste", "Öffentliche Verwaltung", "Weltraum"].map(b => <option key={b}>{b}</option>)}
                    </optgroup>
                    <optgroup label="Kritisch (Anlage 2)">
                      {["Post & Kurier", "Abfallbewirtschaftung", "Chemie", "Lebensmittel", "Verarbeitendes Gewerbe", "Digitale Dienste", "Forschung"].map(b => <option key={b}>{b}</option>)}
                    </optgroup>
                    <option value="Sonstige">Sonstige / nicht gelistet</option>
                  </select>
                </div>
                <div><label style={lbl}>Wie viele Mitarbeiter?</label>
                  <select style={inp} value={profil.mitarbeiter} onChange={e => setProfil({ ...profil, mitarbeiter: e.target.value })}>
                    <option value="">Wählen…</option>{["1–49", "50–249", "250–999", "1000+"].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Jahresumsatz</label>
                  <select style={inp} value={profil.umsatz} onChange={e => setProfil({ ...profil, umsatz: e.target.value })}>
                    <option value="">Wählen…</option>{["< 10 Mio €", "10–50 Mio €", "> 50 Mio €"].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Bilanzsumme</label>
                  <select style={inp} value={profil.bilanz} onChange={e => setProfil({ ...profil, bilanz: e.target.value })}>
                    <option value="">Wählen…</option>{["< 10 Mio €", "10–43 Mio €", "> 43 Mio €"].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Ihre Rolle</label>
                  <select style={inp} value={profil.rolle} onChange={e => setProfil({ ...profil, rolle: e.target.value })}>
                    <option value="">Wählen…</option>{["Betreiber kritischer Dienste", "IT-Dienstleister", "Zulieferer", "Digitaler Anbieter", "Sonstiges"].map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={lbl}>Was macht Ihr Unternehmen? (hilft bei der Einschätzung)</label>
                <input style={inp} value={profil.kritischeDienste} onChange={e => setProfil({ ...profil, kritischeDienste: e.target.value })} placeholder="z.B. Wir versorgen 200.000 Menschen mit Trinkwasser" />
              </div>
            </div>

            <button onClick={pruefeBetroffenheit} disabled={loadingBetroffen || !profil.branche || !profil.mitarbeiter} style={btn(profil.branche && profil.mitarbeiter ? "primary" : "sec", { width: "100%", padding: "13px", opacity: (!profil.branche || !profil.mitarbeiter) ? 0.5 : 1 })}>
              {loadingBetroffen ? "Wird geprüft…" : "Jetzt prüfen: Bin ich betroffen?"}
            </button>

            {error && <div style={{ marginTop: 16, padding: "12px 16px", background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, fontSize: 13, color: C.red }}>{error}</div>}

            {betroffenheit && (
              <div className="fade" style={{ ...card, marginTop: 24, borderColor: betroffenheit.status === "betroffen" ? C.red : betroffenheit.status === "nicht_betroffen" ? C.green : C.amber }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                  <Pill label={betroffenheit.status?.replace(/_/g, " ")} color={betroffenheit.status === "betroffen" ? C.red : betroffenheit.status === "nicht_betroffen" ? C.green : C.amber} />
                  {betroffenheit.einstufung && !["keine", "unklar"].includes(betroffenheit.einstufung) && <Pill label={betroffenheit.einstufung?.replace(/_/g, " ")} color={C.accent} />}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 18 }}>{betroffenheit.begruendung}</div>
                {betroffenheit.offeneFragen?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Das sollten Sie noch klären</div>
                    {betroffenheit.offeneFragen.map((f, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 4, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.amber }}>?</span>{f}</div>)}
                  </div>
                )}
                <div style={{ padding: 14, background: C.bg, borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 6 }}>→ Was Sie jetzt tun sollten</div>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>{betroffenheit.handlungsempfehlung}</div>
                  {betroffenheit.fristen && <div style={{ fontSize: 13, color: C.amber, marginTop: 8, fontFamily: MONO }}>⏱ {betroffenheit.fristen}</div>}
                </div>
                {betroffenheit.status !== "nicht_betroffen" && <button onClick={() => setPage("evidence")} style={btn("primary", { width: "100%" })}>Weiter zu Schritt 2: Dokumente prüfen →</button>}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 12, fontStyle: "italic" }}>{betroffenheit.rechtshinweis}</div>
              </div>
            )}
          </div>
        )}

        {/* ════ EVIDENCE ════ */}
        {page === "evidence" && (
          <div className="fade">
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 8 }}>SCHRITT 2 VON 3</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Dokumente prüfen lassen</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>
              Laden Sie Ihre vorhandenen Dokumente hoch. Die KI prüft kritisch, ob sie als Nachweis taugen — und sagt Ihnen in Klartext, was fehlt. <button onClick={() => setPage("anleitung")} style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", fontSize: 14, textDecoration: "underline" }}>Welche Dokumente brauche ich?</button>
            </p>

            {/* Fortschritt: welche Dokumente noch fehlen */}
            <div style={{ ...card, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Ihre Checkliste</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DOCUMENT_GUIDE.map(doc => {
                  const geprüft = geprüfteTypen.has(doc.name);
                  return (
                    <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: 12, border: `1px solid ${geprüft ? C.green : C.borderLight}`, background: geprüft ? C.greenDim : "transparent", color: geprüft ? C.green : C.muted }}>
                      <span>{geprüft ? "✓" : doc.icon}</span>{doc.name}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upload */}
            <div style={{ ...card, marginBottom: 24 }}>
              <label style={lbl}>Welches Dokument laden Sie hoch?</label>
              <select style={{ ...inp, marginBottom: 16 }} value={pendingType} onChange={e => setPendingType(e.target.value)}>
                {DOCUMENT_GUIDE.map(d => <option key={d.id}>{d.name}</option>)}
                <option>Sonstiges</option>
              </select>

              <div onClick={() => !uploading && fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                style={{ border: `2px dashed ${C.borderLight}`, borderRadius: 10, padding: "36px 24px", textAlign: "center", cursor: uploading ? "default" : "pointer", background: C.bg }}>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.csv,.md" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                {uploading ? (
                  <div>
                    <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: C.mutedLight, fontFamily: MONO }}>{uploadStatus}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Datei hierher ziehen oder klicken zum Auswählen</div>
                    <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO }}>PDF · Word · Text</div>
                  </div>
                )}
              </div>
            </div>

            {error && <div style={{ marginBottom: 20, padding: "12px 16px", background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, fontSize: 13, color: C.red }}>{error}</div>}

            {evidences.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                {evidences.map((ev, i) => <EvidenceCard key={i} ev={ev} />)}
              </div>
            )}

            {doneEvidences.length > 0 && (
              <button onClick={() => setPage("dashboard")} style={btn("primary", { width: "100%", padding: "13px" })}>Weiter zu Schritt 3: Ihr Ergebnis →</button>
            )}
          </div>
        )}

        {/* ════ DASHBOARD ════ */}
        {page === "dashboard" && (
          <div className="fade">
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 8 }}>SCHRITT 3 VON 3</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Ihr Ergebnis</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>So steht es um Ihre NIS2-Bereitschaft, basierend auf den geprüften Dokumenten.</p>

            {doneEvidences.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: "48px 24px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Noch keine Dokumente geprüft</div>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 20 }}>Prüfen Sie zuerst Dokumente in Schritt 2, um Ihr Ergebnis zu sehen.</div>
                <button onClick={() => setPage("evidence")} style={btn("primary")}>Zu Schritt 2 →</button>
              </div>
            ) : (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
                  {[
                    { l: "Bereitschaft", v: `${avgEvidence}`, suf: "%", c: SCORE_COLOR(avgEvidence) },
                    { l: "Geprüft", v: doneEvidences.length, suf: "", c: C.accent },
                    { l: "Kritisch", v: doneEvidences.filter(e => ["kritisch", "hoch"].includes(e.result.risiko)).length, suf: "", c: C.red },
                    { l: "Noch offen", v: fehlendeDocs.length, suf: "", c: C.amber },
                  ].map(s => (
                    <div key={s.l} style={{ ...card, padding: "18px 16px" }}>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontFamily: MONO }}>{s.l}</div>
                      <div style={{ fontFamily: MONO, fontSize: 28, fontWeight: 500, color: s.c }}>{s.v}<span style={{ fontSize: 16 }}>{s.suf}</span></div>
                    </div>
                  ))}
                </div>

                <div style={{ ...card, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 16 }}>Gesamt-Bereitschaft</div>
                  <ScoreBar score={avgEvidence} size="lg" />
                  <div style={{ fontSize: 13, color: C.mutedLight, marginTop: 12, lineHeight: 1.6 }}>
                    {avgEvidence >= 70 ? "Gute Nachweislage. Schließen Sie einzelne Lücken und halten Sie den Stand." : avgEvidence >= 40 ? "Teilweise Nachweise vorhanden, aber wichtige Lücken. Arbeiten Sie die roten Punkte zuerst ab." : "Kritische Nachweislage. Die meisten Dokumente halten einer Prüfung noch nicht stand — beginnen Sie mit den Sofortmaßnahmen."}
                  </div>
                </div>

                {/* Fehlende Dokumente */}
                {fehlendeDocs.length > 0 && (
                  <div style={{ ...card, marginBottom: 20, borderColor: `${C.amber}40` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Diese Nachweise fehlen noch</div>
                    {fehlendeDocs.map(d => (
                      <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 20 }}>{d.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{d.name}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{d.kurz}</div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setPage("evidence")} style={btn("sec", { marginTop: 14, fontSize: 13, padding: "8px 14px" })}>Fehlende hochladen →</button>
                  </div>
                )}

                <div style={{ ...card }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 16 }}>Geprüfte Nachweise</div>
                  {doneEvidences.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: i < doneEvidences.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.result.erkannterTyp || e.type}</div>
                        <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                      </div>
                      <Pill label={e.result.bewertung} color={BEW_COLOR[e.result.bewertung] || C.muted} />
                      <div style={{ width: 120 }}><ScoreBar score={e.result.evidenceScore} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Evidence Card ───
function EvidenceCard({ ev }) {
  const [open, setOpen] = useState(true);
  if (ev.status === "processing") {
    return (
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: 14, fontFamily: MONO, color: C.mutedLight }}>{ev.name} wird geprüft…</div>
        </div>
        <div className="skel" style={{ height: 8, borderRadius: 8, marginTop: 16 }} />
        <div className="skel" style={{ height: 8, borderRadius: 8, marginTop: 8, width: "70%" }} />
      </div>
    );
  }
  if (ev.status === "error") return <div style={{ ...card, borderColor: C.red }}><div style={{ fontSize: 14, color: C.red }}>⚠ {ev.name}: {ev.errorMsg}</div></div>;

  const r = ev.result;
  const col = SCORE_COLOR(r.evidenceScore);
  return (
    <div style={{ ...card, borderColor: `${col}50` }} className="fade">
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
        <div style={{ width: 52, height: 52, borderRadius: 10, background: `${col}1a`, border: `1px solid ${col}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: col }}>{r.evidenceScore}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{r.erkannterTyp || ev.type}</span>
            <Pill label={r.bewertung} color={BEW_COLOR[r.bewertung] || C.muted} />
            <Pill label={`Risiko ${r.risiko}`} color={RISK_COLOR[r.risiko] || C.muted} />
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.name}</div>
        </div>
        <div style={{ color: C.muted, fontSize: 18, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</div>
      </div>

      {open && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 18, padding: 14, background: C.bg, borderRadius: 8 }}>{r.zusammenfassung}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>✓ Gut / vorhanden</div>
              {r.vorhanden?.length ? r.vorhanden.map((v, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.green }}>·</span>{v}</div>) : <div style={{ fontSize: 13, color: C.muted }}>—</div>}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.red, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>✗ Fehlt noch</div>
              {r.fehlend?.length ? r.fehlend.map((v, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.red }}>·</span>{v}</div>) : <div style={{ fontSize: 13, color: C.muted }}>—</div>}
            </div>
          </div>
          {r.verbesserungen?.length > 0 && (
            <div style={{ padding: 16, background: C.accentDim, borderRadius: 8, border: `1px solid ${C.accent}30`, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>→ So machen Sie es besser</div>
              {r.verbesserungen.map((v, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6, paddingLeft: 20, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.accent, fontFamily: MONO, fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</span>{v}</div>)}
            </div>
          )}
          {r.nis2Bezug && <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>📎 {r.nis2Bezug}</div>}
        </div>
      )}
    </div>
  );
}
