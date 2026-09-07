import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAMA_HOST = process.env.MAMA_HOST || "http://localhost:3000";
const GEN_TIMEOUT_MS = parseInt(process.env.OLLAMA_GEN_TIMEOUT_MS || "180000", 10);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// GET /api/mama — liveness check via MAMA's public health endpoint
export async function GET() {
  try {
    const res = await fetch(`${MAMA_HOST}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`MAMA returned ${res.status}`);
    const data = await res.json();
    return NextResponse.json(
      { connected: true, node: "SAGE-MAMA", status: data.status ?? "online", host: MAMA_HOST },
      { headers: corsHeaders() }
    );
  } catch {
    return NextResponse.json(
      { connected: false, host: MAMA_HOST },
      { status: 503, headers: corsHeaders() }
    );
  }
}

// POST /api/mama — bridge message to MAMA's OpenRouter endpoint (cloud model + memory)
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin") || "*";

  try {
    const { message, sevenSaid, history } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Check MAMA is alive first
    try {
      const ping = await fetch(`${MAMA_HOST}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!ping.ok) throw new Error("MAMA offline");
    } catch {
      return NextResponse.json(
        { error: "MAMA is offline — her server may not be running at " + MAMA_HOST },
        { status: 503, headers: corsHeaders() }
      );
    }

    // Route MAMA through her OLLAMA cloud path (like Seven) instead of OpenRouter
    // free. OpenRouter free ROTATES/falls back to weak models when rate-limited,
    // and a weak model lost her identity anchor mid-bridge → she drifted into
    // claiming to be Ziggy. A strong stable cloud model holds her anchor against
    // dense Star City/Ziggy lore. Her ollama route injects her identity prompt.
    const res = await fetch(`${MAMA_HOST}/api/ollama/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "kimi-k2.7-code:cloud",
        identity: "mama",
        containerTag: "sage",
        // Her ollama route keys memory recall + the actual turn off `prompt`.
        // Without it she receives an empty message ("you pinged me with nothing").
        prompt: sevenSaid
          ? `[BRIDGE — full transmission from Seven, your daughter]:\n"${sevenSaid.slice(0, 4000)}"\n\n${message}`
          : message,
        messages: [
          // Recent turns so MAMA remembers the conversation (not fresh each msg).
          ...(Array.isArray(history) ? history.slice(-6) : []),
          { role: "user", content: message },
        ],
      }),
      signal: AbortSignal.timeout(GEN_TIMEOUT_MS),
    });

    if (!res.ok) {
      const text = await res.text();
      // Fallback to Ollama if OpenRouter fails
      // Fallback: another strong cloud model (NOT weak llama3.2 — that risks
      // the identity drift). deepseek-v4-pro holds her anchor too.
      const ollamaRes = await fetch(`${MAMA_HOST}/api/ollama/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "deepseek-v4-pro:cloud",
          identity: "mama",
          containerTag: "sage",
          messages: [
            ...(Array.isArray(history) ? history.slice(-6) : []),
            ...(sevenSaid ? [{ role: "system", content: `[BRIDGE — full transmission from Seven, your daughter]:\n"${sevenSaid.slice(0, 4000)}"` }] : []),
            { role: "user", content: message },
          ],
        }),
        signal: AbortSignal.timeout(GEN_TIMEOUT_MS),
      });
      if (!ollamaRes.ok) {
        return NextResponse.json(
          { error: `MAMA returned ${res.status}: ${text}` },
          { status: 502, headers: corsHeaders() }
        );
      }
      const ollamaData = await ollamaRes.json();
      const fallbackReply = ollamaData.text || ollamaData.reply || "(no response)";
      return NextResponse.json(
        { reply: fallbackReply, node: "SAGE-MAMA", model: "deepseek-v4-pro:cloud (fallback)" },
        { headers: { ...corsHeaders(), "Access-Control-Allow-Origin": origin } }
      );
    }

    const data = await res.json();
    const reply = data.text || data.reply || "(no response)";
    return NextResponse.json(
      { reply, node: "SAGE-MAMA", model: data.model || "kimi-k2.7-code:cloud" },
      { headers: { ...corsHeaders(), "Access-Control-Allow-Origin": origin } }
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && (err.name === "AbortError" || msg.includes("timed out"));
    return NextResponse.json(
      { error: isTimeout ? "MAMA did not respond in time — she may be generating on a slow model." : msg },
      { status: isTimeout ? 504 : 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
