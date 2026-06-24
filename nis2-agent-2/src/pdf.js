// src/pdf.js — Erzeugt einen mehrseitigen, vollständigen PDF-Report mit Anbieter-Siegel
import { jsPDF } from "jspdf";
import { ANBIETER } from "./legal";

const BLAU = [37, 99, 235];
const DUNKEL = [30, 41, 59];
const GRAU = [100, 116, 139];
const HELLGRAU = [148, 163, 184];
const ROT = [220, 38, 38];
const AMBER = [217, 119, 6];
const GRUEN = [22, 163, 74];
const W = 210, M = 18, BOTTOM = 280;

function riskColor(level) {
  const l = (level || "").toLowerCase();
  if (l.includes("kritisch") || l.includes("hoch")) return ROT;
  if (l.includes("mittel")) return AMBER;
  if (l.includes("niedrig")) return GRUEN;
  return GRAU;
}

export function generateReportPDF({ report, profil, betroffenheit, evidences }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = { doc, y: 0, page: 1 };

  drawHeader(doc);
  ctx.y = 44;

  // ─── Titel ───
  doc.setTextColor(...DUNKEL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("NIS2-Readiness-Report", M, ctx.y);
  ctx.y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GRAU);
  doc.text((profil?.name || "Unternehmen") + (profil?.branche ? "  ·  " + profil.branche : ""), M, ctx.y);
  ctx.y += 11;

  // ─── 1. Score-Box + Executive Summary (vollständig) ───
  const score = report?.readinessScore ?? 0;
  const sc = riskColor(report?.riskLevel);
  doc.setDrawColor(...sc);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, ctx.y, W - 2 * M, 26, 2, 2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...sc);
  doc.text(String(score), M + 8, ctx.y + 17);
  doc.setFontSize(10);
  doc.setTextColor(...GRAU);
  doc.text("/100", M + 8 + doc.getTextWidth(String(score)) + 2, ctx.y + 17);
  doc.setFontSize(10);
  doc.setTextColor(...sc);
  doc.setFont("helvetica", "bold");
  doc.text("Risiko: " + (report?.riskLevel || "unbekannt").toUpperCase(), M + 42, ctx.y + 10);
  if (report?.statusText) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAU);
    doc.text(report.statusText, M + 42, ctx.y + 16);
  }
  // Confidence-Level rechts
  if (report?.confidence) {
    const confLabel = { hoch: "Hoch", mittel: "Mittel", niedrig: "Niedrig", sehr_niedrig: "Sehr niedrig" }[report.confidence] || report.confidence;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAU);
    doc.text("Aussagekraft (Confidence):", W - M - 2, ctx.y + 10, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...DUNKEL);
    doc.text(confLabel, W - M - 2, ctx.y + 16, { align: "right" });
  }
  ctx.y += 32;

  // Executive Summary als eigener Block — VOLLSTÄNDIG, nicht abgeschnitten
  sectionTitle(ctx, "1. Executive Summary");
  bodyText(ctx, report?.executiveSummary || "Keine Zusammenfassung verfügbar.");
  if (report?.scoreErklaerung) {
    ctx.y += 2;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...DUNKEL);
    ensureSpace(ctx, 8); doc.text("Wie der Score zustande kommt:", M, ctx.y); ctx.y += 4.5;
    bodyText(ctx, report.scoreErklaerung);
  }
  ctx.y += 4;

  // ─── 2. Betroffenheitsprüfung ───
  if (betroffenheit) {
    sectionTitle(ctx, "2. Betroffenheitsprüfung");
    const bColor = betroffenheit.status === "betroffen" ? ROT : AMBER;
    labelValue(ctx, "Status", (betroffenheit.status || "").replace(/_/g, " ").toUpperCase(), bColor);
    if (betroffenheit.einstufung) labelValue(ctx, "Einstufung", (betroffenheit.einstufung || "").replace(/_/g, " "));
    ctx.y += 2;
    bodyText(ctx, betroffenheit.begruendung || "");
    if (betroffenheit.fristen) {
      ctx.y += 1;
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...DUNKEL);
      ensureSpace(ctx, 8); doc.text("Relevante Pflichten/Fristen:", M, ctx.y); ctx.y += 4.5;
      bodyText(ctx, betroffenheit.fristen);
    }
    ctx.y += 4;
  }

  // ─── 3. Unternehmensangaben ───
  if (profil) {
    sectionTitle(ctx, "3. Unternehmensangaben");
    const rows = [
      ["Unternehmen", profil.name],
      ["Branche", profil.branche],
      ["Mitarbeiter", profil.mitarbeiter],
      ["Jahresumsatz", profil.umsatz],
      ["Bilanzsumme", profil.bilanz],
      ["Rolle/Funktion", profil.rolle],
      ["Kritische Dienste", profil.kritischeDienste],
    ].filter(r => r[1]);
    rows.forEach(r => labelValue(ctx, r[0], String(r[1])));
    ctx.y += 4;
  }

  // ─── 4. Dokumentenprüfung (pro Datei) ───
  sectionTitle(ctx, "4. Dokumentenprüfung");
  if (evidences?.length) {
    evidences.forEach(e => {
      ensureSpace(ctx, 18);
      const r = e.result || {};
      const evScore = r.evidenceScore ?? 0;
      const evColor = evScore >= 70 ? GRUEN : evScore >= 40 ? AMBER : ROT;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(...DUNKEL);
      const nameLines = doc.splitTextToSize(e.name || "Dokument", W - 2 * M - 22);
      doc.text(nameLines, M, ctx.y);
      doc.setTextColor(...evColor);
      doc.text(evScore + "/100", W - M, ctx.y, { align: "right" });
      ctx.y += nameLines.length * 4.5 + 1;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...GRAU);
      const bew = (r.bewertung ? r.bewertung.toUpperCase() + " · " : "") + (r.zusammenfassung || r.erkannterTyp || "");
      const bewLines = doc.splitTextToSize(bew, W - 2 * M);
      ensureSpace(ctx, bewLines.length * 4);
      doc.text(bewLines, M, ctx.y);
      ctx.y += bewLines.length * 4 + 4;
    });
  } else {
    bodyText(ctx, "Es wurden keine Dokumente zur Prüfung eingereicht.");
  }
  ctx.y += 2;

  // ─── 5. Nachweismatrix / Gap-Analyse pro Bereich ───
  if (report?.gapAnalysis?.length) {
    sectionTitle(ctx, "5. Nachweismatrix nach Pflichtbereich");
    report.gapAnalysis.forEach(g => {
      ensureSpace(ctx, 16);
      const gColor = riskColor(g.risiko);
      const statusLabel = statusText(g.status);
      const statusCol = statusColor(g.status);
      // Bereich + Status-Badge + Score
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DUNKEL);
      const berLines = doc.splitTextToSize(g.bereich || "", 95);
      doc.text(berLines, M, ctx.y);
      doc.setFontSize(7.5); doc.setTextColor(...statusCol);
      doc.text(statusLabel.toUpperCase(), M + 100, ctx.y);
      doc.setFontSize(9); doc.setTextColor(...gColor);
      doc.text(String(g.score ?? 0) + "/100", W - M, ctx.y, { align: "right" });
      ctx.y += berLines.length * 4.2 + 1;
      // gefordert / gefunden / begründung
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...GRAU);
      const detail = [];
      if (g.gefordert) detail.push("Gefordert: " + g.gefordert);
      if (g.gefunden) detail.push("Gefunden: " + g.gefunden);
      if (g.begruendung && !g.gefunden) detail.push(g.begruendung);
      detail.forEach(d => {
        const dLines = doc.splitTextToSize(d, W - 2 * M - 2);
        ensureSpace(ctx, dLines.length * 3.6);
        doc.text(dLines, M + 2, ctx.y);
        ctx.y += dLines.length * 3.6;
      });
      doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.1);
      doc.line(M, ctx.y + 1, W - M, ctx.y + 1);
      ctx.y += 4;
    });
    // Legende Status-Modell
    ensureSpace(ctx, 14);
    doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(...HELLGRAU);
    const legende = doc.splitTextToSize("Status-Modell: Nachgewiesen = echtes, freigegebenes Dokument · Teilweise = unvollständig · Entwurf = nur Vorlage, kein Nachweis · Selbstauskunft = beschrieben, kein Beleg · Nicht nachgewiesen = kein Beleg vorhanden.", W - 2 * M);
    doc.text(legende, M, ctx.y); ctx.y += legende.length * 3.2 + 3;
  }

  // ─── 6. Top-Lücken ───
  if (report?.topGaps?.length) {
    sectionTitle(ctx, "6. Wichtigste Lücken");
    report.topGaps.forEach((gap, i) => {
      ensureSpace(ctx, 10);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ROT);
      doc.text(String(i + 1).padStart(2, "0"), M, ctx.y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...DUNKEL);
      const gLines = doc.splitTextToSize(typeof gap === "string" ? gap : (gap.titel || ""), W - 2 * M - 9);
      doc.text(gLines, M + 8, ctx.y);
      ctx.y += gLines.length * 4.5 + 3;
    });
    ctx.y += 3;
  }

  // ─── 7. Maßnahmenplan ───
  if (report?.actionPlan) {
    sectionTitle(ctx, "7. Priorisierter Maßnahmenplan");
    const phasen = [
      { key: "sofort", label: "Sofort", color: ROT },
      { key: "30tage", label: "Innerhalb 30 Tage", color: AMBER },
      { key: "90tage", label: "Innerhalb 90 Tage", color: BLAU },
    ];
    phasen.forEach(ph => {
      const items = report.actionPlan[ph.key];
      if (!items?.length) return;
      ensureSpace(ctx, 12);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...ph.color);
      doc.text(ph.label, M, ctx.y); ctx.y += 6;
      items.forEach(item => {
        ensureSpace(ctx, 12);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...DUNKEL);
        const titel = typeof item === "string" ? item : (item.titel || "");
        const tLines = doc.splitTextToSize(titel, W - 2 * M - 4);
        doc.text(tLines, M + 4, ctx.y); ctx.y += tLines.length * 4.5;
        const begr = typeof item === "object" ? (item.warum || item.begruendung || "") : "";
        const ber = typeof item === "object" ? (item.bereich || "") : "";
        const rolle = typeof item === "object" ? (item.rolle || "") : "";
        const ergebnis = typeof item === "object" ? (item.ergebnis || "") : "";
        if (begr) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAU);
          const bLines = doc.splitTextToSize(begr, W - 2 * M - 4);
          ensureSpace(ctx, bLines.length * 3.8);
          doc.text(bLines, M + 4, ctx.y); ctx.y += bLines.length * 3.8;
        }
        if (ergebnis) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...GRUEN);
          const eLines = doc.splitTextToSize("Ergebnis: " + ergebnis, W - 2 * M - 4);
          ensureSpace(ctx, eLines.length * 3.8);
          doc.text(eLines, M + 4, ctx.y); ctx.y += eLines.length * 3.8;
        }
        if (ber || rolle) {
          doc.setFont("helvetica", "italic"); doc.setFontSize(7.5); doc.setTextColor(...BLAU);
          doc.text([ber, rolle ? "Rolle: " + rolle : ""].filter(Boolean).join("  ·  "), M + 4, ctx.y); ctx.y += 3.5;
        }
        ctx.y += 2.5;
      });
      ctx.y += 3;
    });
  }

  // ─── 9. Berater-Briefing ───
  if (report?.beraterBriefing?.length) {
    sectionTitle(ctx, "9. Berater-Briefing");
    bodyText(ctx, "Die folgenden Punkte sollten Sie von einem externen Berater oder Auditor validieren lassen. Dieser Report bereitet Sie auf das Gespräch vor, ersetzt es aber nicht:");
    ctx.y += 1;
    report.beraterBriefing.forEach(p => {
      ensureSpace(ctx, 8);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...BLAU);
      doc.text("›", M, ctx.y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...DUNKEL);
      const pLines = doc.splitTextToSize(typeof p === "string" ? p : (p.punkt || ""), W - 2 * M - 8);
      doc.text(pLines, M + 6, ctx.y);
      ctx.y += pLines.length * 4.5 + 2;
    });
    ctx.y += 3;
  }

  // ─── 10. Methodik & Rechtsstand ───
  sectionTitle(ctx, "10. Methodik, Grenzen & Rechtsstand");
  bodyText(ctx, "Dieser Report ist eine strukturierte Ersteinschätzung auf Basis einer hinterlegten NIS2-Wissensbasis (deutsches BSIG in der seit 6. Dezember 2025 geltenden Fassung sowie BSI-IT-Grundschutz-Bausteine). Die Bewertung erfolgt anhand der eingegebenen Unternehmensangaben und der eingereichten Nachweise. Ein KI-generierter Entwurf gilt nicht als Nachweis. Ein fehlender Nachweis bedeutet nicht automatisch, dass eine Maßnahme real nicht existiert — sondern dass sie auf Basis der geprüften Informationen nicht belegt wurde. Der Report ersetzt keine verbindliche Rechtsberatung, keine Zertifizierung, keine offizielle BSI-Einstufung und keine Compliance-Garantie. Für rechtsverbindliche Bewertungen ist fachkundige Beratung hinzuzuziehen.");

  // ─── Footer auf allen Seiten ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2);
    doc.line(M, 285, W - M, 285);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAU);
    doc.text("Strukturierte Ersteinschätzung (BSIG, Stand Dez. 2025). Keine Rechtsberatung, keine offizielle BSI-Einstufung, keine Garantie der Compliance.", M, 289, { maxWidth: W - 2 * M });
    doc.text(ANBIETER.name + "  ·  NIS2 Agent", M, 294);
    doc.text("Seite " + p + " / " + pageCount, W - M, 294, { align: "right" });
  }

  doc.save("NIS2-Readiness-Report-" + (profil?.name || "Report").replace(/[^a-zA-Z0-9]/g, "_") + ".pdf");
}

