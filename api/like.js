// app/api/like/route.js
// Single-input matcher with ordered, weighted facets and sliding-scale scoring.
// Returns the TOP 3 matches, each with a short "why", tags, and vectors (debug).
//
// POST body:
// { "source_place": "East Village, NY", "target_scope": "Copenhagen" }
// Optional: { ..., "hints": ["lgbtq","nightlife"] }
//
// Response:
// {
//   "profile": { place, one_liner, features[], tags[] },
//   "matches": [
//     { "name": "Nørrebro (Copenhagen)", "why": "...", "tags": ["..."] },
//     { "name": "Vesterbro (Copenhagen)", "why": "...", "tags": ["..."] },
//     { "name": "…", "why": "...", "tags": ["..."] }
//   ],
//   "debug": { facets, weights, sourceVector, ranked } // only with ?debug=1
// }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Facets in the exact top-down order you wanted
const FACETS = [
  "artsy_creative",
  "people_progressive_fancy",
  "wealth_level",
  "store_indie_vs_luxury",
  "population_scale",
  // secondary
  "density_energy",
  "nightlife",
  "lgbtq_presence",
  "student_presence",
  "green_space"
];

// Weights (tune anytime)
const WEIGHTS = {
  artsy_creative:          1.00,
  people_progressive_fancy:0.95,
  wealth_level:            0.95,
  store_indie_vs_luxury:   0.90,
  population_scale:        0.85,
  density_energy:          0.60,
  nightlife:               0.55,
  lgbtq_presence:          0.55,
  student_presence:        0.40,
  green_space:             0.35
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const wantDebug = url.searchParams.get("debug") === "1";

    const { source_place, target_scope, hints = [] } = await req.json();
    if (!source_place || !target_scope) {
      return send({ error: "Missing source_place or target_scope" }, 400);
    }

    const prompt = buildPrompt({ source_place, target_scope, hints });
    const ai = await callOpenAI(prompt);

    // Normalize profile
    const profile = {
      place: ai?.profile?.place ?? source_place,
      one_liner: ai?.profile?.one_liner ?? "",
      features: Array.isArray(ai?.profile?.features) ? ai.profile.features : [],
      tags: Array.isArray(ai?.profile?.tags) ? ai.profile.tags : []
    };

    // Vectors
    const sourceVector = ensureVector(ai?.source_vector);
    const candidates = Array.isArray(ai?.candidates) ? ai.candidates : [];

    // Score candidates by weighted cosine similarity
    const ranked = candidates
      .map(c => {
        const v = ensureVector(c?.vector);
        const sim = weightedCosine(sourceVector, v, WEIGHTS);
        return { ...c, similarity: sim };
      })
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

    const top3 = ranked.slice(0, 3).map(c => ({
      name: c?.name ?? null,
      why: c?.why ?? "",
      tags: Array.isArray(c?.tags) ? c.tags : []
    }));

    const out = { profile, matches: top3 };

    return send(
      wantDebug ? { ...out, debug: { facets: FACETS, weights: WEIGHTS, sourceVector, ranked } } : out
    );
  } catch (err) {
    return send({ error: "Server error", details: String(err) }, 500);
  }
}

/* ---------------- prompts & helpers ---------------- */

function buildPrompt({ source_place, target_scope, hints }) {
  const hintText = (Array.isArray(hints) && hints.length)
    ? `User hints: ${hints.join(", ")}. Prioritize these facets when close calls occur.`
    : "No explicit user hints.";

  const nudge = `
Guide: prefer facet fit over fame.
Example guidance (not a rule): If source stresses strong LGBTQ+ + nightlife + arts (e.g., "Chelsea, NY"),
San Francisco often skews "Tenderloin" over "Mission District" because Tenderloin better matches LGBTQ+ core
and late-night energy even if grittier. Use vectors to decide, not this text.
`.trim();

  return `
You are a place-matching API. Reply ONLY with valid JSON (no markdown).

We compare a source place to neighborhoods/cities in a target scope using a shared
facet taxonomy. Produce numeric vectors 0..1 for the source and for multiple candidates.
We (the caller) will compute similarity; you just provide vectors + concise reasons.

Source: "${source_place}"
Target scope: "${target_scope}"
${hintText}

Facet taxonomy (0..1):
- artsy_creative
- people_progressive_fancy
- wealth_level
- store_indie_vs_luxury
- population_scale
- density_energy
- nightlife
- lgbtq_presence
- student_presence
- green_space

${nudge}

Return STRICT JSON:

{
  "profile": {
    "place": "${source_place}",
    "one_liner": "short vibe sentence",
    "features": ["3-7 short nouns/phrases"],
    "tags": ["3-6 lowercase tags"]
  },
  "source_vector": {
    "artsy_creative": 0..1,
    "people_progressive_fancy": 0..1,
    "wealth_level": 0..1,
    "store_indie_vs_luxury": 0..1,
    "population_scale": 0..1,
    "density_energy": 0..1,
    "nightlife": 0..1,
    "lgbtq_presence": 0..1,
    "student_presence": 0..1,
    "green_space": 0..1
  },
  "candidates": [
    {
      "name": "Neighborhood (City)",
      "why": "1–2 crisp sentences referencing facet overlap",
      "vector": {
        "artsy_creative": 0..1,
        "people_progressive_fancy": 0..1,
        "wealth_level": 0..1,
        "store_indie_vs_luxury": 0..1,
        "population_scale": 0..1,
        "density_energy": 0..1,
        "nightlife": 0..1,
        "lgbtq_presence": 0..1,
        "student_presence": 0..1,
        "green_space": 0..1
      },
      "tags": ["3-6 tags"]
    }
  ]
}
`.trim();
}

function ensureVector(v) {
  const out = {};
  for (const k of FACETS) {
    let x = typeof v?.[k] === "number" ? v[k] : 0.5;
    if (!Number.isFinite(x)) x = 0.5;
    if (x < 0) x = 0;
    if (x > 1) x = 1;
    out[k] = x;
  }
  return out;
}

function weightedCosine(a, b, w) {
  let dot = 0, na = 0, nb = 0;
  for (const k of FACETS) {
    const ww = w[k] ?? 1;
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    dot += ww * av * bv;
    na  += ww * av * av;
    nb  += ww * bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom === 0) return 0;
  const cos = dot / denom;
  return Math.max(0, Math.min(1, cos));
}

async function callOpenAI(prompt) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are an API. Reply ONLY with strict JSON. No extra text." },
        { role: "user", content: prompt }
      ]
    })
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    return { error: "OpenAI error", details: txt };
  }
  const body = await r.json().catch(() => ({}));
  let text = body?.choices?.[0]?.message?.content?.trim() || "{}";
  const m = text.match(/\{[\s\S]*\}/);
  if (m) text = m[0];
  try { return JSON.parse(text); } catch { return {}; }
}

function send(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}
