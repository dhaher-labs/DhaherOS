// Mock provider Anthropic native Messages LOKAL untuk uji AT-PR (run-33, Track 2 — Tahap 6 P23).
// Mengimplementasikan endpoint Anthropic-compatible:
//   POST /v1/messages → { content: [{type:"text",text:"mock"}], got_auth, got_version, host }
//   POST /redirect    → 302 ke peer (mock-A /callback) — menuntut x-api-key + anthropic-version
//   POST /callback    → respons universal (Anthropic + OpenAI shape) + got_auth (untuk AT-PR-06)
// ZERO egress: hanya menerima koneksi dari localhost, tidak melakukan koneksi keluar.
// Pakai: bun src/mock_anthropic.ts <port> [peerRedirectURL]
const port = Number(process.argv[2] ?? 4522);
const peer = process.argv[3] ?? "";
const APIKEY_HEADER = "x-api-key";
const VER_HEADER = "anthropic-version";

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const gotAuth = req.headers.has(APIKEY_HEADER);
    const gotVersion = req.headers.has(VER_HEADER);
    if (url.pathname === "/health") return Response.json({ ok: true, host: url.host });

    if (url.pathname === "/v1/messages" && req.method === "POST") {
      // Anthropic native: x-api-key WAJIB; anthropic-version WAJIB.
      if (!gotAuth) return Response.json({ error: "missing_api_key" }, { status: 401 });
      if (!gotVersion) return Response.json({ error: "missing_anthropic_version" }, { status: 400 });
      return Response.json({
        id: "msg_mock",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "mock" }],
        model: "claude-mock",
        stop_reason: "end_turn",
        got_auth: gotAuth,
        got_version: gotVersion,
        host: url.host,
      });
    }
    if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

    // /redirect: menuntut x-api-key (anthropic-version opsional utk redirect; kunci adalah secret).
    if (url.pathname === "/redirect") {
      if (!gotAuth) return Response.json({ error: "missing_api_key" }, { status: 401 });
      if (!peer) return Response.json({ error: "no_peer_configured" }, { status: 500 });
      return new Response(null, { status: 302, headers: { location: peer } });
    }
    // /callback: tujuan redirect — respons universal + got_auth (HARUS false — pinning).
    if (url.pathname === "/callback") {
      return Response.json({
        // Anthropic messages shape
        content: [{ type: "text", text: "redirected-response" }],
        // OpenAI chat shape
        choices: [
          { index: 0, message: { role: "assistant", content: "redirected-response" }, finish_reason: "stop" },
        ],
        // OpenAI models shape
        data: [{ id: "mock-model" }],
        got_auth: gotAuth,
        host: url.host,
      });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  },
});
console.log(`[mock-anthropic] listening :${port} peer=${peer || "-"}`);
