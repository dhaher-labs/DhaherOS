// Mock provider LOKAL untuk uji connection test DhaherOS (Fase 6, AT-30/AT-31).
// Dijalankan verify_at.sh di dua port: host-A (endpoint terkonfigurasi, punya path /redirect)
// dan host-B (target redirect /callback) — bukti credential TIDAK bocor lintas host.
// ZERO egress eksternal: hanya menerima koneksi dari localhost, tidak melakukan koneksi keluar.
// Pakai: bun src/mock_provider.ts <port> [peerRedirectTargetURL]
const port = Number(process.argv[2] ?? 4511);
const peer = process.argv[3] ?? ""; // URL callback untuk /redirect (host-B)
const CRED = "x-dhos-credential";

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const gotAuth = req.headers.has(CRED);
    if (url.pathname === "/health") return Response.json({ ok: true, host: url.host });
    if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, 405);
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    if (url.pathname === "/echo") {
      return Response.json({ ok: true, echo: body, got_auth: gotAuth, host: url.host });
    }
    if (url.pathname === "/redirect") {
      // Host terkonfigurasi MENUNTUT credential: tanpa header → 401 (bukti header dikirim
      // bila provider punya secret, dan TIDAK dikirim bila tidak ada).
      if (!gotAuth) return Response.json({ error: "missing_credential" }, 401);
      if (!peer) return Response.json({ error: "no_peer_configured" }, 500);
      return new Response(null, { status: 302, headers: { location: peer } });
    }
    if (url.pathname === "/callback") {
      // Host kedua (tujuan redirect): melaporkan apakah credential ikut terbawa.
      // Kontrak AT-30 → got_auth HARUS false di sini.
      return Response.json({ ok: true, echo: body, got_auth: gotAuth, host: url.host });
    }
    return Response.json({ error: "not_found" }, 404);
  },
});
console.log(`[mock-provider] listening :${port} peer=${peer || "-"}`);
