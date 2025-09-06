export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { source_place, target_scope } = req.body || {};
    if (!source_place || !target_scope) {
      return res.status(400).json({ error: "Missing source_place or target_scope" });
    }

    const prompt = `
Return ONLY a JSON object with these fields:
{
  "match": "best neighborhood/city match",
  "why": "one-sentence explanation (<=200 chars)",
  "tags": ["tag1","tag2","tag3"]
}

Source: "${source_place}"
Target scope: "${target_scope}"
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: "You are an API. Always return ONLY valid JSON. No text outside JSON." },
          { role: "user", content: prompt }
        ],
      }),
    });

    const data = await r.json();
    let text = data?.choices?.[0]?.message?.content?.trim() || "{}";

    // 🔹 Extract JSON from messy output
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { 
        match: "No exact twin found (ish)", 
        why: "Could not parse AI output into JSON.", 
        tags: ["parse-error","fallback","ish"] 
      };
    }

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: "Server error", details: String(err) });
  }
}
