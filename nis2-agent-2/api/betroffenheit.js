// api/betroffenheit.js — NIS2-Betroffenheitsprüfung
export const config = { runtime: "edge" };

const SCOPE_KNOWLEDGE = `
=== NIS2 ANWENDUNGSBEREICH (DEUTSCHE UMSETZUNG IM BSIG) ===

RECHTSSTAND: Die NIS2-Richtlinie wurde in Deutschland durch das NIS2-Umsetzungs- und Cybersicherheitsstärkungsgesetz (NIS2UmsuCG) umgesetzt, das das BSI-Gesetz (BSIG) grundlegend novelliert hat. Das Gesetz ist seit dem 6. Dezember 2025 ohne Übergangsfrist in Kraft. Die operativen Pflichten ergeben sich aus dem novellierten BSIG (§§ 28 ff.). Pflichten gelten unmittelbar; eine Registrierung beim BSI ist erforderlich.

SCHWELLENWERTE:
Besonders wichtige Einrichtung (§ 28 Abs. 1 BSIG):
- Mind. 250 Mitarbeiter ODER
- Jahresumsatz > 50 Mio. EUR UND Bilanzsumme > 43 Mio. EUR
- In einem Sektor der Anlage 1
- KRITIS-Betreiber gelten automatisch als besonders wichtige Einrichtung

Wichtige Einrichtung (§ 28 Abs. 2 BSIG):
- Mind. 50 Mitarbeiter ODER
- Jahresumsatz UND Bilanzsumme > 10 Mio. EUR
- In einem Sektor der Anlage 1 oder 2

SEKTOREN ANLAGE 1 (Sektoren hoher Kritikalität):
- Energie (Strom, Fernwärme, Öl, Gas, Wasserstoff)
- Verkehr (Luft, Schiene, Wasser, Straße)
- Finanzwesen (Kreditinstitute, Finanzmärkte)
- Gesundheitswesen (Einrichtungen, Labore, Pharma, Medizinprodukte)
- Trinkwasser
- Abwasser
- Digitale Infrastruktur (IXP, DNS, TLD, Cloud, Rechenzentren, CDN, Vertrauensdienste, TK)
- IKT-Diensteverwaltung (Managed Services, Managed Security Services)
- Öffentliche Verwaltung
- Weltraum

SEKTOREN ANLAGE 2 (Sonstige kritische Sektoren):
- Post- und Kurierdienste
- Abfallbewirtschaftung
- Chemie (Herstellung, Handel)
- Lebensmittel (Produktion, Verarbeitung, Vertrieb)
- Verarbeitendes Gewerbe (Medizinprodukte, Datenverarbeitungsgeräte, Elektro, Maschinenbau, Kraftfahrzeuge)
- Anbieter digitaler Dienste (Online-Marktplätze, Suchmaschinen, soziale Netzwerke)
- Forschung

SONDERFÄLLE (größenunabhängig immer betroffen):
- Qualifizierte Vertrauensdiensteanbieter
- TLD-Name-Registries
- DNS-Diensteanbieter
- Anbieter öffentlicher TK-Netze (teilweise)
- KRITIS-Betreiber nach BSI-Gesetz

KEINE BETROFFENHEIT typisch wenn:
- Unter 50 Mitarbeiter UND unter 10 Mio EUR Umsatz/Bilanz
- UND nicht in Anlage 1/2 Sektor
- UND kein Sonderfall
ABER: Kann als Zulieferer indirekt über Lieferkettenanforderungen betroffen sein
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

  const { profil } = body;
  if (!profil) return new Response(JSON.stringify({ error: "Kein Profil" }), { status: 400, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });

  const prompt = `Du bist ein NIS2-Rechtsexperte. Prüfe anhand der Wissensbasis ob das Unternehmen von NIS2 betroffen ist.

WISSENSBASIS:
${SCOPE_KNOWLEDGE}

UNTERNEHMENSANGABEN:
${JSON.stringify(profil, null, 2)}

WICHTIG:
- Beziehe dich auf das deutsche BSIG (nicht "NIS2UmsuCG" als Pflichtennorm). Die Pflichten stehen im novellierten BSIG, §§ 28 ff.
- Formuliere die Begründung KLAR und in einfachen Sätzen. Nenne den entscheidenden Grund zuerst (z.B. "Betroffen, weil: Sektor Trinkwasser + mind. 250 Mitarbeiter. Umsatz/Bilanz sind hier nicht ausschlaggebend.").
- Wenn die Mitarbeiterzahl allein schon zur Einstufung führt, sage das ausdrücklich.
- Verwende keine veralteten EU-Fristen (z.B. "Oktober 2024"). Das Gesetz ist seit Dezember 2025 in Kraft.

Antworte AUSSCHLIESSLICH mit gültigem JSON (keine Backticks):
{
  "status": "betroffen|wahrscheinlich_betroffen|unklar|nicht_betroffen",
  "einstufung": "besonders_wichtige_einrichtung|wichtige_einrichtung|keine|unklar",
  "begruendung": "klare Begründung, wichtigster Grund zuerst, mit BSIG-Paragraphenbezug",
  "offeneFragen": ["was noch geklärt werden muss"],
  "handlungsempfehlung": "konkreter nächster Schritt",
  "fristen": "relevante Pflichten/Fristen nach aktuellem BSIG falls betroffen",
  "rechtshinweis": "Hinweis dass dies keine Rechtsberatung ersetzt"
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
        model: "claude-sonnet-4-6", max_tokens: 1500, stream: true,
        system: "Du bist ein NIS2-Experte. Antworte nur mit gültigem JSON. Wenn Angaben fehlen, setze Status auf unklar und benenne die offenen Fragen. Keine Rechtsberatung behaupten.",
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
