import { getDocument } from "@/lib/db";
import { readDocument } from "@/lib/documents";

// Serves an uploaded file. Opens in the browser by default; ?download=1 saves it instead.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = getDocument(Number(id));
  if (!doc) return new Response("Not found", { status: 404 });

  const body = await readDocument(doc).catch(() => undefined);
  if (!body) return new Response("File is missing from disk", { status: 404 });

  const disposition = new URL(request.url).searchParams.has("download") ? "attachment" : "inline";
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
