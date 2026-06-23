// api/betroffenheit.js — NIS2-Betroffenheitsprüfung
export const config = { runtime: "edge" };

const SCOPE_KNOWLEDGE = `
=== NIS2 ANWENDUNGSBEREICH (DEUTSCHE UMSETZUNG NIS2UmsuCG) ===

SCHWELLENWERTE:
Besonders wichtige Einrichtung (§ 28 Abs. 1 NIS2UmsuCG):
- Mind. 250 Mitarbeiter ODER
- Jahresumsatz > 50 Mio. EUR UND Bilanzsumme > 43 Mio. EUR
- In einem Sektor der Anlage 1

Wichtige Einrichtung (§ 28 Abs. 2):
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

Antworte AUSSCHLIESSLICH mit gültigem JSON (keine Backticks):
{
  "status": "betroffen|wahrscheinlich_betroffen|unklar|nicht_betroffen",
  "einstufung": "besonders_wichtige_einrichtung|wichtige_einrichtung|keine|unklar",
  "begruendung": "konkrete Begründung mit Paragraphenbezug",
  "offeneFragen": ["was noch geklärt werden muss"],
  "handlungsempfehlung": "konkreter nächster Schritt",
  "fristen": "relevante Fristen falls betroffen",
  "rechtshinweis": "Hinweis dass dies keine Rechtsberatung ersetzt"
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
        max_tokens: 1500,
        system: "Du bist ein NIS2-Experte. Antworte nur mit gültigem JSON. Wenn Angaben fehlen, setze Status auf unklar und benenne die offenen Fragen. Keine Rechtsberatung behaupten.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return new Response(JSON.stringify({ error: "Anthropic-Fehler (" + res.status + "): " + errText.slice(0, 300) }), { status: 502, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    }
    const data = await res.json();
    let text = data.content?.find(b => b.type === "text")?.text || "";
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return new Response(JSON.stringify({ result: text }), { status: 200, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server-Ausnahme: " + (err?.message || String(err)) }), { status: 500, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  }
}
