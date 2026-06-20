import { supabase } from "./supabase";

const INVESTIGATION_LIMIT = 25;
const TABLE = "investigations";

function jsonClean(value) {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, val) => {
        if (val === undefined) return null;
        if (typeof val === "function") return null;
        if (typeof val === "symbol") return null;
        if (typeof val === "bigint") return Number(val);
        if (!isFinite(val) && typeof val === "number") return 0;
        return val;
      })
    );
  } catch {
    return {};
  }
}

function rowToInvestigation(row) {
  if (!row) return null;
  return {
    ...(row.data || {}),
    id: row.case_id,
    target: row.target,
    type: row.type,
    status: row.status,
    risk: row.risk,
    platforms: row.platforms || [],
    ownerId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================
// SAVE
// =============================

export async function saveInvestigation(user, investigation) {
  if (!user?.uid) throw new Error("Sign in before saving.");
  if (!investigation?.id) throw new Error("Investigation has no ID.");

  const clean = jsonClean(investigation);

  const row = {
    case_id: clean.id,
    user_id: user.uid,
    target: String(clean.target ?? "").slice(0, 2048),
    type: String(clean.type ?? "keyword"),
    status: String(clean.status ?? "Completed"),
    risk: String(clean.risk ?? "unknown"),
    platforms: Array.isArray(clean.platforms) ? clean.platforms : [],
    data: clean, // full investigation object as JSONB — no nested-array issues here
    updated_at: new Date().toISOString(),
  };

  console.log("[CyIntel] Saving investigation to Supabase...", row.case_id);

  const { error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: "user_id,case_id" });

  if (error) {
    console.error("[CyIntel] Supabase save FAILED:", error);
    throw new Error(error.message || "Supabase save failed.");
  }

  console.log("[CyIntel] Supabase save SUCCESS");
  return investigation.id;
}

// =============================
// READ ONE
// =============================

export async function getInvestigation(user, caseId) {
  if (!user?.uid) throw new Error("Sign in before reading.");

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", user.uid)
    .eq("case_id", caseId)
    .maybeSingle();

  if (error) {
    console.error("[CyIntel] Supabase read FAILED:", error);
    throw new Error(error.message || "Supabase read failed.");
  }
  return rowToInvestigation(data);
}

// =============================
// ONE-SHOT FETCH (used right after a save, so the UI updates instantly
// instead of waiting on the Realtime websocket — which can lag/miss events
// when using Firebase-as-third-party-auth JWTs).
// =============================

export async function fetchRecentInvestigations(user) {
  if (!user?.uid) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", user.uid)
    .order("created_at", { ascending: false })
    .limit(INVESTIGATION_LIMIT);

  if (error) {
    console.error("[CyIntel] Supabase fetch FAILED:", error);
    throw new Error(error.message || "Supabase fetch failed.");
  }

  return (data || []).map((row) => {
    const full = rowToInvestigation(row);
    return {
      ...full,
      id: row.case_id,
      createdAtMs: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      fullInvestigation: full,
    };
  });
}

// =============================
// LIVE SUBSCRIPTION (Supabase Realtime replaces Firestore onSnapshot)
// =============================

export function subscribeRecentInvestigations(user, onNext, onError) {
  if (!user?.uid) { onNext([]); return () => {}; }

  let cancelled = false;

  async function fetchAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", user.uid)
      .order("created_at", { ascending: false })
      .limit(INVESTIGATION_LIMIT);

    if (cancelled) return;
    if (error) {
      console.error("[CyIntel] Supabase subscribe FAILED:", error);
      onError?.(error);
      return;
    }
    onNext((data || []).map((row) => {
      const full = rowToInvestigation(row);
      return {
        ...full,
        id: row.case_id,
        createdAtMs: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        fullInvestigation: full,
      };
    }));
  }

  fetchAll();

  // Live updates: re-fetch whenever a row for this user changes.
  const channel = supabase
    .channel(`investigations-${user.uid}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${user.uid}` },
      () => fetchAll()
    )
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(channel);
  };
}

// =============================
// UPDATE
// =============================

export async function updateInvestigation(user, caseId, fields = {}) {
  if (!user?.uid) throw new Error("Sign in before updating.");

  const patch = { updated_at: new Date().toISOString() };
  if (fields.status) patch.status = fields.status;
  if (fields.risk) patch.risk = fields.risk;
  if (fields.data) patch.data = jsonClean(fields.data);

  const { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("user_id", user.uid)
    .eq("case_id", caseId);

  if (error) throw new Error(error.message || "Supabase update failed.");
  return caseId;
}

// =============================
// DELETE
// =============================

export async function deleteInvestigation(user, caseId) {
  if (!user?.uid) throw new Error("Sign in before deleting.");

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", user.uid)
    .eq("case_id", caseId);

  if (error) throw new Error(error.message || "Supabase delete failed.");
  return caseId;
}

// =============================
// SOCMINT GRAPH ENGINE (unchanged — pure functions, no DB calls)
// =============================

export function buildEntityGraph(investigation) {
  const nodes = new Map();
  const edges = [];

  const addNode = (id, type, data) => {
    if (!nodes.has(id)) nodes.set(id, { id, type, ...data });
  };
  const connect = (a, b, type) => edges.push({ from: a, to: b, type });

  for (const f of investigation.findings || []) {
    if (f?.value) {
      addNode(f.value, "entity", f);
      addNode(investigation.id, "case", {});
      connect(investigation.id, f.value, "found");
    }
  }
  for (const p of investigation.crawledPages || []) {
    if (p?.url) {
      addNode(p.url, "source", p);
      connect(investigation.id, p.url, "crawled");
    }
  }
  return { nodes: [...nodes.values()], edges };
}

export function buildTimeline(investigation) {
  const events = [];
  for (const log of investigation.logs || []) {
    events.push({ time: log.time || Date.now(), type: log.type || "log", message: log.message || "event" });
  }
  for (const p of investigation.crawledPages || []) {
    events.push({ time: p.time || Date.now(), type: "crawl", message: p.url || "page" });
  }
  return events.sort((a, b) => new Date(a.time) - new Date(b.time));
}

export function correlateEntities(investigation) {
  const freq = {};
  for (const f of investigation.findings || []) {
    const k = f?.value;
    if (!k) continue;
    freq[k] = (freq[k] || 0) + 1;
  }
  const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([entity, score]) => ({ entity, score }));
  return { clusters: ranked.slice(0, 20), confidence: ranked.length > 0 ? Math.min(100, ranked[0][1] * 10) : 0 };
}

export async function runSafeCrawler(seedUrls = []) {
  return seedUrls.map((url) => ({ url, status: "queued", note: "public-source crawl simulation only" }));
}

export async function generatePdfReport(investigation) {
  const graph = buildEntityGraph(investigation);
  const timeline = buildTimeline(investigation);
  const correlation = correlateEntities(investigation);
  return {
    title: `Investigation Report - ${investigation.id}`,
    summary: investigation.gemini?.summary || "No AI summary",
    graph,
    timeline,
    correlation,
    generatedAt: new Date().toISOString(),
  };
}
