<!-- This Is Just Like That(ish) — 3 results, no debug -->
<div id="tilt-ish" style="max-width:920px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:12px;">
    <div style="font-weight:700;">This Is Just Like That</div>
    <span style="font-size:.75rem;opacity:.7;transform:rotate(-6deg);display:inline-block;border:1px solid #ddd;border-radius:8px;padding:0 6px;">ish</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr;gap:12px;margin:16px 0;">
    <label style="font-size:.8rem;color:#555;">
      This place
      <input id="sourcePlace" type="text" placeholder="East Village, NYC" autocomplete="off"
        style="width:100%;margin-top:6px;padding:10px 12px;border:1px solid #ddd;border-radius:10px;font-size:14px;">
    </label>

    <label style="font-size:.8rem;color:#555;">
      Just like that (in)
      <input id="targetScope" type="text" placeholder="Denmark / San Francisco / London…" autocomplete="off"
        style="width:100%;margin-top:6px;padding:10px 12px;border:1px solid #ddd;border-radius:10px;font-size:14px;">
    </label>

    <div style="display:flex;align-items:center;gap:10px;">
      <button id="goBtn" type="button"
        style="padding:10px 14px;border:1px solid #111;background:#111;color:#fff;border-radius:10px;font-weight:600;cursor:pointer;">
        Find matches
      </button>
    </div>
  </div>

  <!-- Results grid -->
  <div id="grid" style="display:none;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:8px;"></div>

  <!-- Error / system message -->
  <div id="msg" style="display:none;margin-top:10px;color:#b00020;background:#fff3f4;border:1px solid #ffd6da;padding:10px;border-radius:10px;font-size:.9rem;"></div>

  <div style="margin-top:14px;color:#888;font-size:.8rem;">Nothing is exactly the same—everything’s a little… ish.</div>
</div>

<script>
(function(){
  // 🔒 Your endpoint URL (replace if needed)
  const ENDPOINT_URL = "https://this-is-just-like-that-api-86v6.vercel.app/api/like";

  const btn  = document.getElementById("goBtn");
  const grid = document.getElementById("grid");
  const msg  = document.getElementById("msg");

  function chip(text){
    const s = document.createElement("span");
    s.textContent = text;
    s.style.cssText = "border:1px solid #ddd;border-radius:999px;padding:2px 8px;font-size:12px;color:#444;background:#fff;";
    return s;
  }

  function card(item, src, scope){
    const wrap = document.createElement("div");
    wrap.style.cssText = "border:1px solid #eee;border-radius:14px;padding:14px 16px;background:#fafafa;display:flex;flex-direction:column;gap:8px;";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.textContent = `“${src}” — is just like that (in ${scope}): ${item.match}${item.city ? ", " + item.city : ""}${item.region ? " — " + item.region : ""}`;
    wrap.appendChild(title);

    const why = document.createElement("div");
    why.style.color = "#555";
    why.textContent = item.why || "";
    wrap.appendChild(why);

    const tags = document.createElement("div");
    tags.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    (item.highlights||[]).forEach(t => tags.appendChild(chip(t)));
    wrap.appendChild(tags);

    if (item.notes){
      const small = document.createElement("div");
      small.style.cssText = "color:#777;font-size:.85rem;";
      small.textContent = item.notes;
      wrap.appendChild(small);
    }
    return wrap;
  }

  async function fetchTriplet(src, scope){
    const res = await fetch(ENDPOINT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_place: src, target_scope: scope })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  }

  function renderResults(payload, src, scope){
    msg.style.display = "none"; msg.textContent = "";
    grid.innerHTML = "";
    const list = Array.isArray(payload?.results) ? payload.results : [];
    if (!list.length){
      msg.textContent = "No matches returned (ish). Try a broader scope or adjust the place.";
      msg.style.display = "block";
      grid.style.display = "none";
      return;
    }
    list.forEach(it => grid.appendChild(card(it, src, scope)));
    grid.style.display = "grid";
  }

  function showError(text){
    grid.style.display = "none";
    grid.innerHTML = "";
    msg.textContent = String(text);
    msg.style.display = "block";
  }

  btn?.addEventListener("click", async function(){
    const src   = (document.getElementById("sourcePlace").value || "").trim();
    const scope = (document.getElementById("targetScope").value || "").trim();

    if (!ENDPOINT_URL) return showError("Missing endpoint URL.");
    if (!src || !scope) return showError("Please fill both inputs.");

    const old = btn.textContent; btn.disabled = true; btn.textContent = "Thinking…";
    try {
      const payload = await fetchTriplet(src, scope);
      renderResults(payload, src, scope);
    } catch (e) {
      showError(e?.message || e);
      console.error(e);
    } finally {
      btn.disabled = false; btn.textContent = old;
    }
  });
})();
</script>
