// api/report.js — Erzeugt strukturierten NIS2-Readiness-Report aus Profil + geprüften Dokumenten
export const config = { runtime: "edge" };

const REPORT_KNOWLEDGE = `
=== NIS2 THEMENBEREICHE (für Gap-Analyse) ===
1. Governance & Verantwortung — NIS2 Art. 20, BSI ISMS.1: Leitungsverantwortung, ISB benannt, Leitlinie verabschiedet
2. Risikomanagement — NIS2 Art. 21 Abs. 2 lit. a, BSI 200-3: Risikoanalyse, Asset-Inventar, Schutzbedarf
3. Incident Response — NIS2 Art. 23, BSI DER.2.1: Meldekette, 24h/72h-Fristen ans BSI, Eskalation
4. Lieferantenmanagement — NIS2 Art. 21 Abs. 2 lit. d: Lieferantenrisiko, Vertragsklauseln, Nachweise
5. Zugriffskontrolle — NIS2 Art. 21 Abs. 2 lit. i/j: MFA, Rollen, Admin-Konten, Berechtigungen
6. Backup & Wiederherstellung — NIS2 Art. 21 Abs. 2 lit. c, BSI 200-4: RTO/RPO, Restore-Tests, Ransomware-Schutz
7. Schulung & Awareness — NIS2 Art. 20 Abs. 2, BSI ORP.3: Mitarbeiterschulung, Phishing-Tests, Management-Schulung
8. Dokumentation — Nachweise, Versionierung, Freigaben, Review-Zyklen
9. Meldepflichten — NIS2 Art. 23: 24h-Frühwarnung, 72h-Meldung, Abschlussbericht
10. Business Continuity — BSI 200-4: BIA, Notfallpläne, kritische Prozesse

=== BUSSGELD ===
Besonders wichtige Einrichtung: bis 10 Mio EUR oder 2% Jahresumsatz (NIS2 Art. 34)
Wichtige Einrichtung: bis 7 Mio EUR oder 1,4% Jahresumsatz
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

  const { profil, betroffenheit, evidences } = body;

  const evidenceSummary = (evidences || []).map(e =>
    `- ${e.erkannterTyp || e.type}: Score ${e.evidenceScore}/100, Bewertung ${e.bewertung}, Risiko ${e.risiko}. Fehlend: ${(e.fehlend || []).join("; ")}`
  ).join("\n") || "Keine Dokumente geprüft.";

  const prompt = `Du bist ein NIS2-Auditor. Erstelle einen strukturierten Readiness-Report auf Basis der Wissensbasis und der geprüften Nachweise.

WISSENSBASIS:
${REPORT_KNOWLEDGE}

UNTERNEHMEN:
${JSON.stringify(profil)}

BETROFFENHEIT:
${JSON.stringify(betroffenheit)}

GEPRÜFTE DOKUMENTE:
${evidenceSummary}

Bewerte jeden der 10 Themenbereiche auf Basis der vorhandenen Nachweise. Wenn zu einem Bereich kein Nachweis vorliegt, ist der Score niedrig (Lücke).

Antworte AUSSCHLIESSLICH mit gültigem JSON (keine Backticks):
{
  "readinessScore": 0,
  "riskLevel": "niedrig|mittel|hoch|kritisch",
  "statusText": "z.B. Vorbereitung unzureichend",
  "executiveSummary": "2-3 Sätze Kurzfazit mit Score und größten Lücken",
  "gapAnalysis": [
    { "bereich": "Governance & Verantwortung", "score": 0, "risiko": "niedrig|mittel|hoch|kritisch", "begruendung": "1 Satz" }
  ],
  "topGaps": ["Top 5 wichtigste Lücken, konkret"],
  "actionPlan": {
    "sofort": [{ "titel": "", "warum": "", "bereich": "", "frist": "sofort" }],
    "30tage": [{ "titel": "", "warum": "", "bereich": "", "frist": "30 Tage" }],
    "90tage": [{ "titel": "", "warum": "", "bereich": "", "frist": "90 Tage" }]
  }
}

Die gapAnalysis enthält die 6 wichtigsten Bereiche. Halte begruendung und warum kurz (max 1 Satz). Antworte zügig.`;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1500, stream: true,
        system: "Du bist ein strenger NIS2-Auditor. Antworte nur mit gueltigem JSON. Bewerte ehrlich. Keine Rechtsberatung behaupten.",
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
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const json = JSON.parse(data);
                  if (json.type === "content_block_delta" && json.delta && json.delta.text) {
                    controller.enqueue(encoder.encode(json.delta.text));
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
    return new Response(JSON.stringify({ error: "Server-Ausnahme: " + ((err && err.message) || String(err)) }), { status: 500, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  }
}
