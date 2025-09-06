// app/api/like/route.js
export const runtime = "nodejs"; // or "edge" if you prefer (then use fetch-only APIs)

function json(res, status = 200) {
  return new Response(JSON.stringify(res), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
    },
  });
}

export async function OPTIONS() {
  return json({}, 200);
}

export async function POST(request) {
  try {
    const { source_place, target_scope } = await request.json();

    if (!source_place || !target_scope) {
      return json({ error: "Missing source_place or target_scope" }, 400);
    }

    const prompt = `
Return ONLY valid JSON with fields:
- match: string (best neighborhood/city analog)
- why: string (<= 200 chars, honest that it's approximate)
- tags: array of 3 short strings

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
