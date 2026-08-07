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

export function documentTooLargeError(file: File): string {
  return `That file is ${formatFileSize(file.size)}. Uploads are limited to ${formatFileSize(
    MAX_DOCUMENT_UPLOAD_BYTES
  )} for now. Try a smaller file, split it up, or paste the text directly instead.`;
}
