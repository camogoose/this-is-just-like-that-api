// app/api/like/route.js
export const runtime = "nodejs";

function sendJSON(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

export async function OPTIONS() { return sendJSON({}); }

export async function POST(request) {
  try {
    const { source_place, target_scope } = await request.json();
    if (!source_place || !target_scope) {
      return sendJSON({ error: "Missing source_place or target_scope" }, 400);
    }

    const prompt = `
Return ONLY valid JSON with this schema:

{
  "results": [
    {
      "match": "Neighborhood or area name",
      "city": "City name (if applicable)",
      "region": "State/region or country",
      "why": "≤ 220 chars on why this fits. Be honest it's approximate.",
      "highlights": ["3 to 5 short vibe tags, lowercase"],
      "notes": "optional extra context, ≤ 180 chars"
    },
    {...}, {...}
  ]
}

Rules:
- Produce exactly 3 distinct options within the user's target scope.
- If target_scope is a COUNTRY, you may choose different cities in that country.
- If target_scope is a CITY, choose neighborhoods inside that city.
- Keep it factual but concise; no marketing fluff.
- Do NOT include any prose before/after the JSON.

Source place: "${source_place}"
Target scope: "${target_scope}"
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: "You map places to similar neighborhoods. Output ONLY JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return sendJSON({ error: "OpenAI request failed", details: errText }, 502);
    }

    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";

    let payload;
    try {
      payload = JSON.parse(raw);
      if (!Array.isArray(payload.results)) throw new Error("bad shape");
    } catch {
      payload = {
        results: [
          {
            match: "No exact twin found (ish)",
            city: "",
            region: target_scope,
            why: "Try a broader scope (e.g., country/major city) or tweak the place name.",
            highlights: ["try broader", "refine", "ish"],
            notes: "Check spelling or use a nearby well-known area."
          }
        ]
      };
    }

    return sendJSON(payload, 200);
  } catch (e) {
    return sendJSON({ error: "Server error", details: String(e) }, 500);
  }
}
