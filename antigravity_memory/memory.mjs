#!/usr/bin/env node
/**
 * Buffy's persistent memory CLI.
 *
 * Antigravity-inspired cognitive memory: identity file, small short-term
 * context, per-session RECAP logs, long-term knowledge items with confidence
 * and decay, and an associative knowledge graph. Zero dependencies.
 *
 * Commands:
 *   start        — bootstrap session (load identity + short-term + last recap)
 *   note <text>  — append timestamped entry to today's session log
 *   remember <text> [--tags a,b] [--confidence 0-1]  — long-term knowledge item
 *   recall <query> [--n 5]      — ranked retrieval + associative expansion
 *   link <idA> <idB> [--relation r]  — add associative edge
 *   contradict <text>           — log a contradiction (unresolved)
 *   end "<summary>"             — close session: RECAP, decay, refresh short-term
 *   status                      — memory stats
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const MEM_DIR = path.join(os.homedir(), ".buffy", "memory");
const KNOWLEDGE_DIR = path.join(MEM_DIR, "knowledge");
const SESSIONS_DIR = path.join(MEM_DIR, "sessions");
const IDENTITY_PATH = path.join(MEM_DIR, "IDENTITY.md");
const SHORT_TERM_PATH = path.join(MEM_DIR, "SHORT_TERM.md");
const GRAPH_PATH = path.join(MEM_DIR, "graph.json");
const INDEX_PATH = path.join(MEM_DIR, "index.json");
const CONTRADICTIONS_PATH = path.join(MEM_DIR, "contradictions.json");
const DECAY_PER_DAY = 0.985;      // confidence multiplier per day unreinforced
const ARCHIVE_CONFIDENCE = 0.2;   // below this, item is stale/archived
const EMBED_MODEL = "all-minilm"; // Ollama embedding model (semantic recall)
const EMBEDDINGS_PATH = path.join(MEM_DIR, "embeddings.json");
const OLLAMA_URL = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

const now = () => new Date();
const ts = () => now().toISOString();
const hhmm = () => now().toTimeString().slice(0, 5);
const today = () => now().toISOString().slice(0, 10);
const sessionPath = (d = today()) => path.join(SESSIONS_DIR, `${d}.md`);

function ensureDirs() {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function readJson(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}

function getIndex() {
  return readJson(INDEX_PATH, { nextKnowledgeId: 1, items: {}, lastSession: null, created: ts() });
}

function getGraph() {
  return readJson(GRAPH_PATH, { nodes: {}, edges: [] });
}

function getContradictions() {
  return readJson(CONTRADICTIONS_PATH, []);
}

function getEmbeddings() {
  return readJson(EMBEDDINGS_PATH, {});
}

function saveEmbeddings(emb) {
  writeJson(EMBEDDINGS_PATH, emb);
}

/**
 * Embed text via local Ollama. Returns a vector, or null when the server is
 * down / model missing (caller falls back to token-overlap scoring).
 */
async function embedText(text) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.embeddings?.[0] ?? null;
  } catch {
    return null;
  }
}

function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "item";
}

function itemAgeDays(item) {
  return (Date.now() - new Date(item.created).getTime()) / 86400000;
}

function effectiveConfidence(item) {
  const days = itemAgeDays(item);
  return item.confidence * Math.pow(DECAY_PER_DAY, days);
}

function loadKnowledgeItems() {
  const index = getIndex();
  const items = [];
  for (const meta of Object.values(index.items)) {
    const file = path.join(KNOWLEDGE_DIR, `${meta.id}.md`);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf-8");
    items.push({ ...meta, text });
  }
  return items;
}

/** Tokenize to lowercase word multiset. */
function tokenize(s) {
  return (s.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []).filter((t) => t.length > 1);
}

function tokenOverlap(queryTokens, text) {
  const textTokens = new Set(tokenize(text));
  if (textTokens.size === 0) return 0;
  let hits = 0;
  for (const t of new Set(queryTokens)) if (textTokens.has(t)) hits++;
  return hits / Math.max(1, new Set(queryTokens).size);
}

/* ============================== commands ============================== */

