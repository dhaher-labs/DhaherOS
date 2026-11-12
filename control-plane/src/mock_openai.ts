// Mock provider OpenAI-compatible LOKAL untuk uji AT-PR (run-33, Track 2 — Tahap 6 P23).
// Mengimplementasikan endpoint publik OpenAI-compatible:
//   GET  /v1/models            → { data: [{id:"mock-model"}], got_auth, host }
//   POST /v1/chat/completions  → { choices: [{message:{content:"mock-response"},...}], got_auth, host }
//   POST /redirect             → 302 ke peer (mock-B /callback) — menuntut Authorization: Bearer
//   POST /callback             → respons universal (OpenAI + Anthropic shape) + got_auth (untuk AT-PR-06)
// ZERO egress: hanya menerima koneksi dari localhost, tidak melakukan koneksi keluar.
// Pakai: bun src/mock_openai.ts <port> [peerRedirectURL]
const port = Number(process.argv[2] ?? 4521);
const peer = process.argv[3] ?? "";
const AUTH_HEADER = "authorization";

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const gotAuth = req.headers.has(AUTH_HEADER);
    if (url.pathname === "/health") return Response.json({ ok: true, host: url.host });

    if (url.pathname === "/v1/models" && req.method === "GET") {
      if (!gotAuth) return Response.json({ error: "missing_authorization" }, { status: 401 });
      return Response.json({
        object: "list",
        data: [{ id: "mock-model", object: "model", owned_by: "dhos-mock" }],
        got_auth: gotAuth,
        host: url.host,
      });
    }
    if (url.pathname === "/v1/chat/completions" && req.method === "POST") {
      if (!gotAuth) return Response.json({ error: "missing_authorization" }, { status: 401 });
      return Response.json({
        id: "chatcmpl-mock",
        object: "chat.completion",
        choices: [
          { index: 0, message: { role: "assistant", content: "mock-response" }, finish_reason: "stop" },
        ],
        got_auth: gotAuth,
        host: url.host,
      });
    }
    if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

    // /redirect: host terkonfigurasi MENUNTUT Authorization: Bearer — tanpa → 401.
    // Bila ada, kembalikan 302 ke peer (mock-B /callback) — bukti credential TIDAK bocor.
    if (url.pathname === "/redirect") {
      if (!gotAuth) return Response.json({ error: "missing_authorization" }, { status: 401 });
      if (!peer) return Response.json({ error: "no_peer_configured" }, { status: 500 });
      return new Response(null, { status: 302, headers: { location: peer } });
    }
    // /callback: tujuan redirect. Laporkan got_auth (HARUS false — credential TIDAK ikut).
    // Respons universal: memuat shape OpenAI-chat, OpenAI-models, dan Anthropic-messages
    // sekaligus agar validator respons protokol mana pun lulus (mock sintetis aman).
    if (url.pathname === "/callback") {
      return Response.json({
        // OpenAI chat shape
        choices: [
          { index: 0, message: { role: "assistant", content: "redirected-response" }, finish_reason: "stop" },
        ],
        // OpenAI models shape
        data: [{ id: "mock-model" }],
        // Anthropic messages shape
        content: [{ type: "text", text: "redirected-response" }],
        // origin-pinning indicator (mock-only field, tidak ada di API nyata)
        got_auth: gotAuth,
        host: url.host,
      });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  },
});
console.log(`[mock-openai] listening :${port} peer=${peer || "-"}`);
