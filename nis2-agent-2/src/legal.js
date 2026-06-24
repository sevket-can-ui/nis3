// src/legal.js — Rechtstexte. WICHTIG: Platzhalter [...] mit echten Daten ersetzen!
// Hinweis: Diese Texte sind Vorlagen. Vor dem öffentlichen Betrieb von einem
// Anwalt oder über einen Datenschutz-Generator (z.B. eRecht24) prüfen lassen.

export const ANBIETER = {
  name: "Sevket-Can Altintas — IT-Security & Compliance",
  strasse: "Alte Gladbacher Strasse 28",
  plz_ort: "47805, Krefeld",
  email: "info@samtech-consulting.de
  telefon: "[optional: Telefonnummer]",
  ustId: "[optional: USt-IdNr. falls vorhanden]",
};

export const IMPRESSUM = `
## Impressum

### Angaben gemäß § 5 DDG (Digitale-Dienste-Gesetz)

${ANBIETER.name}
${ANBIETER.strasse}
${ANBIETER.plz_ort}

### Kontakt

E-Mail: ${ANBIETER.email}
${ANBIETER.telefon !== "[optional: Telefonnummer]" ? "Telefon: " + ANBIETER.telefon : ""}

### Umsatzsteuer

${ANBIETER.ustId !== "[optional: USt-IdNr. falls vorhanden]" ? "Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: " + ANBIETER.ustId : "Als Kleinunternehmer im Sinne von § 19 UStG wird keine Umsatzsteuer ausgewiesen."}

### Verantwortlich für den Inhalt gemäß § 18 Abs. 2 MStV

${ANBIETER.name}
${ANBIETER.strasse}
${ANBIETER.plz_ort}

### Haftung für Inhalte

Die Inhalte dieses Dienstes wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine Gewähr übernommen werden. Die bereitgestellten Analysen, Einschätzungen und Berichte stellen eine strukturierte Orientierungshilfe dar und ersetzen keine rechtliche Beratung, keine offizielle Einstufung durch das BSI und keine verbindliche Compliance-Prüfung.

### Haftung für Links

Dieser Dienst kann Links zu externen Websites Dritter enthalten, auf deren Inhalte kein Einfluss besteht. Für diese fremden Inhalte wird keine Gewähr übernommen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.

### Streitschlichtung

Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr. Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle bestehen weder eine Verpflichtung noch eine Bereitschaft.
`;

export const DATENSCHUTZ = `
## Datenschutzerklärung

### 1. Verantwortlicher

Verantwortlich für die Datenverarbeitung auf diesem Dienst ist:

${ANBIETER.name}
${ANBIETER.strasse}
${ANBIETER.plz_ort}
E-Mail: ${ANBIETER.email}

### 2. Überblick

Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Wir verarbeiten Ihre Daten ausschließlich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, BDSG). Diese Datenschutzerklärung informiert Sie über Art, Umfang und Zweck der Verarbeitung.

### 3. Welche Daten wir verarbeiten

**a) Beim Aufruf des Dienstes**
Beim Besuch werden durch unseren Hosting-Anbieter automatisch technische Daten verarbeitet (z.B. IP-Adresse, Browsertyp, Zugriffszeitpunkt), die für den sicheren Betrieb erforderlich sind. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb).

**b) Bei Registrierung und Anmeldung**
Wenn Sie sich anmelden, verarbeiten wir Ihre E-Mail-Adresse zur Authentifizierung (Magic-Link-Verfahren). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).

**c) Von Ihnen eingegebene und hochgeladene Inhalte**
Wenn Sie Unternehmensangaben eingeben oder Dokumente hochladen, werden diese verarbeitet, um die NIS2-Analyse zu erstellen. Hochgeladene Dokumente werden zur Textanalyse verarbeitet. Wenn Sie eine Prüfung speichern, werden die Ergebnisse in Ihrem Konto gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.

Bitte laden Sie keine Dokumente mit besonders sensiblen personenbezogenen Daten Dritter hoch, soweit dies nicht erforderlich ist.

### 4. Eingesetzte Dienstleister (Auftragsverarbeiter)

Wir setzen folgende Dienstleister ein, mit denen Verträge zur Auftragsverarbeitung gemäß Art. 28 DSGVO bestehen bzw. abzuschließen sind:

**Vercel Inc.** (Hosting des Dienstes) — 340 S Lemon Ave #4133, Walnut, CA 91789, USA. Verarbeitung von Zugriffsdaten zum Betrieb.

**Supabase Inc.** (Datenbank und Authentifizierung) — Speicherung Ihrer Konto- und Prüfungsdaten.

**Anthropic PBC** (KI-Analyse) — 548 Market Street, San Francisco, CA 94104, USA. Die von Ihnen eingegebenen Angaben und Dokumenttexte werden zur Analyse an die Schnittstelle von Anthropic übermittelt.

Bei der Übermittlung in Drittländer (USA) erfolgt die Absicherung über die EU-Standardvertragsklauseln bzw. einen anerkannten Angemessenheitsbeschluss, soweit anwendbar.

### 5. Speicherdauer

Wir speichern personenbezogene Daten nur so lange, wie es für die genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Gespeicherte Prüfungen bleiben erhalten, bis Sie diese oder Ihr Konto löschen.

### 6. Ihre Rechte

Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Wenden Sie sich dazu an ${ANBIETER.email}. Zudem besteht ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde.

### 7. Datensicherheit

Die Übertragung erfolgt verschlüsselt über HTTPS. Wir treffen angemessene technische und organisatorische Maßnahmen zum Schutz Ihrer Daten.

### 8. Aktualität

Diese Datenschutzerklärung wird bei Bedarf angepasst, um sie an geänderte Rechtslage oder Funktionen anzupassen.
`;

