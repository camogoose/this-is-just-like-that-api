export const config = { runtime: "edge" }; // Vercel Edge runtime

import OpenAI from "openai";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  // Simple health check so you can open /api/like in a browser
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const source_place = (body.source_place || "").trim();
    const target_scope = (body.target_scope || "").trim();

    if (!source_place || !target_scope) {
      return new Response(
        JSON.stringify({ error: "Missing source_place or target_scope" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // IMPORTANT: set this in Vercel → Settings → Environment Variables
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a city/neighborhood comparison assistant. Respond with JSON only.",
        },
        {
          role: "user",
          content: `Find the 3 best neighborhoods in ${target_scope} that are most similar to ${source_place}.
Return strictly in this exact JSON shape:
{
  "results": [
    {
      "match": "Neighborhood",
      "city": "City",
      "region": "${target_scope}",
      "why": "1–2 sentences about similarities",
      "highlights": ["keyword1","keyword2","keyword3"]
    }
  ]
}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const json = JSON.parse(completion.choices[0].message.content);

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err.message || err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
}
