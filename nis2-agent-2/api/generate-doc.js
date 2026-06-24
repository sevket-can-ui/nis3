// api/generate-doc.js — Dokument-Entwurf mit Streaming (kein Timeout)
export const config = { runtime: "edge" };

const DOC_TEMPLATES = {
  "Informationssicherheitsleitlinie": "Erstelle eine Informationssicherheitsleitlinie mit: Verantwortlichkeiten, Geltungsbereich, Sicherheitszielen, Management-Freigabe, Bezug zum Risikomanagement, Review-Zyklus.",
  "Incident-Response-Plan": "Erstelle einen Incident-Response-Plan mit: Meldewegen, Rollen/Verantwortlichkeiten, Eskalationsstufen, 24h-/72h-Meldeprozess ans BSI, Kommunikationsplan, Lessons Learned.",
  "Risikoanalyse": "Erstelle eine Risikoanalyse-Struktur nach BSI 200-3 mit: Asset-Bezug, Schutzbedarfsfeststellung, Bedrohungen, Eintrittswahrscheinlichkeit/Schadenshoehe, Risikobehandlung, Verantwortlichen.",
  "Asset-Inventar": "Erstelle eine Asset-Inventar-Struktur mit: Erfassung aller Systeme, Kritikalitaetsbewertung, Owner, Schutzbedarf, Internetexponierung, Aktualitaet.",
  "Backup- & Notfallkonzept": "Erstelle ein Backup- und Notfallkonzept mit: RTO/RPO je System, Restore-Test-Protokollen, Ransomware-Schutz, 3-2-1-Regel, Verantwortlichen, Review-Prozess.",
  "Lieferantenuebersicht": "Erstelle eine Lieferantenuebersicht mit: Dienstleistern mit Systemzugang, Kritikalitaet, Sicherheitsanforderungen in Vertraegen, Nachweisen, regelmaessiger Pruefung.",
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
  catch { return new Response(JSON.stringify({ error: "Ungueltige Anfrage" }), { status: 400, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } }); }

  const { docType, antworten, firma, branche } = body;
  const template = DOC_TEMPLATES[docType] || ("Erstelle ein Dokument vom Typ " + docType + ".");

  const prompt = "Du bist ein NIS2-Compliance-Berater. " + template +
    "\n\nUnternehmen: " + (firma || "Nicht angegeben") + " (Branche: " + (branche || "unbekannt") + ")" +
    "\n\nAntworten des Nutzers:\n" + JSON.stringify(antworten, null, 2) +
    "\n\nErstelle einen konkreten Dokument-Entwurf auf Deutsch, angepasst an die Antworten. Markiere offene Punkte mit [BITTE ERGAENZEN]. Ca. 400-600 Woerter.";

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1500, stream: true,
        system: "Du bist ein NIS2-Berater. Erstelle praxistaugliche Entwuerfe. Markiere fehlende Angaben mit [BITTE ERGAENZEN]. Keine Rechtssicherheit behaupten.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(JSON.stringify({ error: "Anthropic-Fehler (" + upstream.status + "): " + errText.slice(0, 200) }), { status: 502, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
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
        } catch (e) {
          controller.enqueue(encoder.encode("\n[Fehler beim Streamen]"));
        }
        controller.close();
      },
    });

    return new Response(stream, { status: 200, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server-Ausnahme: " + ((err && err.message) || String(err)) }), { status: 500, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  }
}