export const AGB = `
## Allgemeine Geschäftsbedingungen (AGB)

### 1. Geltungsbereich

Diese AGB gelten für die Nutzung des Dienstes "NIS2 Agent", betrieben von ${ANBIETER.name} (nachfolgend "Anbieter"). Mit der Nutzung erkennen Sie diese Bedingungen an.

### 2. Leistungsbeschreibung

Der Dienst stellt eine softwaregestützte, strukturierte Ersteinschätzung zur NIS2-Betroffenheit und -Vorbereitung bereit. Die Ergebnisse umfassen Betroffenheitsprüfung, Dokumentenbewertung, Readiness-Score, Gap-Analyse und Maßnahmenempfehlungen.

### 3. Keine Rechts- oder Compliance-Beratung

Die Inhalte stellen ausdrücklich **keine Rechtsberatung**, keine offizielle Einstufung durch das BSI und keine Garantie der Erfüllung gesetzlicher Anforderungen dar. Die Ergebnisse dienen der Orientierung. Für rechtsverbindliche Bewertungen ist fachkundige Beratung (z.B. Rechtsanwalt, zertifizierter Auditor) hinzuzuziehen. Eine Haftung für Entscheidungen, die auf Basis der Ergebnisse getroffen werden, ist im gesetzlich zulässigen Rahmen ausgeschlossen.

### 4. Kostenlose und kostenpflichtige Leistungen

Bestimmte Funktionen sind kostenlos. Erweiterte Funktionen ("Professional Report", "Compliance Workspace") können kostenpflichtig sein. Preise und Leistungsumfang werden vor dem Kauf angezeigt.

### 5. Pflichten des Nutzers

Sie verpflichten sich, keine rechtswidrigen Inhalte hochzuladen und keine Rechte Dritter zu verletzen. Sie sind für die Richtigkeit Ihrer Eingaben selbst verantwortlich.

### 6. Verfügbarkeit

Der Anbieter bemüht sich um einen zuverlässigen Betrieb, übernimmt jedoch keine Gewähr für eine ununterbrochene Verfügbarkeit.

### 7. Haftung

Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper und Gesundheit. Im Übrigen ist die Haftung auf vertragstypische, vorhersehbare Schäden begrenzt, soweit gesetzlich zulässig.

### 8. Schlussbestimmungen

Es gilt deutsches Recht. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.
`;

export const VERTRAULICHKEIT = `
## Datenschutz & Vertraulichkeit

Sie laden bei der Nutzung dieses Dienstes möglicherweise interne Sicherheitsdokumente hoch. Wir nehmen den Schutz dieser Daten ernst. Diese Seite fasst zusammen, wie wir mit Ihren Uploads umgehen.

### Was mit Ihren Dokumenten passiert

**Zweckbindung**
Hochgeladene Dokumente werden ausschließlich verwendet, um Ihre NIS2-Analyse zu erstellen. Aus dem Dokument wird der Textinhalt gelesen und zur fachlichen Bewertung an unsere KI-Schnittstelle übermittelt.

**Keine Nutzung für KI-Training**
Die Inhalte Ihrer Dokumente und Eingaben werden nicht zum Training von KI-Modellen verwendet. Die eingesetzte KI-Schnittstelle (Anthropic) verarbeitet die Inhalte ausschließlich zur Beantwortung der jeweiligen Analyse-Anfrage.

**Verschlüsselung**
Die Übertragung erfolgt verschlüsselt über HTTPS (Transit). Die Speicherung bei unserem Datenbank-Anbieter erfolgt verschlüsselt (at rest).

### Zugriff und Trennung

**Mandantentrennung**
Gespeicherte Prüfungen sind Ihrem Konto zugeordnet. Durch technische Zugriffsregeln (Row-Level-Security) kann jeder Nutzer ausschließlich seine eigenen Daten sehen. Andere Nutzer haben keinen Zugriff auf Ihre Prüfungen oder Dokumente.

**Zugriffsbeschränkung**
Der Zugriff auf die zugrundeliegende Infrastruktur ist auf den Betreiber beschränkt und erfolgt nur, soweit es für Betrieb, Wartung und Fehlerbehebung erforderlich ist.

### Speicherung und Löschung

**Speicherdauer**
Wenn Sie eine Prüfung in Ihrem Konto speichern, bleiben die Ergebnisse erhalten, bis Sie diese löschen. Nicht gespeicherte Eingaben einer Sitzung werden nicht dauerhaft vorgehalten.

**Löschung**
Sie können gespeicherte Prüfungen jederzeit löschen. Auf Wunsch löschen wir Ihr Konto und alle zugehörigen Daten. Wenden Sie sich dazu an die im Impressum genannte Kontaktadresse.

### Eingesetzte Dienstleister

Zur Erbringung des Dienstes setzen wir Vercel (Hosting), Supabase (Datenbank und Authentifizierung) und Anthropic (KI-Analyse) ein. Details und die datenschutzrechtliche Einordnung finden Sie in unserer Datenschutzerklärung.

### Ihre Verantwortung

Bitte laden Sie nur Dokumente hoch, zu deren Verarbeitung Sie berechtigt sind. Vermeiden Sie das Hochladen besonders sensibler personenbezogener Daten Dritter, soweit dies für die Analyse nicht erforderlich ist.

### Hinweis

Diese Übersicht beschreibt unseren Umgang mit Ihren Daten in verständlicher Form. Maßgeblich im rechtlichen Sinne ist die vollständige Datenschutzerklärung.
`;
