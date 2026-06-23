// api/evidence-check.js — Nachweisprüfung: analysiert hochgeladene Dokumente kritisch
export const config = { runtime: "edge" };

const EVIDENCE_KNOWLEDGE = `
=== NACHWEIS-ANFORDERUNGEN NACH DOKUMENTTYP ===

BACKUP-KONZEPT (NIS2 Art. 21 Abs. 2 lit. c, BSI 200-4):
Starker Nachweis enthält:
- Definierte RTO (Recovery Time Objective) je System
- Definierte RPO (Recovery Point Objective) je System
- Restore-Test-Protokolle mit Datum und Ergebnis
- Benannter Verantwortlicher
- 3-2-1-Regel (3 Kopien, 2 Medien, 1 offsite)
- Ransomware-Schutz (Immutable/Air-Gapped Backups)
- Dokumentierter Review-Prozess mit Intervall
- Verschlüsselung der Backups
Schwacher Nachweis: Nur "wir machen Backups" ohne Tests, RTO/RPO, Verantwortliche

INFORMATIONSSICHERHEITSLEITLINIE (BSI ISMS.1.A3):
Starker Nachweis enthält:
- Freigabe durch Geschäftsführung (Unterschrift/Datum)
- Versionsnummer und Datum
- Geltungsbereich klar definiert
- Sicherheitsziele konkret benannt
- Verantwortlichkeiten (ISB benannt)
- Review-Zyklus festgelegt
Schwacher Nachweis: Generische Vorlage ohne Unternehmensbezug, keine Freigabe, kein Datum

RISIKOANALYSE (NIS2 Art. 21 Abs. 2 lit. a, BSI 200-3):
Starker Nachweis enthält:
- Asset-Inventar als Grundlage
- Schutzbedarfsfeststellung (Normal/Hoch/Sehr hoch)
- Bedrohungsidentifikation
- Eintrittswahrscheinlichkeit und Schadenshöhe
- Risikobehandlungsentscheidungen (Vermeidung/Reduktion/Übertragung/Akzeptanz)
- Verantwortliche je Risiko
- Datum und Review-Zyklus
Schwacher Nachweis: Liste von Risiken ohne Bewertung, ohne Maßnahmen

ASSET-INVENTAR (BSI ORP.4):
Starker Nachweis enthält:
- Vollständige Erfassung (Hardware, Software, Cloud, OT)
- Kritikalitätsbewertung je Asset
- Verantwortliche/Owner je Asset
- Schutzbedarf je Asset
- Internetexponierung dokumentiert
- Aktualität (letztes Update-Datum)
Schwacher Nachweis: Reine Hardware-Liste ohne Bewertung, veraltet

INCIDENT-RESPONSE-PLAN (NIS2 Art. 23, BSI DER.2.1):
Starker Nachweis enthält:
- Definition was ein Sicherheitsvorfall ist
- Meldekette mit Verantwortlichen
- 24h-Frühwarnung an BSI dokumentiert
- 72h-Meldeprozess
- Eskalationsstufen
- Kontaktdaten (intern + BSI)
- Lessons-Learned-Prozess
Schwacher Nachweis: Allgemeine Aussagen ohne konkrete Meldekette, ohne BSI-Fristen

LIEFERANTENMANAGEMENT (NIS2 Art. 21 Abs. 2 lit. d):
Starker Nachweis enthält:
- Liste aller Lieferanten mit Systemzugang
- Kritikalitätsbewertung je Lieferant
- Sicherheitsanforderungen in Verträgen
- Nachweise von Lieferanten (ISO 27001 etc.)
- Regelmäßige Überprüfung
Schwacher Nachweis: Reine Lieferantenliste ohne Sicherheitsbewertung

NOTFALLPLAN / BCM (NIS2 Art. 21 Abs. 2 lit. c, BSI 200-4):
Starker Nachweis enthält:
- Business Impact Analyse (BIA)
- Kritische Prozesse identifiziert
- RTO/RPO/MTPD definiert
- Notfallorganisation mit Rollen
- Wiederanlaufpläne
- Test-/Übungsnachweise
Schwacher Nachweis: Allgemeine Aussagen ohne BIA, ohne Tests
`;

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
  catch { return new Response(JSON.stringify({ error: "Ungültige Anfrage" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

  const { documentText, documentName, documentType, firma, branche } = body;
  if (!documentText) return new Response(JSON.stringify({ error: "Kein Dokumenttext" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  const prompt = `Du bist ein strenger NIS2-Auditor und Nachweisprüfer. Analysiere das folgende hochgeladene Dokument KRITISCH auf seine Qualität als Compliance-Nachweis.

WISSENSBASIS — ANFORDERUNGEN AN NACHWEISE:
${EVIDENCE_KNOWLEDGE}

ZU PRÜFENDES DOKUMENT:
Dateiname: ${documentName}
Vom Nutzer angegebener Typ: ${documentType || "Nicht angegeben"}
Unternehmen: ${firma || "Nicht angegeben"} (${branche || "Branche unbekannt"})

DOKUMENTINHALT:
"""
${documentText.slice(0, 8000)}
"""

AUFGABE: Bewerte dieses Dokument als Audit-Nachweis. Sei STRENG. Ein Dokument das existiert ist NICHT automatisch ausreichend. Prüfe gegen die konkreten Anforderungen aus der Wissensbasis.

Antworte AUSSCHLIESSLICH mit gültigem JSON in exakt diesem Format (keine Markdown-Backticks, kein Text davor/danach):
{
  "erkannterTyp": "welcher Dokumenttyp ist das wirklich",
  "evidenceScore": 0,
  "bewertung": "stark|mittel|schwach|fehlend",
  "zusammenfassung": "1-2 Sätze direkter Befund",
  "vorhanden": ["was ist gut/vorhanden"],
  "fehlend": ["konkret was fehlt laut Anforderungen"],
  "verbesserungen": ["konkrete nächste Schritte mit BSI/NIS2-Bezug"],
  "risiko": "niedrig|mittel|hoch|kritisch",
  "nis2Bezug": "relevante Artikel und Bausteine"
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: "Du bist ein strenger NIS2-Auditor. Bewerte Nachweise kritisch gegen die Wissensbasis. Antworte nur mit gültigem JSON, keine Markdown-Backticks. Schönige nichts.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return new Response(JSON.stringify({ error: "KI nicht verfügbar" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    const data = await res.json();
    let text = data.content?.find(b => b.type === "text")?.text || "";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return new Response(JSON.stringify({ result: text }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Interner Fehler" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
}
