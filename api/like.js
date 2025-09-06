// pages/api/like.js
export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { source_place, target_scope } = req.body || {};
    if (!source_place || !target_scope) {
      return res.status(400).json({ error: "Missing source_place or target_scope" });
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
      return res.status(502).json({ error: "OpenAI request failed", details: errText });
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

    return res.status(200).json(payload);
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
