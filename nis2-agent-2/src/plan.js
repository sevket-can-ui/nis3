// src/plan.js — Free-to-Paid Funnel: Pläne und Feature-Zugriff
// Noch keine echte Zahlung — nur die Logik und UI-Steuerung.

export const PLANS = {
  free: {
    id: "free", name: "Free", preis: "0 €", periode: "",
    tagline: "Erste Orientierung",
    features: ["Betroffenheitsprüfung", "Kurzfazit & Status", "3 wichtigste nächste Schritte", "Hinweis auf benötigte Dokumente"],
  },
  professional: {
    id: "professional", name: "Professional Report", preis: "299 €", periode: "einmalig",
    tagline: "Die vollständige Analyse",
    features: ["Alles aus Free", "Vollständige Dokumentenprüfung", "Readiness-Score 0–100", "Gap-Analyse nach Themen", "Priorisierter Maßnahmenplan", "PDF-Report-Export"],
  },
  business: {
    id: "business", name: "Compliance Workspace", preis: "ab 49 €", periode: "/Monat",
    tagline: "Laufende Compliance",
    features: ["Alles aus Professional", "Mehrere Unternehmen", "Wiederholte Prüfungen", "Verlauf & Verwaltung", "Dokumentenvorlagen", "Aktualisierte Wissensbasis"],
  },
};

// Welcher Plan kann was?
export const FEATURE_ACCESS = {
  free: {
    canRunBasicAssessment: true,
    canViewFullAssessment: false,
    canUploadDocuments: true,       // hochladen ja, aber Analyse-Tiefe gesperrt
    canAnalyzeDocuments: true,      // wir lassen die Analyse zu, aber Details gelockt
    canViewGapAnalysis: false,
    canGenerateActionPlan: false,
    canExportPdf: false,
    canGenerateTemplates: false,
    canSaveProjects: true,
  },
  professional: {
    canRunBasicAssessment: true, canViewFullAssessment: true, canUploadDocuments: true,
    canAnalyzeDocuments: true, canViewGapAnalysis: true, canGenerateActionPlan: true,
    canExportPdf: true, canGenerateTemplates: true, canSaveProjects: true,
  },
  business: {
    canRunBasicAssessment: true, canViewFullAssessment: true, canUploadDocuments: true,
    canAnalyzeDocuments: true, canViewGapAnalysis: true, canGenerateActionPlan: true,
    canExportPdf: true, canGenerateTemplates: true, canSaveProjects: true,
  },
};

export function can(plan, feature) {
  return FEATURE_ACCESS[plan]?.[feature] ?? false;
}
