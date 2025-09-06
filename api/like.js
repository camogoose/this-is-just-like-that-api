// app/api/like/route.js

// ---- CORS helpers ----
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Preflight (for browser CORS checks)
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req) {
  try {
    const { source_place, target_scope } = await req.json();

    if (!source_place || !target_scope) {
      return new Response(
        JSON.stringify({ error: "Missing source_place or target_scope" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ---- Prompt (force JSON) ----
    const prompt = `
Return ONLY a JSON object in this exact shape:

{
  "match": "best neighborhood/city match",
  "why": "one-sentence explanation (<=200 chars)",
  "tags": ["tag1","tag2","tag3"]
}

Source: "${source_place}"
Target scope: "${target_scope}"
`;

    // ---- Call OpenAI ----
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are an API. Reply ONLY with valid JSON. No text outside JSON."
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ match: null, why: "OpenAI error", details: errTxt, tags: [] }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const aiBody = await aiRes.json().catch(() => ({}));
    let text = aiBody?.choices?.[0]?.message?.content?.trim() || "{}";

    // ---- Extract first JSON block if extra words sneak in ----
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    // ---- Parse safely; provide fallback ----
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = {
        match: null,
        why: "Could not parse AI output into JSON.",
        tags: ["parse-error","fallback","ish"],
      };
    }

    // Ensure keys exist
    payload = {
      match: payload.match ?? null,
      why: payload.why ?? (payload.match ? "" : "No exact twin found (ish)"),
      tags: Array.isArray(payload.tags) ? payload.tags : [],
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ match: null, why: "Server error", details: String(err), tags: [] }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