// ─── Helfer ───
function drawHeader(doc) {
  doc.setFillColor(...DUNKEL);
  doc.rect(0, 0, W, 32, "F");
  doc.setFillColor(...BLAU);
  doc.roundedRect(M, 9, 13, 13, 2, 2, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("N2", M + 6.5, 17.5, { align: "center" });
  doc.setFontSize(15); doc.text("NIS2 Agent", M + 18, 15);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(180, 190, 200);
  doc.text("NIS2-Readiness-Report", M + 18, 21);
  doc.setFontSize(8); doc.setTextColor(180, 190, 200);
  doc.text(ANBIETER.name, W - M, 13, { align: "right" });
  doc.text("Erstellt am " + new Date().toLocaleDateString("de-DE"), W - M, 18, { align: "right" });
  doc.text("Stand: BSIG (Dez. 2025)", W - M, 23, { align: "right" });
}

function sectionTitle(ctx, text) {
  ensureSpace(ctx, 14);
  const { doc } = ctx;
  ctx.y += 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...DUNKEL);
  doc.text(text, M, ctx.y);
  doc.setDrawColor(...BLAU); doc.setLineWidth(0.4);
  doc.line(M, ctx.y + 1.5, W - M, ctx.y + 1.5);
  ctx.y += 7;
}

