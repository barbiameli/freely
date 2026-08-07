import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { extractTextFromFile } from "@/lib/extract-text";
import { MAX_DOCUMENT_UPLOAD_BYTES, documentTooLargeError } from "@/lib/upload-limits";

/**
 * Extracts text from an uploaded file (used by both the Quote wizard's
 * source-material step and Memory's Files tab).
 *
 * This is a real Route Handler rather than a server action on purpose:
 * pdf-parse pulls in pdfjs-dist and native canvas bindings, and Next.js's
 * server-action bundler doesn't reliably trace/bundle those, which surfaces
 * as a cryptic "Object.defineProperty called on non-object" at runtime.
 * Route Handlers run as plain Node.js and don't have that problem.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  // Client already checks this before the request goes out — this is just
  // the backstop for anything that reaches the server anyway (a request
  // this big would usually be rejected by the platform itself first, with
  // a much less helpful error, so the client-side check is what most people
  // will actually see).
  if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
    return NextResponse.json({ error: documentTooLargeError(file) }, { status: 413 });
  }

  try {
    const text = await extractTextFromFile(file);
    return NextResponse.json({ text, fileName: file.name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read that file." },
      { status: 400 }
    );
  }
}