function cmdStart() {
  ensureDirs();
  console.log("━━━ 🧠 BUFFY MEMORY — SESSION START ━━━\n");

  // 1. Identity (always loaded — like Antigravity's GEMINI.md)
  if (fs.existsSync(IDENTITY_PATH)) {
    console.log("── IDENTITY ──");
    console.log(fs.readFileSync(IDENTITY_PATH, "utf-8").trim());
    console.log();
  }

  // 2. Short-term context digest
  if (fs.existsSync(SHORT_TERM_PATH)) {
    console.log("── SHORT-TERM CONTEXT ──");
    console.log(fs.readFileSync(SHORT_TERM_PATH, "utf-8").trim());
    console.log();
  }

  // 3. Last session recap (if not today)
  const index = getIndex();
  const last = index.lastSession;
  if (last && last !== today() && fs.existsSync(sessionPath(last))) {
    console.log(`── LAST SESSION (${last}) RECAP ──`);
    const content = fs.readFileSync(sessionPath(last), "utf-8");
    const recap = content.split("## RECAP")[1]?.split("##")[0]?.trim();
    console.log(recap || "(no recap)");
    console.log();
  }

  // 4. Open today's session file
  const sp = sessionPath();
  if (!fs.existsSync(sp)) {
    fs.writeFileSync(
      sp,
      `# Session ${today()}\n\n## RECAP\n- ${hhmm()} : session started\n\n## Notes\n`
    );
    index.lastSession = today();
    writeJson(INDEX_PATH, index);
    console.log(`📓 Opened session log: ${sp}`);
  } else {
    console.log(`📓 Session log already open: ${sp}`);
  }
  console.log("\nTip: `note <text>` to log, `remember <fact>` for long-term, `recall <query>` to search.");
}

function cmdNote(text) {
  ensureDirs();
  if (!text) return console.error("usage: note <text>");
  const sp = sessionPath();
  if (!fs.existsSync(sp)) {
    fs.writeFileSync(sp, `# Session ${today()}\n\n## RECAP\n- ${hhmm()} : session started\n\n## Notes\n`);
  }
  const entry = `- ${hhmm()} : ${text}\n`;
  fs.appendFileSync(sp, entry);
  console.log(`📝 noted (${sp})`);
}

async function cmdRemember(text, opts) {
  ensureDirs();
  if (!text) return console.error("usage: remember <fact> [--tags a,b] [--confidence 0-1]");
  const index = getIndex();
  const id = `K-${String(index.nextKnowledgeId).padStart(3, "0")}`;
  const confidence = Math.max(0, Math.min(1, opts.confidence ?? 0.85));
  const tags = (opts.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const meta = {
    id,
    slug: slugify(text),
    tags,
    confidence,
    created: ts(),
    reinforced: ts(),
  };
  index.items[id] = meta;
  index.nextKnowledgeId += 1;
  writeJson(INDEX_PATH, index);

  const file = path.join(KNOWLEDGE_DIR, `${id}.md`);
  fs.writeFileSync(
    file,
    `# ${id} — ${meta.slug}\n\ntags: ${tags.join(", ") || "none"}\nconfidence: ${confidence}\ncreated: ${meta.created}\n\n${text}\n`
  );

  // Auto-node in graph
  const graph = getGraph();
  graph.nodes[id] = { label: text.slice(0, 60) };
  writeJson(GRAPH_PATH, graph);

  // Cache embedding for semantic recall (best-effort)
  const emb = await embedText(`${text} ${tags.join(" ")}`);
  if (emb) {
    const all = getEmbeddings();
    all[id] = emb;
    saveEmbeddings(all);
    console.log(`🧬 embedding cached (${emb.length} dims)`);
  } else {
    console.log(`⚠️  no embedding cached (Ollama unreachable — recall will use token overlap)`);
  }

  console.log(`🧠 remembered ${id} (conf=${confidence}) → ${file}`);
  console.log(`   "${text}"`);
}

async function cmdRecall(query, opts) {
  if (!query) return console.error("usage: recall <query> [--n 5]");
  const n = opts.n ? parseInt(opts.n, 10) : 5;
  const items = loadKnowledgeItems();
  const qTokens = tokenize(query);
  if (items.length === 0) return console.log("(no long-term memories yet — use `remember`)");

  // Semantic scoring (Ollama embeddings) with token-overlap fallback
  const embeddings = getEmbeddings();
  const queryEmb = await embedText(query);
  const semantic = queryEmb !== null && Object.keys(embeddings).length > 0;
  const overlapOf = (item) => tokenOverlap(qTokens, item.text + " " + item.slug + " " + item.tags.join(" "));

  const scored = items
    .map((item) => {
      const overlap = overlapOf(item);
      const conf = effectiveConfidence(item);
      const recencyBoost = 1 / (1 + itemAgeDays(item) / 30);
      // Blend: cosine similarity (if available) + lexical overlap, then
      // confidence × recency. Semantic dominates when present.
      const cos = embeddings[item.id] ? cosineSim(queryEmb, embeddings[item.id]) : 0;
      const score = (semantic ? cos * 2.0 + overlap * 0.4 : overlap) * conf * recencyBoost;
      return { item, score, cos: semantic ? cos : null };
    })
    .filter((s) => s.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, n);

  // Also include recent session notes (short-term) as candidates
  const recentSessions = fs
    .readdirSync(SESSIONS_DIR)
    .sort()
    .slice(-3)
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(SESSIONS_DIR, f), "utf-8") }))
    .filter((s) => tokenOverlap(qTokens, s.text) > 0)
    .map((s) => ({ item: { id: s.file.replace(".md", ""), slug: `session ${s.file}`, confidence: 1, created: ts(), reinforced: ts() }, score: tokenOverlap(qTokens, s.text) * 0.6, text: s.text, cos: null }));

  const all = [...scored, ...recentSessions].sort((a, b) => b.score - a.score).slice(0, n);

  if (all.length === 0) {
    console.log(`(nothing recalled for "${query}")`);
    return;
  }

  console.log(`🔍 RECALL: "${query}"${semantic ? " (semantic + lexical)" : " (lexical only)"}\n`);
  for (const { item, score, text, cos } of all) {
    const conf = item.confidence ? effectiveConfidence(item) : null;
    const cosStr = cos !== null && cos !== undefined ? `, sim ${cos.toFixed(2)}` : "";
    console.log(`• ${item.id} (score ${score.toFixed(2)}${cosStr}${conf !== null ? `, conf ${conf.toFixed(2)}` : ""})`);
    const body = (text || item.text || "")
      .replace(/#{1,3} .*\n/g, "")
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("- ") && !/^(tags|confidence|created):/.test(l.trim()))
      .slice(0, 2)
      .join(" ")
      .trim();
    console.log(`  ${body.slice(0, 220)}`);
  }

  // Associative expansion: neighbors of top long-term matches
  const graph = getGraph();
  const topIds = scored.slice(0, 3).map((s) => s.item.id);
  const neighbors = graph.edges
    .filter((e) => topIds.includes(e.from) || topIds.includes(e.to))
    .map((e) => {
      const other = e.from === topIds.find((t) => t === e.from) ? e.to : e.from;
      const isNeighbor = topIds.includes(e.to) || topIds.includes(e.from);
      return { other, relation: e.relation, weight: e.weight, isNeighbor };
    })
    .filter((x) => x.other && !topIds.includes(x.other));
  if (neighbors.length > 0) {
    console.log("\n── ASSOCIATIONS ──");
    for (const nb of neighbors) {
      const node = graph.nodes[nb.other];
      if (node) console.log(`   ${nb.other} [${nb.relation}] → ${node.label}`);
    }
  }
}

