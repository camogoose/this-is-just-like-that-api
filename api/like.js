export const runtime = "nodejs"; // required so we can use the OpenAI SDK (Node runtime)
// import OpenAI from "openai"; // uncomment after you confirm CORS works

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

// Optional GET so you can hit the URL in a browser
export async function GET() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { source_place = "", target_scope = "" } = body;

    // TEMP: return mock so we can confirm CORS before wiring OpenAI
    const results = [
      { match: "Nørrebro", city: "Copenhagen", region: "Denmark",
        why: "Bohemian, multicultural vibe with indie shops and nightlife.",
        highlights: ["bohemian","nightlife","indie shops"] },
      { match: "Vesterbro", city: "Copenhagen", region: "Denmark",
        why: "Trendy and youthful with bars, cafés, and creative spaces.",
        highlights: ["trendy","youthful","cafés"] },
      { match: "Christianshavn", city: "Copenhagen", region: "Denmark",
        why: "Canals + mix of historic and artsy energy; relaxed but lively.",
        highlights: ["canals","historic","artsy"] },
    ];

    return new Response(JSON.stringify({ results, echo: { source_place, target_scope } }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}
