// DhaherOS Fase 9 slice-1 — API GATEWAY zero-egress (:3032 → control plane :3031).
//
// Keamanan (pola tetap DhaherOS):
//   - Bind 127.0.0.1 ONLY (zero-egress; tak ada antarmuka eksternal).
//   - Upstream WAJIB http://127.0.0.1(:port)/localhost — selain itu gateway menolak start.
//   - Token dari tabel secrets (REFERENCE — registry hanya tahu NAMA ref via --token-ref;
//     NILAI dibaca server-side dan TIDAK PERNAH di log/event/response/artefak).
//     Header auth: x-dhos-gateway-token. Tanpa/salah token → 401 + event gateway_denied.
//     Token belum diprovision → semua request 401 (deny-by-default, jujur ter-audit).
//   - Rate-limit ringan per-IP: token bucket (default 60 req/mnt, burst 60) →
//     melebihi → 429 + event gateway_rate_limited (dibalas gateway, upstream tak disentuh).
//   - Routing: SEMUA /api/* → upstream (fetch forward, stream response; header token
//     DIBUANG sebelum forward). Path lain → 404 + gateway_denied (deny ter-audit).
//   - Audit event ditulis ke tabel events yang sama (append-only) dgn payload via:"gateway".
//
// CLI (durasi via arg untuk uji):
//   bun src/gateway.ts [--port 3032] [--target http://127.0.0.1:3031] [--upstream ... alias]
//       [--token-ref gateway_token] [--rate-per-min 60] [--burst 60] [--duration SEC]
//   Env override: DHOS_GATEWAY_RATE_PER_MIN (default 60), DHOS_GATEWAY_BURST (default 60).
//   Provisioning token REUSE API secrets control plane (POST /api/secrets {name,value} →
//   event secret_set ter-audit; gateway membaca NILAI dari tabel secrets server-side —
//   REFERENCE; nilai tidak pernah di log/event/response gateway).
import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import process from "node:process";
import { timingSafeEqual } from "node:crypto";
import { ROOT, DATA_DIR } from "./paths";

interface GwArgs {
  port: number;
  upstream: string;
  tokenRef: string;
  ratePerMin: number;
  burst: number;
  durationSec: number | null; // null = jalan terus
}

function parseArgs(argv: string[]): GwArgs {
  const envRate = Number(process.env.DHOS_GATEWAY_RATE_PER_MIN);
  const envBurst = Number(process.env.DHOS_GATEWAY_BURST);
  const a: GwArgs = {
    port: 3032,
    upstream: "http://127.0.0.1:3031",
    tokenRef: "gateway_token",
    ratePerMin: Number.isFinite(envRate) && envRate > 0 ? envRate : 60,
    burst: Number.isFinite(envBurst) && envBurst > 0 ? envBurst : 60,
    durationSec: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i] ?? "";
    if (k === "--port") a.port = Number(next()) || 3032;
    else if (k === "--target" || k === "--upstream") a.upstream = next();
    else if (k === "--token-ref") a.tokenRef = next();
    else if (k === "--rate-per-min") a.ratePerMin = Number(next()) || a.ratePerMin;
    else if (k === "--burst") a.burst = Number(next()) || a.burst;
    else if (k === "--duration") a.durationSec = Number(next()) || null;
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));

// Zero-egress guard: upstream hanya loopback — selain itu TIDAK start (deny-by-default).
function loopbackHttp(u: string): URL | null {
  try {
    const url = new URL(u);
    if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) {
      return url;
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

const upstreamURL = loopbackHttp(args.upstream);
if (!upstreamURL) {
  console.error(`[gateway] upstream harus http://127.0.0.1(:port)/localhost (zero-egress): ${args.upstream} — TIDAK start`);
  process.exit(1);
}

// Akses langsung SQLite yang sama dgn control plane (WAL, multi-proses aman):
// baca nilai token dari tabel secrets (REFERENCE) + append event audit gateway.
const dbPath = `${DATA_DIR}/dhaheros.db`;
let sq: Database | null = null;
if (existsSync(dbPath)) {
  try {
    sq = new Database(dbPath);
    sq.exec("PRAGMA journal_mode = WAL;");
    sq.exec("PRAGMA busy_timeout = 5000;");
  } catch (e) {
    console.error(`[gateway] db gagal dibuka (${String(e)}) → semua request akan 401 (deny-by-default)`);
    sq = null;
  }
} else {
  console.error("[gateway] db tidak ada → semua request 401 (deny-by-default) sampai control plane membuat db");
}

function readToken(ref: string): string | null {
  if (!sq) return null;
  try {
    const r = sq.query("SELECT value FROM secrets WHERE name = ?").get(ref) as
      | { value: string }
      | null;
    return r?.value ?? null;
  } catch {
    return null;
  }
}

// Append-only audit ke tabel events yang sama (task_id NULL; payload via:"gateway").
// NILAI TOKEN TIDAK PERNAH masuk payload/log (pola secret REFERENCE).
function audit(type: string, payload: Record<string, unknown>): void {
  if (!sq) return;
  try {
    sq
      .query("INSERT INTO events (ts, task_id, type, payload) VALUES (?, NULL, ?, ?)")
      .run(new Date().toISOString(), type, JSON.stringify(payload));
  } catch (e) {
    console.error(`[gateway] audit gagal (${type}): ${String(e).slice(0, 120)}`);
  }
}

// ---- rate limit: token bucket per-IP ----
const buckets = new Map<string, { tokens: number; last: number }>();

function allow(ip: string, burst: number, ratePerMin: number): boolean {
  const now = Date.now();
  const refillPerMs = ratePerMin / 60000;
  const b = buckets.get(ip) ?? { tokens: burst, last: now };
  b.tokens = Math.min(burst, b.tokens + (now - b.last) * refillPerMs);
  b.last = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    buckets.set(ip, b);
    return true;
  }
  buckets.set(ip, b);
  return false;
}

function tokenMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    timingSafeEqual(a, a); // tetap konsumsi waktu sebanding
    return false;
  }
  return timingSafeEqual(a, b);
}

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", ...(extraHeaders ?? {}) },
  });
}

