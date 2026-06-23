import { useState, useRef, useEffect } from "react";
import { DOCUMENT_GUIDE, GLOSSARY, DOC_QUESTIONS } from "./knowledge";
import { supabase, hasSupabase } from "./supabase";
import { extractText } from "./extract";
import { PLANS, can } from "./plan";
import { C, MONO, SANS, SCORE_COLOR, RISK_COLOR, BEW_COLOR, card, btn, inp, lbl, safeParse } from "./ui";

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
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: `${color}1f`, color, border: `1px solid ${color}40`, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.3px", whiteSpace: "nowrap" }}>{label}</span>;
}
function Term({ children, k, onOpen }) {
  return <button onClick={() => onOpen(k)} style={{ background: "none", border: "none", borderBottom: `1px dotted ${C.accent}`, color: C.accent, cursor: "help", fontSize: "inherit", fontFamily: "inherit", padding: 0 }}>{children}</button>;
}
// Premium-Lock-Overlay
function PremiumLock({ titel, text, onUpgrade, children }) {
  return (
    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none", opacity: 0.5 }}>{children}</div>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, background: "rgba(13,17,23,0.55)" }}>
        <div style={{ fontSize: 22, marginBottom: 8 }}>🔒</div>
        <Pill label="Premium" color={C.accent} />
        <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12, marginBottom: 6 }}>{titel}</div>
        <div style={{ fontSize: 13, color: C.mutedLight, maxWidth: 320, lineHeight: 1.6, marginBottom: 16 }}>{text}</div>
        <button onClick={onUpgrade} style={btn("primary")}>Freischalten →</button>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [glossarTerm, setGlossarTerm] = useState(null);
  const [glossarOpen, setGlossarOpen] = useState(false);
  const openTerm = (k) => { setGlossarTerm(k); setGlossarOpen(true); };

  // Plan (noch keine echte Zahlung)
  const [plan, setPlan] = useState("free");

  const [profil, setProfil] = useState({ name: "", branche: "", mitarbeiter: "", umsatz: "", bilanz: "", rolle: "", kritischeDienste: "" });
  const [betroffenheit, setBetroffenheit] = useState(null);
  const [loadingBetroffen, setLoadingBetroffen] = useState(false);

  const [evidences, setEvidences] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileRef = useRef();
  const [pendingType, setPendingType] = useState(DOCUMENT_GUIDE[0].name);

  const [report, setReport] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // Dokument-Generierung (wenn Nutzer kein Dokument hat)
  const [genDocType, setGenDocType] = useState(null); // welcher Bereich gerade im Frage-Modus
  const [genAnswers, setGenAnswers] = useState({});
  const [genLoading, setGenLoading] = useState(false);
  const [generatedDocs, setGeneratedDocs] = useState([]); // {type, text}

  const startGenerate = (docType) => { setGenDocType(docType); setGenAnswers({}); };

  const submitGenerate = async () => {
    setGenLoading(true); setError("");
    try {
      const res = await fetch("/api/generate-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ docType: genDocType, antworten: genAnswers, firma: profil.name, branche: profil.branche }) });
      const raw = await res.text();
      if (!res.ok) { let m = "Fehler"; try { m = JSON.parse(raw).error; } catch {} throw new Error(m); }
      const data = JSON.parse(raw);
      setGeneratedDocs(prev => [{ type: genDocType, text: data.text }, ...prev]);
      setGenDocType(null); setGenAnswers({});
    } catch (e) { setError(e.message); }
    setGenLoading(false);
  };

  const downloadDoc = (doc) => {
    const blob = new Blob([doc.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${doc.type.replace(/[^a-zA-Z0-9]/g, "_")}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const [error, setError] = useState("");

  // Auth
  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authSent, setAuthSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!hasSupabase) return;
    try {
      supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null)).catch(() => {});
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
      return () => { try { sub.subscription.unsubscribe(); } catch {} };
    } catch {}
  }, []);

  const sendMagicLink = async () => {
    if (!authEmail) return;
    setAuthLoading(true); setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: authEmail, options: { emailRedirectTo: window.location.origin } });
      if (error) throw error;
      setAuthSent(true);
    } catch (e) { setError(e.message); }
    setAuthLoading(false);
  };
  const logout = async () => { await supabase.auth.signOut(); setUser(null); };

  const pruefeBetroffenheit = async () => {
    setLoadingBetroffen(true); setError("");
    try {
      const res = await fetch("/api/betroffenheit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profil }) });
      const raw = await res.text();
      if (!res.ok) { let m = "Server-Fehler"; try { m = JSON.parse(raw).error || m; } catch {} throw new Error(m); }
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error("Antwort vom Server unlesbar"); }
      const parsed = safeParse(data.result);
      if (!parsed) throw new Error("Die Einschätzung konnte nicht gelesen werden. Bitte erneut versuchen.");
      setBetroffenheit(parsed);
    } catch (e) { setError(e.message || "Unbekannter Fehler"); }
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
      const res = await fetch("/api/evidence-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentText: text, documentName: file.name, documentType: pendingType, firma: profil.name, branche: profil.branche }) });
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
  const geprüfteTypen = new Set(doneEvidences.map(e => e.type));
  const fehlendeDocs = DOCUMENT_GUIDE.filter(d => !geprüfteTypen.has(d.name));

  const erstelleReport = async () => {
    setLoadingReport(true); setError("");
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        profil, betroffenheit,
        evidences: doneEvidences.map(e => ({ type: e.type, erkannterTyp: e.result.erkannterTyp, evidenceScore: e.result.evidenceScore, bewertung: e.result.bewertung, risiko: e.result.risiko, fehlend: e.result.fehlend })),
      }) });
      const raw = await res.text();
      if (!res.ok) {
        let msg = "Server-Fehler";
        try { msg = JSON.parse(raw).error || msg; } catch {}
        throw new Error(msg);
      }
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error("Antwort vom Server unlesbar"); }
      const parsed = safeParse(data.result);
      if (!parsed) throw new Error("Der Report konnte nicht gelesen werden. Bitte erneut versuchen.");
      setReport(parsed);
    } catch (e) { setError(e.message || "Unbekannter Fehler"); }
    setLoadingReport(false);
  };

  const goUpgrade = () => setPage("preise");

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
        ::-webkit-scrollbar { width:8px; height:8px; } ::-webkit-scrollbar-thumb { background:${C.borderLight}; border-radius:8px; }
        .skel { background:linear-gradient(90deg,${C.surface2} 0px,${C.border} 200px,${C.surface2} 400px); background-size:800px; animation:shimmer 1.4s infinite; }
        .grid3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
        .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        @media (max-width:680px){
          .grid3,.grid2,.grid4 { grid-template-columns:1fr; }
          .navlinks { gap:2px!important; }
          .navlinks button { padding:6px 8px!important; font-size:12px!important; }
        }
      `}</style>

      {/* Glossar */}
      {glossarOpen && (
        <div onClick={() => setGlossarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 440, width: "100%", borderColor: C.accent }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.accent }}>BEGRIFF</div>
              <button onClick={() => setGlossarOpen(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{glossarTerm}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7 }}>{GLOSSARY[glossarTerm]}</div>
          </div>
        </div>
      )}

      {/* Auth */}
      {authOpen && (
        <div onClick={() => { setAuthOpen(false); setAuthSent(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, maxWidth: 400, width: "100%", borderColor: C.accent }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{authSent ? "E-Mail unterwegs" : "Anmelden"}</div>
              <button onClick={() => { setAuthOpen(false); setAuthSent(false); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20 }}>×</button>
            </div>
            {!hasSupabase ? <div style={{ fontSize: 13, color: C.amber, lineHeight: 1.6 }}>Datenbank noch nicht verbunden (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in Vercel eintragen).</div>
            : authSent ? <div style={{ fontSize: 14, lineHeight: 1.7, color: C.mutedLight }}>Login-Link an <strong style={{ color: C.text }}>{authEmail}</strong> gesendet. Öffne die Mail und klicke den Link.</div>
            : <div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>E-Mail eingeben — du bekommst einen Login-Link, kein Passwort nötig.</div>
                <input style={{ ...inp, marginBottom: 12 }} type="email" placeholder="dein@email.de" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                <button onClick={sendMagicLink} disabled={authLoading || !authEmail} style={btn("primary", { width: "100%", opacity: !authEmail ? 0.5 : 1 })}>{authLoading ? "Sendet…" : "Login-Link senden"}</button>
                {error && <div style={{ marginTop: 12, fontSize: 13, color: C.red }}>{error}</div>}
              </div>}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, minHeight: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px", position: "sticky", top: 0, background: `${C.bg}f0`, backdropFilter: "blur(8px)", zIndex: 50, gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setPage("home")} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", color: C.text, cursor: "pointer" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 500, fontSize: 12, color: "#fff" }}>N2</div>
          <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.2px" }}>NIS2 Agent</span>
        </button>
        <div className="navlinks" style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
          {[["home", "Start"], ["anleitung", "Anleitung"], ["profil", "1·Check"], ["evidence", "2·Dokumente"], ["dashboard", "3·Report"], ["preise", "Preise"]].map(([k, l]) => (
            <button key={k} onClick={() => setPage(k)} style={{ padding: "7px 11px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", fontFamily: SANS, background: page === k ? C.surface2 : "transparent", color: page === k ? C.text : C.muted }}>{l}</button>
          ))}
          {user ? <button onClick={logout} title={user.email} style={{ padding: "7px 11px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", border: `1px solid ${C.green}40`, background: C.greenDim, color: C.green }}>● An</button>
          : <button onClick={() => setAuthOpen(true)} style={{ padding: "7px 11px", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", border: `1px solid ${C.borderLight}`, background: "transparent", color: C.text }}>Anmelden</button>}
        </div>
      </nav>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "36px 18px 80px" }}>

        {/* ════ HOME ════ */}
        {page === "home" && (
          <div className="fade">
            <div style={{ marginBottom: 36 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 11, color: C.accent, marginBottom: 18, border: `1px solid ${C.accent}30`, borderRadius: 20, padding: "5px 12px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} /> AUTOMATISIERTER NIS2-READINESS-CHECK
              </div>
              <h1 style={{ fontSize: "clamp(27px,5vw,42px)", fontWeight: 700, letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 16 }}>
                NIS2 prüfen, verstehen und<br />vorbereiten — in wenigen Minuten.
              </h1>
              <p style={{ fontSize: 16, color: C.mutedLight, lineHeight: 1.7, maxWidth: 600, marginBottom: 28 }}>
                Der NIS2 Agent prüft Ihre Betroffenheit, analysiert vorhandene Dokumente und erstellt daraus eine verständliche Einschätzung mit Lücken, <Term k="Evidence Score" onOpen={openTerm}>Risiko-Score</Term> und nächsten Schritten — ohne teure Erstberatung.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={() => setPage("profil")} style={btn("primary", { padding: "14px 26px", fontSize: 15 })}>Jetzt kostenlosen NIS2-Check starten</button>
                <button onClick={() => setPage("anleitung")} style={btn("sec", { padding: "14px 26px", fontSize: 15 })}>Anleitung ansehen</button>
              </div>
            </div>

            {/* 3 Schritte */}
            <div className="grid3" style={{ marginBottom: 24 }}>
              {[
                { n: "01", t: "Betroffenheit prüfen", d: "Wenige Fragen zu Branche, Größe und Tätigkeit. Sie erhalten eine erste Einschätzung Ihrer möglichen NIS2-Relevanz." },
                { n: "02", t: "Dokumente analysieren", d: "Laden Sie vorhandene Richtlinien und Nachweise hoch. Das System erkennt fehlende oder unvollständige Inhalte." },
                { n: "03", t: "Ergebnis erhalten", d: "Readiness-Score, Gap-Analyse und ein priorisierter Maßnahmenplan für die nächsten Schritte." },
              ].map(m => (
                <div key={m.n} style={card}>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 12 }}>{m.n}</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{m.t}</div>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{m.d}</div>
                </div>
              ))}
            </div>

            {/* Ergebnis-Vorschau */}
            <div style={{ ...card, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 16 }}>Am Ende erhalten Sie</div>
              <div className="grid2">
                {["Betroffenheitsanalyse & mögliche Einstufung", "Dokumentenstatus pro Nachweis", "NIS2-Readiness-Score (0–100)", "Gap-Analyse nach 10 Themenbereichen", "Top-5-Lücken priorisiert", "Maßnahmenplan: sofort / 30 / 90 Tage", "PDF-Report für Geschäftsführung", "Hinweise auf fehlende Vorlagen"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.mutedLight, padding: "4px 0" }}>
                    <span style={{ color: C.green }}>✓</span>{f}
                  </div>
                ))}
              </div>
            </div>

            {/* Vertrauen */}
            <div style={{ ...card, borderColor: `${C.accent}40`, background: C.accentDim, fontSize: 13, color: C.mutedLight, lineHeight: 1.7 }}>
              <strong style={{ color: C.text }}>Seriöse Grundlage: </strong>
              Die Analyse basiert auf einer strukturierten NIS2-Wissensbasis (NIS2-Richtlinie, BSI IT-Grundschutz). Die KI dient zur verständlichen Auswertung und Aufbereitung, nicht zum freien Erfinden rechtlicher Aussagen. Dies ist eine strukturierte Ersteinschätzung und ersetzt keine verbindliche Rechtsberatung.
            </div>
          </div>
        )}

        {/* ════ ANLEITUNG ════ */}
        {page === "anleitung" && (
          <div className="fade">
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Anleitung</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>Welche Dokumente brauchen Sie für NIS2? Jedes hier in Klartext erklärt.</p>
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
                    <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>{doc.laie}</div>
                    <div style={{ padding: 14, background: C.amberDim, borderRadius: 8, border: `1px solid ${C.amber}30`, marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.amber, marginBottom: 6 }}>WARUM NIS2 DAS VERLANGT</div>
                      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{doc.warum}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Das muss drin sein</div>
                    {doc.mussRein.map((m, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 18, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.green }}>✓</span>{m}</div>)}
                    <div style={{ padding: 14, background: C.bg, borderRadius: 8, marginTop: 16 }}><div style={{ fontSize: 13, lineHeight: 1.6 }}><strong style={{ color: C.accent }}>💡 Tipp: </strong>{doc.tipp}</div></div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: MONO, marginTop: 12 }}>📎 {doc.nis2}</div>
                  </div>
                </details>
              ))}
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Begriffe-Lexikon</h3>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>Alle Fachbegriffe in einem Satz.</p>
            <div style={card}>
              {Object.entries(GLOSSARY).map(([term, def], i, arr) => (
                <div key={term} style={{ padding: "12px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.accent, marginBottom: 4 }}>{term}</div>
                  <div style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6 }}>{def}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setPage("profil")} style={btn("primary", { width: "100%", marginTop: 24, padding: "13px" })}>Mit Schritt 1 starten →</button>
          </div>
        )}

        {/* ════ PROFIL ════ */}
        {page === "profil" && (
          <div className="fade">
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 8 }}>SCHRITT 1 VON 3 · KOSTENLOS</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Sind Sie von NIS2 betroffen?</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>Auf Basis Ihrer Angaben erstellen wir eine erste strukturierte Einschätzung.</p>

            <div style={{ ...card, marginBottom: 20 }}>
              <div className="grid2">
                <div><label style={lbl}>Unternehmensname</label><input style={inp} value={profil.name} onChange={e => setProfil({ ...profil, name: e.target.value })} placeholder="Mustermann GmbH" /></div>
                <div><label style={lbl}>Branche / Sektor</label>
                  <select style={inp} value={profil.branche} onChange={e => setProfil({ ...profil, branche: e.target.value })}>
                    <option value="">Wählen…</option>
                    <optgroup label="Besonders kritisch (Anlage 1)">{["Energie", "Verkehr", "Finanzwesen", "Gesundheitswesen", "Trinkwasser", "Abwasser", "Digitale Infrastruktur", "IKT-Dienste", "Öffentliche Verwaltung", "Weltraum"].map(b => <option key={b}>{b}</option>)}</optgroup>
                    <optgroup label="Kritisch (Anlage 2)">{["Post & Kurier", "Abfallbewirtschaftung", "Chemie", "Lebensmittel", "Verarbeitendes Gewerbe", "Digitale Dienste", "Forschung"].map(b => <option key={b}>{b}</option>)}</optgroup>
                    <option value="Sonstige">Sonstige / nicht gelistet</option>
                  </select>
                </div>
                <div><label style={lbl}>Mitarbeiterzahl</label><select style={inp} value={profil.mitarbeiter} onChange={e => setProfil({ ...profil, mitarbeiter: e.target.value })}><option value="">Wählen…</option>{["1–49", "50–249", "250–999", "1000+"].map(m => <option key={m}>{m}</option>)}</select></div>
                <div><label style={lbl}>Jahresumsatz</label><select style={inp} value={profil.umsatz} onChange={e => setProfil({ ...profil, umsatz: e.target.value })}><option value="">Wählen…</option>{["< 10 Mio €", "10–50 Mio €", "> 50 Mio €"].map(m => <option key={m}>{m}</option>)}</select></div>
                <div><label style={lbl}>Bilanzsumme</label><select style={inp} value={profil.bilanz} onChange={e => setProfil({ ...profil, bilanz: e.target.value })}><option value="">Wählen…</option>{["< 10 Mio €", "10–43 Mio €", "> 43 Mio €"].map(m => <option key={m}>{m}</option>)}</select></div>
                <div><label style={lbl}>Ihre Rolle</label><select style={inp} value={profil.rolle} onChange={e => setProfil({ ...profil, rolle: e.target.value })}><option value="">Wählen…</option>{["Betreiber kritischer Dienste", "IT-Dienstleister", "Zulieferer", "Digitaler Anbieter", "Sonstiges"].map(m => <option key={m}>{m}</option>)}</select></div>
              </div>
              <div style={{ marginTop: 16 }}><label style={lbl}>Was macht Ihr Unternehmen?</label><input style={inp} value={profil.kritischeDienste} onChange={e => setProfil({ ...profil, kritischeDienste: e.target.value })} placeholder="z.B. Wir versorgen 200.000 Menschen mit Trinkwasser" /></div>
            </div>

            <button onClick={pruefeBetroffenheit} disabled={loadingBetroffen || !profil.branche || !profil.mitarbeiter} style={btn(profil.branche && profil.mitarbeiter ? "primary" : "sec", { width: "100%", padding: "13px", opacity: (!profil.branche || !profil.mitarbeiter) ? 0.5 : 1 })}>{loadingBetroffen ? "Wird geprüft…" : "Kostenlose Einschätzung erhalten"}</button>
            {error && <div style={{ marginTop: 16, padding: "12px 16px", background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, fontSize: 13, color: C.red }}>{error}</div>}

            {betroffenheit && (() => {
              const stColor = betroffenheit.status === "betroffen" ? C.red : betroffenheit.status === "nicht_betroffen" ? C.green : C.amber;
              return (
                <div className="fade" style={{ marginTop: 24 }}>
                  {/* Kompakte Statuskarte */}
                  <div style={{ ...card, borderColor: stColor, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Ihre Ersteinschätzung</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                      <Pill label={betroffenheit.status?.replace(/_/g, " ")} color={stColor} />
                      {betroffenheit.einstufung && !["keine", "unklar"].includes(betroffenheit.einstufung) && <Pill label={betroffenheit.einstufung?.replace(/_/g, " ")} color={C.accent} />}
                      {profil.branche && <Pill label={profil.branche} color={C.muted} />}
                    </div>
                    <div style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 16 }}>{betroffenheit.begruendung}</div>
                    {betroffenheit.handlungsempfehlung && (
                      <div style={{ padding: 14, background: C.bg, borderRadius: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 6 }}>→ Nächster Schritt</div>
                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{betroffenheit.handlungsempfehlung}</div>
                        {betroffenheit.fristen && <div style={{ fontSize: 13, color: C.amber, marginTop: 8, fontFamily: MONO }}>⏱ {betroffenheit.fristen}</div>}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 12, fontStyle: "italic" }}>{betroffenheit.rechtshinweis || "Strukturierte Ersteinschätzung auf Basis Ihrer Angaben. Keine verbindliche Rechtsberatung."}</div>
                  </div>

                  {/* Upgrade-Box */}
                  <div style={{ ...card, borderColor: `${C.accent}50`, background: C.accentDim }}>
                    <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Ihre erste Einschätzung ist fertig.</div>
                    <div style={{ fontSize: 14, color: C.mutedLight, lineHeight: 1.7, marginBottom: 16 }}>Für eine belastbare Vorbereitung sollten nun vorhandene Dokumente geprüft, Lücken identifiziert und konkrete Maßnahmen priorisiert werden. Das übernimmt der vollständige Readiness-Report.</div>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <button onClick={() => setPage("evidence")} style={btn("primary")}>Weiter: Dokumente prüfen →</button>
                      <button onClick={() => setPage("preise")} style={btn("sec")}>Was kostet der Report?</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ════ EVIDENCE ════ */}
        {page === "evidence" && (
          <div className="fade">
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 8 }}>SCHRITT 2 VON 3</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Dokumente erfassen</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 24 }}>Für jeden Bereich: Dokument hochladen wenn Sie eins haben — oder „Hab ich nicht" wählen, ein paar Fragen beantworten und einen Entwurf erstellen lassen. <button onClick={() => setPage("anleitung")} style={{ color: C.accent, background: "none", border: "none", cursor: "pointer", fontSize: 14, textDecoration: "underline" }}>Was bedeutet was?</button></p>

            {error && <div style={{ marginBottom: 20, padding: "12px 16px", background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, fontSize: 13, color: C.red }}>{error}</div>}

            {/* Pro Bereich eine Karte */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              {DOCUMENT_GUIDE.map(doc => {
                const geprüft = doneEvidences.find(e => e.type === doc.name);
                const generiert = generatedDocs.find(d => d.type === doc.name);
                const imFrageModus = genDocType === doc.name;
                const fragen = DOC_QUESTIONS[doc.name] || [];

                return (
                  <div key={doc.id} style={{ ...card, borderColor: geprüft ? `${SCORE_COLOR(geprüft.result.evidenceScore)}50` : generiert ? `${C.accent}50` : C.border }}>
                    {/* Kopf */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: imFrageModus || geprüft || generiert ? 16 : 0 }}>
                      <div style={{ fontSize: 24 }}>{doc.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{doc.name}</div>
                        <div style={{ fontSize: 12, color: C.muted }}>{doc.kurz}</div>
                      </div>
                      {geprüft && <Pill label={`Score ${geprüft.result.evidenceScore}`} color={SCORE_COLOR(geprüft.result.evidenceScore)} />}
                      {generiert && !geprüft && <Pill label="Entwurf erstellt" color={C.accent} />}
                    </div>

                    {/* Aktionen wenn noch nichts gemacht */}
                    {!geprüft && !generiert && !imFrageModus && (
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                        <button onClick={() => { setPendingType(doc.name); fileRef.current?.click(); }} style={btn("sec", { fontSize: 13, padding: "9px 16px" })}>📄 Dokument hochladen</button>
                        <button onClick={() => startGenerate(doc.name)} style={btn("ghost", { fontSize: 13, padding: "9px 16px" })}>Hab ich nicht — Entwurf erstellen</button>
                      </div>
                    )}

                    {/* Frage-Modus */}
                    {imFrageModus && (
                      <div className="fade">
                        <div style={{ fontSize: 13, color: C.mutedLight, marginBottom: 16, lineHeight: 1.6 }}>Beantworten Sie kurz diese Fragen — daraus erstellen wir einen auf Sie zugeschnittenen Entwurf.</div>
                        {fragen.map(f => (
                          <div key={f.id} style={{ marginBottom: 14 }}>
                            <label style={lbl}>{f.frage}</label>
                            <input style={inp} placeholder={f.placeholder} value={genAnswers[f.id] || ""} onChange={e => setGenAnswers({ ...genAnswers, [f.id]: e.target.value })} />
                          </div>
                        ))}
                        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                          <button onClick={submitGenerate} disabled={genLoading} style={btn("primary", { fontSize: 13, padding: "10px 18px" })}>{genLoading ? "Erstellt…" : "Entwurf erstellen"}</button>
                          <button onClick={() => setGenDocType(null)} style={btn("ghost", { fontSize: 13, padding: "10px 18px" })}>Abbrechen</button>
                        </div>
                      </div>
                    )}

                    {/* Geprüftes Dokument — Ergebnis */}
                    {geprüft && (
                      <EvidenceDetail r={geprüft.result} fileName={geprüft.name} plan={plan} onUpgrade={goUpgrade} />
                    )}

                    {/* Generierter Entwurf */}
                    {generiert && !geprüft && (
                      <div className="fade">
                        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, fontSize: 12, color: C.mutedLight, lineHeight: 1.6, maxHeight: 160, overflow: "auto", whiteSpace: "pre-wrap", marginBottom: 12 }}>{generiert.text.slice(0, 500)}…</div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => downloadDoc(generiert)} style={btn("sec", { fontSize: 13, padding: "9px 16px" })}>⬇ Entwurf herunterladen</button>
                          <button onClick={() => { setPendingType(doc.name); fileRef.current?.click(); }} style={btn("ghost", { fontSize: 13, padding: "9px 16px" })}>Stattdessen Dokument hochladen</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* verstecktes Datei-Input + Upload-Status */}
            <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.csv,.md" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
            {uploading && (
              <div style={{ ...card, marginBottom: 20, textAlign: "center" }}>
                <div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }} />
                <div style={{ fontSize: 13, color: C.mutedLight, fontFamily: MONO }}>{uploadStatus}</div>
              </div>
            )}

            {(doneEvidences.length > 0 || generatedDocs.length > 0) && <button onClick={() => setPage("dashboard")} style={btn("primary", { width: "100%", padding: "13px" })}>Weiter zu Schritt 3: Report erstellen →</button>}
          </div>
        )}

        {/* ════ DASHBOARD / REPORT ════ */}
        {page === "dashboard" && (
          <div className="fade">
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.accent, marginBottom: 8 }}>SCHRITT 3 VON 3</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.5px", marginBottom: 6 }}>Ihr NIS2-Readiness-Report</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 28 }}>Strukturierte Auswertung aus Betroffenheit und geprüften Dokumenten.</p>

            {!report ? (
              <div style={{ ...card, textAlign: "center", padding: "44px 24px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Report erstellen</div>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 20, maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.6 }}>
                  {doneEvidences.length === 0 ? "Prüfen Sie zuerst Dokumente in Schritt 2 — je mehr Nachweise, desto genauer der Report." : `${doneEvidences.length} Nachweis(e) geprüft. Jetzt den vollständigen Report mit Score, Gap-Analyse und Maßnahmenplan erstellen.`}
                </div>
                {doneEvidences.length === 0
                  ? <button onClick={() => setPage("evidence")} style={btn("primary")}>Zu Schritt 2 →</button>
                  : <button onClick={erstelleReport} disabled={loadingReport} style={btn("primary")}>{loadingReport ? "Report wird erstellt…" : "Report jetzt erstellen"}</button>}
                {error && <div style={{ marginTop: 16, fontSize: 13, color: C.red }}>{error}</div>}
              </div>
            ) : (
              <ReportView report={report} betroffenheit={betroffenheit} evidences={doneEvidences} plan={plan} onUpgrade={goUpgrade} onReset={() => setReport(null)} />
            )}
          </div>
        )}

        {/* ════ PREISE ════ */}
        {page === "preise" && (
          <div className="fade">
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.8px", marginBottom: 8, textAlign: "center" }}>Vom kostenlosen Check zum vollständigen Report</h2>
            <p style={{ fontSize: 14, color: C.muted, marginBottom: 32, textAlign: "center" }}>Die Ersteinschätzung ist kostenlos. Die Tiefenanalyse liefert den Business-Wert.</p>
            <div className="grid3" style={{ marginBottom: 24, alignItems: "stretch" }}>
              {Object.values(PLANS).map(p => (
                <div key={p.id} style={{ ...card, display: "flex", flexDirection: "column", borderColor: p.id === "professional" ? C.accent : C.border, background: p.id === "professional" ? C.accentDim : C.surface, position: "relative" }}>
                  {p.id === "professional" && <div style={{ position: "absolute", top: -1, right: 16, background: C.accent, color: "#fff", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: "0 0 7px 7px", fontFamily: MONO }}>EMPFOHLEN</div>}
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>{p.tagline}</div>
                  <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{p.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, color: p.id === "professional" ? C.accent : C.text, marginBottom: 4 }}>{p.preis}<span style={{ fontSize: 13, color: C.muted }}> {p.periode}</span></div>
                  <div style={{ margin: "16px 0", borderTop: `1px solid ${C.border}` }} />
                  <div style={{ flex: 1 }}>{p.features.map(f => <div key={f} style={{ fontSize: 13, color: C.mutedLight, marginBottom: 8, display: "flex", gap: 8 }}><span style={{ color: p.id === "free" ? C.green : C.accent }}>✓</span>{f}</div>)}</div>
                  <button onClick={() => { if (p.id !== "free") { setPlan(p.id); } setPage(p.id === "free" ? "profil" : "dashboard"); }} style={btn(p.id === "professional" ? "primary" : "sec", { width: "100%", marginTop: 18 })}>
                    {p.id === "free" ? "Kostenlos starten" : `${p.name} wählen`}
                  </button>
                </div>
              ))}
            </div>
            <div style={{ ...card, fontSize: 12, color: C.muted, textAlign: "center", lineHeight: 1.6 }}>
              Hinweis: Die Zahlungsabwicklung wird derzeit vorbereitet. Mit Klick auf einen Plan schalten Sie die Vorschau frei, um den vollständigen Funktionsumfang zu testen.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Evidence Detail (Ergebnis eines geprüften Dokuments) ───
function EvidenceDetail({ r, fileName, plan, onUpgrade }) {
  const detailLocked = !can(plan, "canViewGapAnalysis");
  return (
    <div className="fade">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Pill label={r.bewertung} color={BEW_COLOR[r.bewertung] || C.muted} />
        <Pill label={`Risiko ${r.risiko}`} color={RISK_COLOR[r.risiko] || C.muted} />
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 16, padding: 14, background: C.bg, borderRadius: 8 }}>{r.zusammenfassung}</div>
      <div className="grid2" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>✓ Vorhanden</div>
          {r.vorhanden?.length ? r.vorhanden.map((v, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.green }}>·</span>{v}</div>) : <div style={{ fontSize: 13, color: C.muted }}>—</div>}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.red, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>✗ Fehlt</div>
          {r.fehlend?.length ? r.fehlend.map((v, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.red }}>·</span>{v}</div>) : <div style={{ fontSize: 13, color: C.muted }}>—</div>}
        </div>
      </div>
      {r.verbesserungen?.length > 0 && (detailLocked ? (
        <PremiumLock titel="Konkrete Ergänzungsempfehlungen" text="Sehen Sie Schritt für Schritt, wie Sie dieses Dokument auditfähig machen." onUpgrade={onUpgrade}>
          <div style={{ padding: 16, background: C.accentDim, borderRadius: 8 }}>{r.verbesserungen.map((v, i) => <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>{i + 1}. {v}</div>)}</div>
        </PremiumLock>
      ) : (
        <div style={{ padding: 16, background: C.accentDim, borderRadius: 8, border: `1px solid ${C.accent}30`, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>→ So machen Sie es besser</div>
          {r.verbesserungen.map((v, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6, paddingLeft: 20, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.accent, fontFamily: MONO, fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</span>{v}</div>)}
        </div>
      ))}
      {r.nis2Bezug && <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>📎 {r.nis2Bezug}</div>}
    </div>
  );
}

// ─── Evidence Card ───
function EvidenceCard({ ev, plan, onUpgrade }) {
  const [open, setOpen] = useState(true);
  if (ev.status === "processing") return <div style={card}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 20, height: 20, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><div style={{ fontSize: 14, fontFamily: MONO, color: C.mutedLight }}>{ev.name} wird geprüft…</div></div><div className="skel" style={{ height: 8, borderRadius: 8, marginTop: 16 }} /></div>;
  if (ev.status === "error") return <div style={{ ...card, borderColor: C.red }}><div style={{ fontSize: 14, color: C.red }}>⚠ {ev.name}: {ev.errorMsg}</div></div>;

  const r = ev.result;
  const col = SCORE_COLOR(r.evidenceScore);
  const detailLocked = !can(plan, "canViewGapAnalysis"); // Details nur Premium

  return (
    <div style={{ ...card, borderColor: `${col}50` }} className="fade">
      <div onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
        <div style={{ width: 52, height: 52, borderRadius: 10, background: `${col}1a`, border: `1px solid ${col}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 500, color: col }}>{r.evidenceScore}</div></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}><span style={{ fontSize: 15, fontWeight: 600 }}>{r.erkannterTyp || ev.type}</span><Pill label={r.bewertung} color={BEW_COLOR[r.bewertung] || C.muted} /><Pill label={`Risiko ${r.risiko}`} color={RISK_COLOR[r.risiko] || C.muted} /></div>
          <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.name}</div>
        </div>
        <div style={{ color: C.muted, fontSize: 18, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>›</div>
      </div>
      {open && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 18, padding: 14, background: C.bg, borderRadius: 8 }}>{r.zusammenfassung}</div>
          <div className="grid2" style={{ marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.green, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>✓ Vorhanden</div>
              {r.vorhanden?.length ? r.vorhanden.map((v, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.green }}>·</span>{v}</div>) : <div style={{ fontSize: 13, color: C.muted }}>—</div>}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.red, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>✗ Fehlt</div>
              {r.fehlend?.length ? r.fehlend.map((v, i) => <div key={i} style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6, marginBottom: 6, paddingLeft: 16, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.red }}>·</span>{v}</div>) : <div style={{ fontSize: 13, color: C.muted }}>—</div>}
            </div>
          </div>
          {r.verbesserungen?.length > 0 && (detailLocked ? (
            <PremiumLock titel="Konkrete Ergänzungsempfehlungen" text="Sehen Sie Schritt für Schritt, wie Sie dieses Dokument auditfähig machen." onUpgrade={onUpgrade}>
              <div style={{ padding: 16, background: C.accentDim, borderRadius: 8 }}>{r.verbesserungen.map((v, i) => <div key={i} style={{ fontSize: 13, marginBottom: 6 }}>{i + 1}. {v}</div>)}</div>
            </PremiumLock>
          ) : (
            <div style={{ padding: 16, background: C.accentDim, borderRadius: 8, border: `1px solid ${C.accent}30`, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>→ So machen Sie es besser</div>
              {r.verbesserungen.map((v, i) => <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6, paddingLeft: 20, position: "relative" }}><span style={{ position: "absolute", left: 0, color: C.accent, fontFamily: MONO, fontSize: 11 }}>{String(i + 1).padStart(2, "0")}</span>{v}</div>)}
            </div>
          ))}
          {r.nis2Bezug && <div style={{ fontSize: 12, color: C.muted, fontFamily: MONO, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>📎 {r.nis2Bezug}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Report View ───
function ReportView({ report, betroffenheit, evidences, plan, onUpgrade, onReset }) {
  const scoreCol = SCORE_COLOR(report.readinessScore);
  const fullAccess = can(plan, "canViewGapAnalysis");

  return (
    <div>
      {/* A. Gesamtbewertung */}
      <div style={{ ...card, marginBottom: 16, borderColor: scoreCol }}>
        <div className="grid2" style={{ alignItems: "center", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>NIS2-Readiness-Score</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 48, fontWeight: 500, color: scoreCol, lineHeight: 1 }}>{report.readinessScore}</span>
              <span style={{ fontSize: 18, color: C.muted }}>/100</span>
            </div>
            <ScoreBar score={report.readinessScore} size="lg" />
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <Pill label={`Risiko ${report.riskLevel}`} color={RISK_COLOR[report.riskLevel] || C.muted} />
              <Pill label={report.statusText} color={scoreCol} />
            </div>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: C.mutedLight }}>{report.executiveSummary}</div>
        </div>
      </div>

      {/* B. Betroffenheit */}
      {betroffenheit && (
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Betroffenheitsstatus</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <Pill label={betroffenheit.status?.replace(/_/g, " ")} color={betroffenheit.status === "betroffen" ? C.red : C.amber} />
            {betroffenheit.einstufung && !["keine", "unklar"].includes(betroffenheit.einstufung) && <Pill label={betroffenheit.einstufung?.replace(/_/g, " ")} color={C.accent} />}
          </div>
          <div style={{ fontSize: 13, color: C.mutedLight, lineHeight: 1.6 }}>{betroffenheit.begruendung}</div>
        </div>
      )}

      {/* C. Dokumentenstatus */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Dokumentenstatus</div>
        {evidences.length ? evidences.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < evidences.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.result.erkannterTyp || e.type}</div>
            <Pill label={e.result.bewertung} color={BEW_COLOR[e.result.bewertung] || C.muted} />
            <div style={{ width: 90 }}><ScoreBar score={e.result.evidenceScore} /></div>
          </div>
        )) : <div style={{ fontSize: 13, color: C.muted }}>Keine Dokumente geprüft.</div>}
      </div>

      {/* D. Gap-Analyse — Premium */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Gap-Analyse nach Themenbereichen</div>
        {fullAccess ? (
          <div style={{ ...card }}>
            {report.gapAnalysis?.map((g, i) => (
              <div key={i} style={{ padding: "12px 0", borderBottom: i < report.gapAnalysis.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{g.bereich}</div>
                  <Pill label={g.risiko} color={RISK_COLOR[g.risiko] || C.muted} />
                  <div style={{ width: 80 }}><ScoreBar score={g.score} /></div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{g.begruendung}</div>
              </div>
            ))}
          </div>
        ) : (
          <PremiumLock titel="Vollständige Gap-Analyse" text="Sehen Sie genau, welche organisatorischen, technischen und dokumentarischen Lücken in allen 10 NIS2-Bereichen bestehen." onUpgrade={onUpgrade}>
            <div style={{ ...card }}>{(report.gapAnalysis || []).slice(0, 5).map((g, i) => <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", alignItems: "center" }}><div style={{ flex: 1, fontSize: 14 }}>{g.bereich}</div><div style={{ width: 80 }}><ScoreBar score={g.score} /></div></div>)}</div>
          </PremiumLock>
        )}
      </div>

      {/* E. Top-5-Lücken */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Top-5-Lücken</div>
        {report.topGaps?.map((g, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < report.topGaps.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ fontFamily: MONO, fontSize: 13, color: C.red, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{g}</div>
          </div>
        ))}
      </div>

      {/* F. Maßnahmenplan — Premium */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Priorisierter Maßnahmenplan</div>
        {fullAccess ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[["sofort", "Sofort", C.red], ["30tage", "Innerhalb 30 Tage", C.amber], ["90tage", "Innerhalb 90 Tage", C.accent]].map(([key, titel, col]) => (
              <div key={key} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: col }} /><span style={{ fontSize: 13, fontWeight: 600 }}>{titel}</span></div>
                {report.actionPlan?.[key]?.length ? report.actionPlan[key].map((m, i) => (
                  <div key={i} style={{ padding: "10px 0", borderBottom: i < report.actionPlan[key].length - 1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{m.titel}</div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{m.warum}</div>
                    {m.bereich && <div style={{ fontSize: 11, color: C.accent, fontFamily: MONO, marginTop: 4 }}>{m.bereich}</div>}
                  </div>
                )) : <div style={{ fontSize: 13, color: C.muted }}>—</div>}
              </div>
            ))}
          </div>
        ) : (
          <PremiumLock titel="Priorisierter Maßnahmenplan" text="Konkrete Maßnahmen, sortiert nach Sofort / 30 Tage / 90 Tage — mit Begründung und betroffenem Bereich." onUpgrade={onUpgrade}>
            <div style={card}>{["Sofortmaßnahme 1", "Sofortmaßnahme 2", "Maßnahme 30 Tage", "Maßnahme 90 Tage"].map((m, i) => <div key={i} style={{ fontSize: 14, padding: "8px 0" }}>{m}</div>)}</div>
          </PremiumLock>
        )}
      </div>

      {/* G. Export */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 14 }}>Report & Export</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {can(plan, "canExportPdf")
            ? <button onClick={() => window.print()} style={btn("primary")}>📄 Als PDF drucken / speichern</button>
            : <button onClick={onUpgrade} style={btn("sec")}>🔒 PDF-Report (Premium)</button>}
          <button onClick={onReset} style={btn("ghost")}>Neue Prüfung starten</button>
        </div>
      </div>

      <div style={{ fontSize: 11, color: C.muted, fontStyle: "italic", lineHeight: 1.6, textAlign: "center" }}>
        Strukturierte Ersteinschätzung auf Basis einer NIS2-Wissensbasis. Keine verbindliche Rechtsberatung, keine offizielle BSI-Einstufung, keine Garantie der Compliance.
      </div>
    </div>
  );
}
