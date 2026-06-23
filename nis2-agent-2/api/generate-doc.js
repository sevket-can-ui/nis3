// api/generate-doc.js — Erstellt Dokument-Entwurf aus Nutzerantworten (wenn kein Dokument vorhanden)
export const config = { runtime: "edge" };

const DOC_TEMPLATES = {
  "Informationssicherheitsleitlinie": "Erstelle eine Informationssicherheitsleitlinie mit: Verantwortlichkeiten, Geltungsbereich, Sicherheitszielen, Management-Freigabe, Bezug zum Risikomanagement, Review-Zyklus.",
  "Incident-Response-Plan": "Erstelle einen Incident-Response-Plan mit: Meldewegen, Rollen/Verantwortlichkeiten, Eskalationsstufen, 24h-/72h-Meldeprozess ans BSI, Kommunikationsplan, Lessons Learned.",
  "Risikoanalyse": "Erstelle eine Risikoanalyse-Struktur nach BSI 200-3 mit: Asset-Bezug, Schutzbedarfsfeststellung, Bedrohungen, Eintrittswahrscheinlichkeit/Schadenshöhe, Risikobehandlung, Verantwortlichen.",
  "Asset-Inventar": "Erstelle eine Asset-Inventar-Struktur mit: Erfassung aller Systeme, Kritikalitätsbewertung, Owner, Schutzbedarf, Internetexponierung, Aktualität.",
  "Backup- & Notfallkonzept": "Erstelle ein Backup- und Notfallkonzept mit: RTO/RPO je System, Restore-Test-Protokollen, Ransomware-Schutz, 3-2-1-Regel, Verantwortlichen, Review-Prozess.",
  "Lieferantenübersicht": "Erstelle eine Lieferantenübersicht mit: Dienstleistern mit Systemzugang, Kritikalität, Sicherheitsanforderungen in Verträgen, Nachweisen, regelmäßiger Prüfung.",
  "Schulungsnachweise": "Erstelle ein Schulungskonzept mit: Schulungsplan, Teilnehmernachweisen, Inhalten, Wiederholungsintervall, Management-Schulung, Dokumentation.",
};

export default async function handler(req) {
  const cors = {
    "Access-Control-Allow-Origin": process.env.APP_URL || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  let body;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "Ungültige Anfrage" }), { status: 400, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } }); }

  const { docType, antworten, firma, branche } = body;
  const template = DOC_TEMPLATES[docType] || `Erstelle ein Dokument vom Typ ${docType}.`;

  const prompt = `Du bist ein NIS2-Compliance-Berater. ${template}

Unternehmen: ${firma || "Nicht angegeben"} (Branche: ${branche || "unbekannt"})

Der Nutzer hat dieses Dokument noch nicht und folgende Fragen beantwortet:
${JSON.stringify(antworten, null, 2)}

Erstelle einen konkreten, einsatzbereiten Dokument-Entwurf auf Deutsch — angepasst an die Antworten des Nutzers, NICHT generisch. Verwende klare Struktur mit Abschnitten. Markiere offene Punkte, die der Nutzer noch ergänzen muss, mit [BITTE ERGÄNZEN]. Ca. 500-700 Wörter. Praxistauglich.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 2500,
        system: "Du bist ein NIS2-Berater. Erstelle praxistaugliche, auf den Nutzer zugeschnittene Dokument-Entwürfe. Markiere fehlende Angaben mit [BITTE ERGÄNZEN]. Behaupte keine Rechtssicherheit.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: "Anthropic-Fehler (" + res.status + "): " + errText.slice(0, 300) }), { status: 502, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    }
    const data = await res.json();
    const text = data.content?.find(b => b.type === "text")?.text || "";
    return new Response(JSON.stringify({ text }), { status: 200, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server-Ausnahme: " + (err?.message || String(err)) }), { status: 500, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  }
}
