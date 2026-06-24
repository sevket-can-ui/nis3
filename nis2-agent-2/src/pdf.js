// src/pdf.js — Erzeugt einen echten, sauberen PDF-Report (nicht nur Screenshot)
import { jsPDF } from "jspdf";
import { ANBIETER } from "./legal";

// Farben
const BLAU = [37, 99, 235];
const DUNKEL = [30, 41, 59];
const GRAU = [100, 116, 139];
const ROT = [220, 38, 38];
const AMBER = [217, 119, 6];
const GRUEN = [22, 163, 74];

function riskColor(level) {
  const l = (level || "").toLowerCase();
  if (l.includes("kritisch") || l.includes("hoch")) return ROT;
  if (l.includes("mittel")) return AMBER;
  return GRUEN;
}

export function generateReportPDF({ report, profil, betroffenheit, evidences }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18; // Breite, Rand
  let y = 0;

  // ─── Kopf / Siegel ───
  doc.setFillColor(...DUNKEL);
  doc.rect(0, 0, W, 32, "F");
  // Logo-Quadrat
  doc.setFillColor(...BLAU);
  doc.roundedRect(M, 9, 13, 13, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("N2", M + 6.5, 17.5, { align: "center" });
  // Titel
  doc.setFontSize(15);
  doc.text("NIS2 Agent", M + 18, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(180, 190, 200);
  doc.text("NIS2-Readiness-Report", M + 18, 21);
  // Anbieter rechts (Siegel)
  doc.setFontSize(8);
  doc.setTextColor(180, 190, 200);
  doc.text(ANBIETER.name, W - M, 13, { align: "right" });
  doc.text("Erstellt am " + new Date().toLocaleDateString("de-DE"), W - M, 18, { align: "right" });
  doc.text("Stand: BSIG (Dez. 2025)", W - M, 23, { align: "right" });

  y = 44;

  // ─── Titel + Firma ───
  doc.setTextColor(...DUNKEL);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("NIS2-Readiness-Report", M, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GRAU);
  doc.text((profil?.name || "Unternehmen") + (profil?.branche ? " · " + profil.branche : ""), M, y);
  y += 12;

  // ─── Score-Box ───
  const score = report?.readinessScore ?? 0;
  const sc = riskColor(report?.riskLevel);
  doc.setDrawColor(...sc);
  doc.setLineWidth(0.5);
  doc.roundedRect(M, y, W - 2 * M, 30, 2, 2, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.setTextColor(...sc);
  doc.text(String(score), M + 8, y + 20);
  doc.setFontSize(11);
  doc.setTextColor(...GRAU);
  doc.text("/100", M + 8 + doc.getTextWidth(String(score)) + 3, y + 20);
  // Risiko-Label
  doc.setFontSize(10);
  doc.setTextColor(...sc);
  doc.setFont("helvetica", "bold");
  doc.text("Risiko: " + (report?.riskLevel || "unbekannt").toUpperCase(), M + 45, y + 12);
  // Executive Summary (umgebrochen)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...DUNKEL);
  const summary = doc.splitTextToSize(report?.executiveSummary || "", W - 2 * M - 50);
  doc.text(summary.slice(0, 4), M + 45, y + 18);
  y += 38;

  // ─── Betroffenheit ───
  if (betroffenheit) {
    y = checkPage(doc, y, 30);
    sectionTitle(doc, "Betroffenheitsstatus", M, y); y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const bColor = betroffenheit.status === "betroffen" ? ROT : AMBER;
    doc.setTextColor(...bColor);
    doc.text((betroffenheit.status || "").replace(/_/g, " ").toUpperCase(), M, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DUNKEL);
    const bText = doc.splitTextToSize(betroffenheit.begruendung || "", W - 2 * M);
    doc.text(bText, M, y); y += bText.length * 4.5 + 8;
  }

  // ─── Top-Lücken ───
  if (report?.topGaps?.length) {
    y = checkPage(doc, y, 20);
    sectionTitle(doc, "Top-Lücken", M, y); y += 7;
    doc.setFontSize(9);
    report.topGaps.forEach((gap, i) => {
      y = checkPage(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...ROT);
      doc.text(String(i + 1).padStart(2, "0"), M, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...DUNKEL);
      const gText = doc.splitTextToSize(typeof gap === "string" ? gap : (gap.titel || gap.beschreibung || ""), W - 2 * M - 10);
      doc.text(gText, M + 8, y);
      y += gText.length * 4.5 + 3;
    });
    y += 5;
  }

  // ─── Maßnahmenplan ───
  if (report?.actionPlan) {
    y = checkPage(doc, y, 20);
    sectionTitle(doc, "Priorisierter Maßnahmenplan", M, y); y += 8;
    const phasen = [
      { key: "sofort", label: "Sofort", color: ROT },
      { key: "30tage", label: "Innerhalb 30 Tage", color: AMBER },
      { key: "90tage", label: "Innerhalb 90 Tage", color: BLAU },
    ];
    phasen.forEach(ph => {
      const items = report.actionPlan[ph.key];
      if (!items?.length) return;
      y = checkPage(doc, y, 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...ph.color);
      doc.text(ph.label, M, y); y += 6;
      items.forEach(item => {
        y = checkPage(doc, y, 14);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...DUNKEL);
        const titel = typeof item === "string" ? item : (item.titel || item.massnahme || "");
        const tLines = doc.splitTextToSize(titel, W - 2 * M - 4);
        doc.text(tLines, M + 4, y); y += tLines.length * 4.5;
        const begr = typeof item === "object" ? (item.begruendung || item.beschreibung || "") : "";
        if (begr) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(...GRAU);
          const bLines = doc.splitTextToSize(begr, W - 2 * M - 4);
          doc.text(bLines, M + 4, y); y += bLines.length * 4 + 2;
        }
        y += 2;
      });
      y += 4;
    });
  }

  // ─── Footer auf jeder Seite ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(M, 285, W - M, 285);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAU);
    doc.text("Strukturierte Ersteinschätzung auf Basis einer NIS2-Wissensbasis (BSIG, Stand Dez. 2025). Keine Rechtsberatung, keine offizielle BSI-Einstufung, keine Garantie der Compliance.", M, 289, { maxWidth: W - 2 * M });
    doc.text(ANBIETER.name + "  ·  NIS2 Agent", M, 294);
    doc.text("Seite " + p + " / " + pageCount, W - M, 294, { align: "right" });
  }

  doc.save("NIS2-Readiness-Report-" + (profil?.name || "Report").replace(/[^a-zA-Z0-9]/g, "_") + ".pdf");
}

function sectionTitle(doc, text, x, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(text.toUpperCase(), x, y);
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.4);
  doc.line(x, y + 1.5, x + doc.getTextWidth(text.toUpperCase()), y + 1.5);
}

function checkPage(doc, y, needed) {
  if (y + needed > 280) {
    doc.addPage();
    return 22;
  }
  return y;
}
