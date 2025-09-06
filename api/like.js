// app/api/like/route.js
// Runs on Node so the OpenAI SDK works reliably.
export const runtime = "nodejs";

import OpenAI from "openai";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing OPENAI_API_KEY env var" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { source_place, target_scope } = await request.json();
    if (!source_place || !target_scope) {
      return new Response(
        JSON.stringify({ error: "Please provide source_place and target_scope" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const openai = new OpenAI({ apiKey });

    // Prompt: return 3 strong “ish” matches with why + highlights (tags)
    const sys = `You recommend neighborhoods or areas that are "kind of like" another—nothing exact, it's all a little... ish.
Return a JSON array with 3 objects. Each object must include:
- match (name only)
- city (if known)
- region (state/country)
- why (2–3 sentences)
- highlights (3–6 short tags)
Keep it concise, friendly, and helpful.`;

    const user = `This place: ${source_place}
Just like that (in): ${target_scope}
Return ONLY JSON (no prose).`;

    // Chat Completions (works broadly)
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      temperature: 0.7,
    });

    let raw = completion.choices?.[0]?.message?.content || "[]";
    // In case model includes code fences, strip them.
    raw = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback: ask model to fix JSON (rare)
      const repair = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Fix this into valid JSON array of objects. Return only JSON." },
          { role: "user", content: raw }
        ],
        temperature: 0,
      });
      const fixed = (repair.choices?.[0]?.message?.content || "").replace(/```json|```/g, "").trim();
      parsed = JSON.parse(fixed || "[]");
    }

    // Normalize into the front-end shape
    const results = (Array.isArray
