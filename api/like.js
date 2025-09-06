// app/api/like/route.js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  try {
    const { source_place, target_scope } = await req.json();

    // Ask ChatGPT to find a twin neighborhood/city
    const prompt = `
    Find a place in ${target_scope} that is most like ${source_place}.
    Return ONLY a JSON object with this format:
    {
      "match": "Name of matching neighborhood or city",
      "why": "One sentence why they are similar",
      "tags": ["short", "keywords", "about", "the", "similarity"]
    }
    If you cannot find a close match, still return the JSON with "match": null and explain why.
    `;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    let text = completion.choices[0].message.content;

    // Try parsing JSON safely
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      // Fallback if model returned free text
      data = {
        match: null,
        why: "AI gave free text instead of JSON.",
        raw: text,
        tags: [],
      };
    }

    // Always return JSON
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[like] ERROR:", error);

    return new Response(
      JSON.stringify({
        match: null,
        why: "Server error",
        tags: [],
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