function cmdLink(idA, idB, opts) {
  const graph = getGraph();
  if (!graph.nodes[idA] && !graph.nodes[idB]) {
    console.error("both ids unknown — use `remember` first, ids are K-###");
    process.exit(1);
  }
  const relation = opts.relation || "related_to";
  const existing = graph.edges.find(
    (e) => (e.from === idA && e.to === idB) || (e.from === idB && e.to === idA)
  );
  if (existing) {
    existing.weight = Math.min(2, (existing.weight || 1) + 0.25);
    existing.reinforced = ts();
    console.log(`🔗 strengthened ${idA} --(${relation})--> ${idB} (weight ${existing.weight.toFixed(2)})`);
  } else {
    graph.edges.push({ from: idA, to: idB, relation, weight: 1, created: ts() });
    console.log(`🔗 linked ${idA} --(${relation})--> ${idB}`);
  }
  writeJson(GRAPH_PATH, graph);
}

async function cmdReembed() {
  const items = loadKnowledgeItems();
  const all = getEmbeddings();
  let done = 0, failed = 0;
  for (const item of items) {
    if (all[item.id]) continue;
    const emb = await embedText(`${item.text} ${item.tags.join(" ")}`);
    if (emb) {
      all[item.id] = emb;
      done++;
    } else {
      failed++;
    }
  }
  saveEmbeddings(all);
  console.log(`🧬 re-embedded: ${done} new, ${failed} failed (total cached: ${Object.keys(all).length})`);
}

function cmdContradict(text) {
  const list = getContradictions();
  list.push({ text, status: "unresolved", created: ts() });
  writeJson(CONTRADICTIONS_PATH, list);
  console.log(`⚡ contradiction logged (${list.length} total, unresolved)`);
}

