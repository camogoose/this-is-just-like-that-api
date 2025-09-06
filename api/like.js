export const config = {
  runtime: "edge", // keep using Edge runtime
};

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // make sure this is set in Vercel → Settings → Environment Variables
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { source_place, target_scope } = body;

    // Send prompt to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",  // cheaper + fast
      messages: [
        {
          role: "system",
          content: "You are a city/neighborhood comparison assistant. Respond with JSON only.",
        },
        {
          role: "user",
          content: `Find 3 neighborhoods in ${target_scope} that are most similar to ${source_place}.
          Return strictly in this JSON format:
          {
            "results": [
              {
                "match": "Neighborhood name",
                "city": "City name",
                "region": "${target_scope}",
                "why": "1–2 sentence explanation",
                "highlights": ["keyword1","keyword2","keyword3"]
              }
            ]
          }`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const json = JSON.parse(completion.choices[0].message.content);

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err.message || err) }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
}
