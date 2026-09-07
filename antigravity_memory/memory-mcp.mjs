#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) stdio server exposing Buffy's persistent
 * memory as tools. Zero dependencies — speaks raw JSON-RPC 2.0 over stdio,
 * delegating to memory.mjs so there's a single source of truth.
 *
 * Tools:
 *   memory_start       — bootstrap session (identity + short-term + last recap)
 *   memory_note        — append timestamped short-term log entry
 *   memory_remember    — store a long-term knowledge item (+ embedding)
 *   memory_recall      — semantic + lexical retrieval with associations
 *   memory_link        — add associative edge between items
 *   memory_contradict  — log an unresolved contradiction
 *   memory_end         — close session (RECAP, decay, refresh short-term)
 *   memory_status      — memory stats
 *
 * Register (e.g. Claude Code): add to .mcp.json / client config as
 *   { "command": "node", "args": ["~/.buffy/memory/memory-mcp.mjs"] }
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const CLI = path.join(os.homedir(), ".buffy", "memory", "memory.mjs");

const TOOLS = [
  {
    name: "memory_start",
    description: "Bootstrap a memory session: loads identity, short-term context, and last session recap. Call at the start of a conversation.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "memory_note",
    description: "Append a timestamped entry to today's short-term session log.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "What to log" } },
      required: ["text"],
    },
  },
  {
    name: "memory_remember",
    description: "Store a long-term knowledge item with confidence. Unreinforced items decay over time. Optionally cache an Ollama embedding for semantic recall.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The fact / lesson to remember" },
        tags: { type: "string", description: "Comma-separated tags" },
        confidence: { type: "number", description: "0-1, default 0.85" },
      },
      required: ["text"],
    },
  },
  {
    name: "memory_recall",
    description: "Retrieve memories relevant to a query: semantic (Ollama embeddings) + lexical scoring, confidence-weighted, plus associative graph neighbors.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to recall" },
        n: { type: "number", description: "Max results, default 5" },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_link",
    description: "Add (or strengthen) an associative edge between two knowledge items, e.g. K-001 and K-002 with relation 'fixes'.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Item id (K-###)" },
        to: { type: "string", description: "Item id (K-###)" },
        relation: { type: "string", description: "e.g. fixes, extends, owner-of, related_to" },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "memory_contradict",
    description: "Log a contradiction / conflicting observation. Both sides stay on record as unresolved until resolved.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "The contradiction" } },
      required: ["text"],
    },
  },
  {
    name: "memory_end",
    description: "Close the session: writes RECAP into today's log, decays stale memories, refreshes SHORT_TERM.md. Call at end of conversation.",
    inputSchema: {
      type: "object",
      properties: { summary: { type: "string", description: "One-line summary of the session" } },
      required: ["summary"],
    },
  },
  {
    name: "memory_status",
    description: "Memory store stats: item count, graph size, sessions, avg confidence.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
];

const ARG_ORDER = {
  memory_note: ["text"],
  memory_remember: ["text", "tags", "confidence"],
  memory_recall: ["query", "n"],
  memory_link: ["from", "to", "relation"],
  memory_contradict: ["text"],
  memory_end: ["summary"],
};

function runCli(args) {
  const res = spawnSync("node", [CLI, ...args], { encoding: "utf-8", timeout: 60000 });
  return { stdout: res.stdout || "", stderr: res.stderr || "", status: res.status };
}

function toolResult(success, text) {
  return {
    content: [{ type: "text", text }],
    isError: !success,
  };
}

function handleToolsCall(params) {
  const name = params?.name;
  const args = params?.arguments ?? {};
  if (!TOOLS.some((t) => t.name === name)) {
    return { error: { code: -32602, message: `Unknown tool: ${name}` } };
  }

  const cliArgs = [name.replace(/^memory_/, "")];
  if (ARG_ORDER[name]) {
    for (const key of ARG_ORDER[name]) {
      const v = args[key];
      if (v === undefined || v === null || v === "") continue;
      if (key === "confidence" || key === "n") {
        cliArgs.push(`--${key}=${v}`);
      } else {
        cliArgs.push(String(v));
      }
    }
  }

  const { stdout, stderr, status } = runCli(cliArgs);
  if (status !== 0) {
    return { result: toolResult(false, `memory ${name} failed:\n${stderr || stdout}`) };
  }
  return { result: toolResult(true, stdout.trim() || `memory ${name} ok`) };
}

/* ------------------------- JSON-RPC over stdio ------------------------- */

let buf = "";
const pending = new Map(); // id -> resolve fn (we don't stream, respond inline)

process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    handleMessage(msg);
  }
});

let writesInFlight = 0;
let stdinEnded = false;

function respond(id, payload) {
  writesInFlight++;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, ...payload }) + "\n", () => {
    writesInFlight--;
    maybeExit();
  });
}

function maybeExit() {
  if (stdinEnded && writesInFlight === 0) process.exit(0);
}

function handleMessage(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      respond(id, {
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "buffy-memory", version: "1.0.0" },
        },
      });
      break;
    case "notifications/initialized":
      // no response expected
      break;
    case "tools/list":
      respond(id, { result: { tools: TOOLS } });
      break;
    case "tools/call": {
      const out = handleToolsCall(params);
      if (out.error) respond(id, { error: out.error });
      else respond(id, out.result);
      break;
    }
    case "ping":
      respond(id, { result: {} });
      break;
    default:
      respond(id, { error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

// When the client closes stdin, exit only after all responses have flushed
// to stdout (avoids truncating buffered async writes).
process.stdin.on("end", () => {
  stdinEnded = true;
  maybeExit();
});