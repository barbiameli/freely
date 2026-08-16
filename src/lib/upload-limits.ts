/**
 * Shared cap for document uploads that go through /api/extract-text (Quote
 * wizard source, Memory Files, brand guidelines as PDF/DOCX/TXT/MD).
 *
 * This isn't arbitrary: Vercel's Node serverless functions (which is what
 * this Route Handler runs as — see extract-text/route.ts's `runtime =
 * "nodejs"`) reject request bodies over ~4.5MB at the platform level with a
 * generic 413, before our own code ever runs. A file that big would fail
 * with a cryptic, unhelpful error no matter what we do server-side — so the
 * only real fix is stopping it client-side first, with an explanation the
 * platform limit can't give on its own.
 */
export const MAX_DOCUMENT_UPLOAD_BYTES = 4 * 1024 * 1024; // 4MB, safely under the ~4.5MB platform ceiling

export function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * What else somebody can do, which depends on where they are.
 *
 * One message used to be shown everywhere, and it offered two things that were
 * only possible in some of those places: pasting the text, and splitting the
 * file up. On the brand guidelines step neither is true. There is no text field
 * to paste into, and a second upload replaces the first rather than adding to
 * it, so somebody following the advice would lose half their guide and not know
 * why.
 *
 * "paste" for the places with a text box beside the upload. "several" for the
 * places that keep a list of files. Nothing for the places that take one file
 * and only one.
 */
type Alternative = "paste" | "several";

export function documentTooLargeError(file: File, alternative?: Alternative): string {
  const base =
    `That file is ${formatFileSize(file.size)}. Uploads are limited to ` +
    `${formatFileSize(MAX_DOCUMENT_UPLOAD_BYTES)} for now. Try a smaller one, ` +
    `or export it again at a lower quality.`;

  if (alternative === "paste") return `${base} You can also paste the text straight in.`;
  if (alternative === "several") {
    return `${base} You can also split it and upload the parts one at a time.`;
  }
  return base;
}
