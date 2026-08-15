const { GoogleGenerativeAI } = require("@google/generative-ai");

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

const CATEGORIES = [
  "Food",
  "Travel",
  "Clothing",
  "Groceries",
  "Entertainment",
  "Utilities",
  "Other",
];

const PROMPT = `You are a receipt parser. Read the bill image and extract its contents.

Respond with strict JSON only. No markdown code fences, no preamble, no explanation.

The JSON must match exactly this shape:
{
  "merchantName": string,
  "items": [{ "name": string, "price": number, "quantity": number }],
  "total": number,
  "category": string,
  "billDate": string | null
}

Rules:
- "category" must be one of: ${CATEGORIES.join(", ")}.
- "billDate" must be an ISO date string (YYYY-MM-DD) or null if the bill has no readable date.
- "price" is the line total for that item, as a number without currency symbols.
- "quantity" defaults to 1 when the bill does not state one.
- Use "" for an unreadable merchant name and [] when no line items are legible.`;

function stripCodeFences(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

async function extractBillFromImage(imageBuffer, mimeType) {
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new Error("extractBillFromImage requires a non-empty image buffer");
  }
  if (typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
    throw new Error(`Unsupported mime type for bill extraction: ${mimeType}`);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent([
    { text: PROMPT },
    { inlineData: { data: imageBuffer.toString("base64"), mimeType } },
  ]);

  const rawText = result.response.text();
  const jsonText = stripCodeFences(rawText);

  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    throw new Error(
      `Gemini returned a non-JSON bill extraction response: ${parseError.message}. Response was: ${rawText}`
    );
  }
}

module.exports = { extractBillFromImage, CATEGORIES };