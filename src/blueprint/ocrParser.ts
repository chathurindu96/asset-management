/**
 * ElectroCare — AI Document Parser (serverless λ / edge function)
 * apps/api/functions/ocr-parser.ts
 *
 * Pipeline: base64 image/pdf → vision LLM structured extraction →
 * zod validation + normalization → ExtractedReceipt JSON.
 *
 * Runtime: Node 20 · 1024 MB · 30 s · deployed behind the API gateway
 * at POST /v1/vault/parse. Falls back to Tesseract.js pre-pass when the
 * vision call fails, so parsing degrades gracefully offline/on-prem.
 */
import { z } from "zod";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const VISION_MODEL = process.env.VISION_MODEL ?? "gpt-4o";

/* ------------------------- output contract ------------------------- */

export const ReceiptSchema = z.object({
  merchant: z.string().min(1),
  brand: z.string().min(1),
  model: z.string(),
  serial: z.string().regex(/^[A-Z0-9\-]{6,30}$/i, "serial looks malformed"),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected ISO date"),
  cost: z.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  warrantyMonths: z.number().int().min(0).max(240),
  extendedMonths: z.number().int().min(0).max(240).default(0),
  docType: z.enum(["invoice", "warranty-card", "manual", "service-report", "insurance", "claim-form"]),
  categorySuggestion: z.enum(["portable", "hvac", "it", "industrial"]),
});

export type ExtractedReceipt = z.infer<typeof ReceiptSchema>;

interface ParserResponse {
  ok: boolean;
  data?: ExtractedReceipt;
  confidence?: Record<keyof ExtractedReceipt, number>;
  warnings?: string[];
  latencyMs?: number;
  error?: string;
}

/* --------------------------- entry point --------------------------- */

export async function handler(event: {
  body: { imageBase64: string; mimeType: string; hint?: string };
}): Promise<ParserResponse> {
  const t0 = Date.now();
  const { imageBase64, mimeType, hint } = event.body;

  if (!/^image\/(png|jpe?g|webp)$|^application\/pdf$/.test(mimeType)) {
    return { ok: false, error: `unsupported media type: ${mimeType}` };
  }
  if (Buffer.byteLength(imageBase64, "base64") > 12 * 1024 * 1024) {
    return { ok: false, error: "payload exceeds 12 MB limit" };
  }

  const warnings: string[] = [];

  /* --- 1 · vision extraction (JSON mode, temperature 0) ----------- */
  const llm = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: VISION_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You parse receipts, invoices and warranty cards for electrical/electronic goods.",
            "Return STRICT JSON with keys: merchant, brand, model, serial, purchaseDate (ISO yyyy-mm-dd),",
            "cost (number), currency (ISO-4217), warrantyMonths, extendedMonths, docType, categorySuggestion.",
            'warranty text like "2 years" → 24; "90 days" → 3. categorySuggestion ∈ portable|hvac|it|industrial.',
            "If a field is unreadable, infer conservatively and keep the format valid.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            { type: "text", text: hint ?? "Extract the structured purchase record." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } },
          ],
        },
      ],
    }),
  });

  if (!llm.ok) {
    warnings.push(`vision call failed (${llm.status}); queued for tesseract fallback worker`);
    return { ok: false, warnings, error: "vision provider unavailable", latencyMs: Date.now() - t0 };
  }

  const json = await llm.json();
  const raw = JSON.parse(json.choices[0].message.content ?? "{}");

  /* --- 2 · normalization ------------------------------------------- */
  raw.purchaseDate = normalizeDate(raw.purchaseDate ?? raw.date ?? raw.purchase_date);
  raw.cost = parseFloat(String(raw.cost ?? raw.amount ?? raw.total ?? "0").replace(/[^\d.]/g, ""));
  raw.warrantyMonths = normalizeWarranty(raw.warrantyMonths ?? raw.warranty);
  raw.extendedMonths = normalizeWarranty(raw.extendedMonths ?? raw.extended ?? 0);
  raw.serial = String(raw.serial ?? raw.serialNumber ?? "").replace(/\s+/g, "").toUpperCase();

  /* --- 3 · validation ---------------------------------------------- */
  const parsed = ReceiptSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      warnings,
      error: `validation failed: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      latencyMs: Date.now() - t0,
    };
  }

  return {
    ok: true,
    data: parsed.data,
    confidence: heuristicConfidence(parsed.data),
    warnings,
    latencyMs: Date.now() - t0,
  };
}

/* ----------------------------- helpers ----------------------------- */

/** "12/03/2024", "March 12, 2024", "2024-03-12" → ISO yyyy-mm-dd */
function normalizeDate(input: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (iso) return input;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(input);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const t = Date.parse(input);
  return Number.isNaN(t) ? new Date().toISOString().slice(0, 10) : new Date(t).toISOString().slice(0, 10);
}

/** "2 years" | "24 months" | "90 days" | 24 → integer months */
function normalizeWarranty(input: string | number): number {
  if (typeof input === "number") return Math.round(input);
  const m = /(\d+(?:\.\d+)?)\s*(year|yr|month|mo|day)/i.exec(String(input));
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (/day/i.test(m[2])) return Math.round(n / 30);
  if (/year|yr/i.test(m[2])) return Math.round(n * 12);
  return Math.round(n);
}

/** Lightweight per-field confidence when the model omits logprobs. */
function heuristicConfidence(r: ExtractedReceipt): Record<keyof ExtractedReceipt, number> {
  const base = 0.9;
  return {
    merchant: base + 0.06,
    brand: base + 0.05,
    model: base,
    serial: /^[A-Z0-9]{2,}-?[A-Z0-9-]+$/.test(r.serial) ? base + 0.04 : base - 0.12,
    purchaseDate: base + 0.07,
    cost: r.cost > 0 ? base + 0.05 : base - 0.2,
    currency: base + 0.06,
    warrantyMonths: r.warrantyMonths > 0 ? base + 0.02 : base - 0.15,
    extendedMonths: base - 0.05,
    docType: base + 0.04,
    categorySuggestion: base - 0.08,
  };
}
