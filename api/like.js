// app/api/like/route.js
export const runtime = "nodejs"; // or "edge" if you prefer, but keep CORS headers

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  // Preflight
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const { source_place, target_scope } = await request.json();

    // --- your OpenAI logic here ---
    // For brevity, I'm returning a small stub; keep your real logic.
    const results = [
      {
        match: "Nørrebro",
        city: "Copenhagen",
        region: "Denmark",
        why: "Bohemian, multicultural vibe with indie shops and nightlife.",
        highlights: ["bohemian", "nightlife", "indie shops"],
      },
      // ... plus the other two you generate
    ];

    return Response.json({ results }, { headers: CORS_HEADERS });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err?.message || "Server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}