function cmdEnd(summary, opts) {
  ensureDirs();
  const sp = sessionPath();
  if (!fs.existsSync(sp)) {
    console.error("no session open — run `start` first");
    process.exit(1);
  }

  // 1. Write RECAP into today's session
  const recap = `## RECAP\n- ${hhmm()} : ${summary || "session closed"}\n`;
  fs.appendFileSync(sp, `\n${recap}\n--- end of session ${today()} ---\n`);
  console.log(`✅ Session closed (${sp})`);

  // 2. Decay long-term confidence (unreinforced memories fade)
  const index = getIndex();
  let decayed = 0;
  for (const meta of Object.values(index.items)) {
    const effective = effectiveConfidence(meta);
    if (effective < ARCHIVE_CONFIDENCE) {
      meta.archived = true;
      decayed++;
    }
  }
  if (decayed > 0) console.log(`⏳ ${decayed} stale item(s) archived (conf < ${ARCHIVE_CONFIDENCE})`);
  index.lastSession = today();
  writeJson(INDEX_PATH, index);

  // 3. Refresh short-term digest (small — current state, not history)
  const items = loadKnowledgeItems().filter((i) => !i.archived);
  const top = items
    .map((i) => ({ i, s: effectiveConfidence(i) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 12);
  const oneLiner = (text) =>
    text
      .replace(/#{1,3} .*\n/g, "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith("- ") && !/^(tags|confidence|created):/.test(l)) || "";
  const digest = [
    `# Short-term context (updated ${ts()})`,
    ``,
    `Active session: ${today()}`,
    `Last summary: ${summary || ""}`,
    ``,
    `## Top long-term anchors`,
    ...top.map(({ i, s }) => `- ${i.id} [${s.toFixed(2)}] ${oneLiner(i.text).slice(0, 150)}`),
    ``,
    `> This file stays small (<3 KB). History lives in sessions/.`,
    ``,
  ].join("\n");
  fs.writeFileSync(SHORT_TERM_PATH, digest);
  console.log("🔄 SHORT_TERM.md refreshed");
  console.log("\nMemories persist. Next session: `node ~/.buffy/memory/memory.mjs start`");
}

function cmdStatus() {
  const index = getIndex();
  const graph = getGraph();
  const items = Object.values(index.items);
  const sessions = fs.existsSync(SESSIONS_DIR) ? fs.readdirSync(SESSIONS_DIR) : [];
  const contradictions = getContradictions();
  console.log("🧠 BUFFY MEMORY STATUS");
  console.log(`   Store:        ${MEM_DIR}`);
  console.log(`   Knowledge:    ${items.length} items (${items.filter((i) => i.archived).length} archived)`);
  console.log(`   Graph:        ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);
  console.log(`   Sessions:     ${sessions.length} (last: ${index.lastSession})`);
  console.log(`   Contradictions: ${contradictions.length} unresolved`);
  const avgConf = items.length ? items.reduce((a, i) => a + effectiveConfidence(i), 0) / items.length : 0;
  console.log(`   Avg confidence: ${avgConf.toFixed(2)}`);
}

/* =============================== main ================================ */

const [cmd, ...rest] = process.argv.slice(2);
const opts = {};
const positional = [];
for (const arg of rest) {
  const m = arg.match(/^--([a-z-]+)=(.*)$/i) || arg.match(/^--([a-z-]+)(?:$)/i);
  if (m) {
    const key = m[1];
    const value = m[2] !== undefined ? m[2] : rest[rest.indexOf(arg) + 1]?.startsWith("--") ? undefined : rest[rest.indexOf(arg) + 1];
    if (value !== undefined && !String(value).startsWith("--")) {
      opts[key] = value;
      rest[rest.indexOf(arg) + 1] = "__consumed__";
    } else {
      opts[key] = true;
    }
  } else if (arg !== "__consumed__") {
    positional.push(arg);
  }
}

const main = async () => {
  switch (cmd) {
    case "start": cmdStart(); break;
    case "note": cmdNote(positional.join(" ")); break;
    case "remember": await cmdRemember(positional.join(" "), opts); break;
    case "reembed": await cmdReembed(); break;
    case "recall": await cmdRecall(positional.join(" "), opts); break;
    case "link": cmdLink(positional[0], positional[1], opts); break;
    case "contradict": cmdContradict(positional.join(" ")); break;
    case "end": cmdEnd(positional.join(" "), opts); break;
    case "status": cmdStatus(); break;
    default:
      console.error(`unknown command: ${cmd || "(none)"}`);
      console.error("usage: memory.mjs <start|note|remember|recall|link|reembed|contradict|end|status>");
      process.exit(1);
  }
};

main();