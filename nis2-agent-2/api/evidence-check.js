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
  catch { return new Response(JSON.stringify({ error: "Ungültige Anfrage" }), { status: 400, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } }); }

  const { documentText, documentName, documentType, firma, branche } = body;
  if (!documentText) return new Response(JSON.stringify({ error: "Kein Dokumenttext" }), { status: 400, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

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
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 2000, stream: true,
        system: "Du bist ein strenger NIS2-Auditor. Bewerte Nachweise kritisch gegen die Wissensbasis. Antworte nur mit gültigem JSON, keine Markdown-Backticks. Schönige nichts.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ error: "Anthropic-Fehler (" + upstream.status + "): " + errText.slice(0, 300) }), { status: 502, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    }
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(String.fromCharCode(10));
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const d = line.slice(6);
                if (d === "[DONE]") continue;
                try {
                  const j = JSON.parse(d);
                  if (j.type === "content_block_delta" && j.delta && j.delta.text) {
                    controller.enqueue(encoder.encode(j.delta.text));
                  }
                } catch (e) {}
              }
            }
          }
        } catch (e) {}
        controller.close();
      },
    });
    return new Response(stream, { status: 200, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server-Ausnahme: " + (err?.message || String(err)) }), { status: 500, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  }
}
