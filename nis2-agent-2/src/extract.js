// src/extract.js — Text aus PDF/Word/TXT extrahieren (npm-Pakete, kein CDN)
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractText(file) {
  const ext = file.name.split(".").pop().toLowerCase();

  if (["txt", "csv", "md"].includes(ext)) {
    return await file.text();
  }

  if (ext === "pdf") {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text;
  }

  if (ext === "docx") {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }

  throw new Error("Format nicht unterstützt: " + ext + ". Bitte PDF, Word oder Text.");
}