const server = Bun.serve({
  port: args.port,
  hostname: "127.0.0.1", // bind 127.0.0.1 ONLY (zero-egress)
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;
    const ip = server.requestIP(req)?.address ?? "127.0.0.1";

    // liveness gateway sendiri (tanpa token; tidak menyentuh upstream)
    if (url.pathname === "/gateway/health" && method === "GET") {
      return json({ ok: true, service: "dhaheros-gateway", port: args.port, upstream: upstreamURL!.origin, ts: new Date().toISOString() });
    }

    // hanya /api/* yang di-route — path lain ditolak ter-audit (deny-by-default)
    if (!url.pathname.startsWith("/api/")) {
      audit("gateway_denied", { via: "gateway", reason: "path_not_allowed", path: url.pathname, method, ip });
      return json({ error: "gateway: hanya /api/* yang di-route" }, 404);
    }

    // rate limit (dicek sebelum auth — guard termurah dulu; bucket per-IP)
    if (!allow(ip, args.burst, args.ratePerMin)) {
      audit("gateway_rate_limited", {
        via: "gateway",
        reason: "rate_limit_exceeded",
        ip,
        method,
        path: url.pathname,
        rate_per_min: args.ratePerMin,
        burst: args.burst,
      });
      return json({ error: "rate limit exceeded (gateway)" }, 429, { "retry-after": "1" });
    }

    // auth token — nilai dibaca dari tabel secrets (REFERENCE), tak pernah di log
    const provided = req.headers.get("x-dhos-gateway-token") ?? "";
    const expected = readToken(args.tokenRef);
    if (!expected || !provided || !tokenMatches(provided, expected)) {
      audit("gateway_denied", {
        via: "gateway",
        reason: expected ? "invalid_token" : "token_not_provisioned",
        ip,
        method,
        path: url.pathname,
        token_ref: args.tokenRef,
      });
      return json({ error: "unauthorized (gateway)" }, 401);
    }

    // forward ke upstream — header host + token dibuang; body diteruskan;
    // response di-stream (upstream.body langsung), header hop-by-hop dibuang.
    const fwdHeaders = new Headers(req.headers);
    fwdHeaders.delete("host");
    fwdHeaders.delete("x-dhos-gateway-token");
    fwdHeaders.delete("content-length");
    fwdHeaders.delete("connection");
    try {
      const upstream = await fetch(`${upstreamURL.origin}${url.pathname}${url.search}`, {
        method,
        headers: fwdHeaders,
        body: method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer(),
        redirect: "manual",
      });
      const outHeaders = new Headers();
      upstream.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (lk !== "content-length" && lk !== "content-encoding" && lk !== "transfer-encoding") {
          outHeaders.set(k, v);
        }
      });
      return new Response(upstream.body, { status: upstream.status, headers: outHeaders });
    } catch (e) {
      audit("gateway_upstream_error", {
        via: "gateway",
        reason: "upstream_unreachable",
        ip,
        method,
        path: url.pathname,
        detail: String(e).slice(0, 200),
      });
      return json({ error: "upstream unreachable (gateway)" }, 502);
    }
  },
});

console.log(
  `[gateway] listening 127.0.0.1:${args.port} → upstream ${upstreamURL.origin} | token-ref=${args.tokenRef} (nilai tidak di-log) | rate=${args.ratePerMin}/mnt burst=${args.burst} | pid=${process.pid}`
);

if (args.durationSec !== null) {
  setTimeout(() => {
    console.log(`[gateway] durasi ${args.durationSec}s habis — exit`);
    server.stop(true);
    process.exit(0);
  }, args.durationSec * 1000);
}
