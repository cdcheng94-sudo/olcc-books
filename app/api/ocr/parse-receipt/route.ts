import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/categories";

/**
 * Receipt OCR via Gemini Flash. Client POSTs a receipt image (jpeg/png/pdf),
 * we forward the base64 to the generativelanguage REST endpoint with a
 * structured response schema, and return clean JSON the client uses to
 * pre-fill the New Transaction form.
 *
 * We pick the category from our fixed list (CATEGORIES.expense / .income)
 * by setting `enum` on the response schema — Gemini picks one of those
 * values verbatim, so the suggestion drops straight into the form.
 *
 * Auth: requires a signed-in session (covered by the (app) shell). We
 * also rely on the user already being whitelisted via allowed_emails.
 */

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

const MODEL = "gemini-2.0-flash";   // override-able via env if needed
const ALL_CATEGORIES = [...CATEGORIES.income, ...CATEGORIES.expense];

type OCRResult = {
  date?:     string;
  party?:    string;
  amount?:   number;
  category?: string;
  note?:     string;
  type?:     "income" | "expense";
};

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });

  // 1. Pull image out of the multipart body
  let file: File | null = null;
  try {
    const form = await request.formData();
    file = form.get("file") as File | null;
  } catch (e) {
    return NextResponse.json({ error: `Bad form: ${(e as Error).message}` }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
  }

  const mime = file.type || "image/jpeg";
  const buf  = await file.arrayBuffer();
  const b64  = Buffer.from(buf).toString("base64");

  // 2. Build prompt + schema
  const prompt = [
    "You are an accountant's assistant looking at a single receipt or invoice.",
    "Extract the key fields. If a field is uncertain, omit it rather than guess.",
    "",
    "- date:     ISO format YYYY-MM-DD. Use today only if the receipt has none.",
    "- party:    the vendor or store name (or customer name, if this is an income receipt).",
    "- amount:   the FINAL total the user paid (or received), as a plain number, no currency symbol.",
    "- type:     'expense' if money went out, 'income' if money came in.",
    "- category: pick the BEST match from the provided enum. Use 'Other Expense' for general expenses if unsure.",
    "- note:     one short sentence describing what was bought / sold (NOT the vendor name).",
    "",
    "Respond ONLY with the JSON object — no prose, no markdown.",
  ].join("\n");

  const schema = {
    type: "OBJECT",
    properties: {
      date:     { type: "STRING" },
      party:    { type: "STRING" },
      amount:   { type: "NUMBER" },
      type:     { type: "STRING", enum: ["income", "expense"] },
      category: { type: "STRING", enum: ALL_CATEGORIES },
      note:     { type: "STRING" },
    },
    required: ["amount"],
  };

  // 3. Call Gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mime, data: b64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema:   schema,
          temperature:      0.1,
        },
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: `Gemini fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Gemini ${res.status}: ${body.slice(0, 300)}` },
      { status: 502 },
    );
  }

  type GeminiResponse = {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json({ error: "Gemini returned no content" }, { status: 502 });
  }

  let parsed: OCRResult;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Gemini returned non-JSON: " + text.slice(0, 200) }, { status: 502 });
  }

  // 4. Sanitize before returning to client
  const clean: OCRResult = {
    date:     typeof parsed.date === "string"     && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)            ? parsed.date     : undefined,
    party:    typeof parsed.party === "string"    && parsed.party.trim()                                ? parsed.party.trim() : undefined,
    amount:   typeof parsed.amount === "number"   && isFinite(parsed.amount) && parsed.amount > 0       ? +parsed.amount.toFixed(2) : undefined,
    type:     parsed.type === "income" || parsed.type === "expense"                                     ? parsed.type     : "expense",
    category: typeof parsed.category === "string" && ALL_CATEGORIES.includes(parsed.category as never)  ? parsed.category : undefined,
    note:     typeof parsed.note === "string"     && parsed.note.trim()                                 ? parsed.note.trim() : undefined,
  };

  return NextResponse.json({ ok: true, parsed: clean });
}