function bodyText(ctx, text) {
  const { doc } = ctx;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...DUNKEL);
  const lines = doc.splitTextToSize(text || "", W - 2 * M);
  lines.forEach(line => {
    ensureSpace(ctx, 5);
    doc.text(line, M, ctx.y);
    ctx.y += 4.6;
  });
}

function labelValue(ctx, label, value, valueColor) {
  const { doc } = ctx;
  ensureSpace(ctx, 6);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...GRAU);
  doc.text(label + ":", M, ctx.y);
  doc.setFont("helvetica", value === (value || "").toUpperCase() && valueColor ? "bold" : "normal");
  doc.setTextColor(...(valueColor || DUNKEL));
  const vLines = doc.splitTextToSize(value || "—", W - 2 * M - 40);
  doc.text(vLines, M + 40, ctx.y);
  ctx.y += Math.max(vLines.length * 4.6, 5);
}

function ensureSpace(ctx, needed) {
  if (ctx.y + needed > BOTTOM) {
    ctx.doc.addPage();
    ctx.y = 22;
    ctx.page++;
  }
}

function statusText(status) {
  const map = {
    nachgewiesen: "Nachgewiesen",
    teilweise: "Teilweise",
    entwurf: "Entwurf",
    selbstauskunft: "Selbstauskunft",
    nicht_nachgewiesen: "Nicht nachgewiesen",
    nicht_bewertbar: "Nicht bewertbar",
  };
  return map[status] || "Nicht nachgewiesen";
}

function statusColor(status) {
  if (status === "nachgewiesen") return GRUEN;
  if (status === "teilweise" || status === "entwurf" || status === "selbstauskunft") return AMBER;
  return ROT;
}
