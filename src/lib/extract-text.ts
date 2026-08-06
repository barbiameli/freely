/**
 * Extracts plain text from an uploaded source file for the Quote wizard and
 * Memory's Files tab. Supports .txt/.md (read directly), .pdf (unpdf), and
 * .docx (mammoth).
 *
 * PDF extraction uses `unpdf` rather than `pdf-parse` — pdf-parse pulls in
 * pdfjs-dist's canvas-dependent build, which doesn't survive Next.js's
 * bundler for real-world PDFs (surfaces as a cryptic
 * "Object.defineProperty called on non-object" at runtime). unpdf ships a
 * canvas-free pdf.js build made for exactly this — serverless/edge/Next.js —
 * environment.
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }

  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(
    `Unsupported file type: ${file.name}. Upload a .txt, .md, .pdf, or .docx file.`
  );
}
