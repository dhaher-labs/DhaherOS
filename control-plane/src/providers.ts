// DhaherOS — Fase 6 slice-1: Tools/provider/credential, iris aman zero-egress (gate Tahap 6
// plan §13 AT-28..AT-31). Prototipe minimal (provider remote/biaya/egress TETAP OPEN —
// hanya endpoint LOKAL (127.0.0.1/localhost) yang diizinkan di slice ini).
//   - Registry provider dengan KONTRAK eksplisit: protokol, versi, model_id, endpoint,
//     dan HANYA capability yang ada di whitelist kontrak protokol (teruji via mock lokal).
//     Nama "compatible" TIDAK dianggap parity (AT-28): protokol di luar kontrak ditolak.
//   - Secret REFERENCE server-side: registry hanya menyimpan NAMA referensi; nilai disimpan
//     di tabel secrets dan TIDAK PERNAH keluar via API/event/log (AT-09/AT-30).
//   - Connection test HANYA payload sintetis aman via fetch ke endpoint terdaftar (AT-31);
//     hasil yang benar-benar diuji (endpoint, status, redirect chain, latency) dilaporkan
//     apa adanya — tanpa sukses palsu.
//   - Unsupported capability/field → request GAGAL eksplisit menyebut capability/field,
//     TANPA silent-ignore (AT-29).
//   - Origin pinning (AT-30): credential custom-header HANYA dikirim ke request pertama
//     (host terkonfigurasi); redirect diikuti dengan redirect:'manual' dan re-fetch ke
//     location TANPA credential header — redirect host lain tidak membocorkan credential.
//
// run-33 Track 2 (P23 direct request, Tahap 6 §10): dua jalur provider terpisah eksplisit —
// klaim "compatible" TIDAK parity:
//   - openai-compatible v1: endpoint custom /v1/chat/completions + /v1/models,
//     auth "Authorization: Bearer <secret_ref>".
//   - anthropic-messages v1: native Messages API /v1/messages,
//     auth "x-api-key: <secret_ref>" + header "anthropic-version: 2023-06-01".
// Mock lokal 127.0.0.1 saja di slice ini; egress eksternal TETAP OPEN (plan DL-34).
import { db, insertEvent } from "./db";

export interface ProtocolContract {
  version: string;
  capabilities: readonly string[];
  request_fields: readonly string[];
  credential_header: string;
  // P23 (run-33 Track 2): utk openai-compatible, nilai header = "Bearer <secret>".
  credential_value_prefix?: string;
  // P23 (run-33 Track 2): utk anthropic-messages, header tambahan "anthropic-version: 2023-06-01"
  // dikirim pada hop pertama (bind ke host terkonfigurasi — AT-30 origin pinning).
  extra_headers?: Record<string, string>;
  // P23 (run-33 Track 2): true → secret_ref WAJIB utk SEMUA capability (openai/anthropic).
  // http-json: false (capability http.json.header_probe punya cek khusus eksplisit).
  credential_required: boolean;
}

// Per-capability response validation kind — bagaimana body respons diuji.
//   echo             : body.echo === payload (mock http-json AT-47).
//   openai-chat      : body.choices[0].message.content (string).
//   openai-models    : body.data (array).
//   anthropic-messages: body.content[0].text (string).
export const CAPABILITY_RESPONSE_KINDS: Record<
  string,
  "echo" | "openai-chat" | "openai-models" | "anthropic-messages"
> = {
  "http.json.echo": "echo",
  "http.json.header_probe": "echo",
  "chat.completions": "openai-chat",
  "models.list": "openai-models",
  "messages.create": "anthropic-messages",
  "messages.stream": "anthropic-messages",
};

// Whitelist tertutup di kode — satu-satunya sumber kebenaran capability TERUJI.
// Menambah protokol/capability = mengubah kontrak ini lewat perubahan kode + uji nyata.
export const PROTOCOL_CONTRACTS: Record<string, ProtocolContract> = {
  "http-json": {
    version: "1",
    capabilities: ["http.json.echo", "http.json.header_probe"],
    request_fields: ["payload", "timeout_ms"],
    credential_header: "x-dhos-credential",
    credential_required: false,
  },
  "openai-compatible": {
    version: "1",
    capabilities: ["chat.completions", "models.list"],
    request_fields: ["payload", "timeout_ms"],
    credential_header: "authorization",
    credential_value_prefix: "Bearer ",
    credential_required: true,
  },
  "anthropic-messages": {
    version: "1",
    capabilities: ["messages.create", "messages.stream"],
    request_fields: ["payload", "timeout_ms"],
    credential_header: "x-api-key",
    extra_headers: { "anthropic-version": "2023-06-01" },
    credential_required: true,
  },
};

db.exec(`
CREATE TABLE IF NOT EXISTS providers (
  name TEXT PRIMARY KEY,
  protocol TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  model_id TEXT,
  secret_ref TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS secrets (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

const now = () => new Date().toISOString();

export interface ProviderDetail {
  name: string;
  protocol: string;
  protocol_version: string;
  endpoint: string;
  capabilities: string[];
  model_id: string | null;
  has_secret: boolean;
  created_at: string;
}

export type Denial = { status: number; reason: string; detail?: Record<string, unknown> };

type ProviderRow = {
  name: string;
  protocol: string;
  endpoint: string;
  capabilities: string;
  model_id: string | null;
  secret_ref: string | null;
  created_at: string;
};

function rowToDetail(row: ProviderRow): ProviderDetail {
  const contract = PROTOCOL_CONTRACTS[row.protocol];
  return {
    name: row.name,
    protocol: row.protocol,
    protocol_version: contract?.version ?? "?",
    endpoint: row.endpoint,
    capabilities: JSON.parse(row.capabilities) as string[],
    model_id: row.model_id,
    has_secret: !!row.secret_ref && !!db.query("SELECT name FROM secrets WHERE name = ?").get(row.secret_ref),
    created_at: row.created_at,
  };
}

function nameValid(s: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(s);
}

function isLocalHttp(u: URL): boolean {
  return (u.protocol === "http:" || u.protocol === "https:") && (u.hostname === "127.0.0.1" || u.hostname === "localhost");
}

// ---------- secrets (nilai TIDAK pernah keluar) ----------
export function setSecret(spec: { name?: unknown; value?: unknown }):
  | { name: string; stored: true }
  | Denial {
  const name = typeof spec.name === "string" ? spec.name.trim() : "";
  const value = typeof spec.value === "string" ? spec.value : "";
  if (!nameValid(name)) return { status: 400, reason: "secret_name_invalid" };
  if (!value || value.length > 512) return { status: 400, reason: "secret_value_invalid" };
  db.query(
    "INSERT INTO secrets (name, value, created_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value"
  ).run(name, value, now());
  // event TANPA nilai (AT-09/AT-30): hanya nama referensi
  insertEvent(null, "secret_set", { name, ts: now() });
  return { name, stored: true };
}

export function listSecrets(): { name: string; has_value: boolean }[] {
  return (db.query("SELECT name FROM secrets ORDER BY name").all() as { name: string }[]).map((r) => ({
    name: r.name,
    has_value: true,
  }));
}

// ---------- registry provider ----------
export function createProvider(spec: {
  name?: unknown;
  protocol?: unknown;
  endpoint?: unknown;
  capabilities?: unknown;
  model_id?: unknown;
  secret_ref?: unknown;
}): ProviderDetail | Denial {
  const name = typeof spec.name === "string" ? spec.name.trim() : "";
  if (!nameValid(name)) return { status: 400, reason: "provider_name_invalid", detail: { name } };
  if (db.query("SELECT name FROM providers WHERE name = ?").get(name)) {
    return { status: 409, reason: "provider_exists", detail: { name } };
  }

  const protocol = typeof spec.protocol === "string" ? spec.protocol.trim() : "";
  const contract = PROTOCOL_CONTRACTS[protocol];
  if (!contract) {
    // AT-28: protokol tak dikenal — termasuk yang mengaku "compatible" — TIDAK dianggap parity.
    insertEvent(null, "provider_denied", {
      reason: "unknown_protocol",
      provider: name,
      protocol,
      note: "protokol tidak ada di kontrak tertutup; klaim compatibility bukan parity",
      ts: now(),
    });
    return { status: 400, reason: "unknown_protocol", detail: { protocol } };
  }

  const endpoint = typeof spec.endpoint === "string" ? spec.endpoint.trim() : "";
  let eu: URL;
  try {
    eu = new URL(endpoint);
  } catch {
    return { status: 400, reason: "endpoint_invalid_url", detail: { endpoint } };
  }
  if (!isLocalHttp(eu)) {
    // Egress ke host non-lokal = keputusan pemilik (plan Tahap 6 OPEN) — ditolak di slice ini.
    insertEvent(null, "provider_denied", {
      reason: "endpoint_not_local",
      provider: name,
      endpoint,
      note: "hanya 127.0.0.1/localhost diizinkan; egress eksternal TETAP OPEN",
      ts: now(),
    });
    return { status: 400, reason: "endpoint_not_local", detail: { endpoint } };
  }

  if (!Array.isArray(spec.capabilities) || spec.capabilities.length === 0) {
    return { status: 400, reason: "capabilities_wajib_nonempty", detail: { provider: name } };
  }
  for (const c of spec.capabilities as unknown[]) {
    if (typeof c !== "string" || !contract.capabilities.includes(c)) {
      insertEvent(null, "provider_denied", {
        reason: "unknown_capability",
        provider: name,
        capability: typeof c === "string" ? c : String(c),
        protocol,
        note: "capability di luar whitelist kontrak protokol ditolak",
        ts: now(),
      });
      return { status: 400, reason: "unknown_capability", detail: { capability: c, protocol } };
    }
  }
  const caps = [...new Set(spec.capabilities as string[])].sort();

  let model_id: string | null = null;
  if (spec.model_id !== undefined && spec.model_id !== null) {
    if (typeof spec.model_id !== "string" || !nameValid(spec.model_id)) {
      return { status: 400, reason: "model_id_invalid", detail: { provider: name } };
    }
    model_id = spec.model_id;
  }

  let secret_ref: string | null = null;
  if (spec.secret_ref !== undefined && spec.secret_ref !== null) {
    if (typeof spec.secret_ref !== "string" || !nameValid(spec.secret_ref)) {
      return { status: 400, reason: "secret_ref_invalid", detail: { provider: name } };
    }
    if (!db.query("SELECT name FROM secrets WHERE name = ?").get(spec.secret_ref)) {
      insertEvent(null, "provider_denied", {
        reason: "unknown_secret_ref",
        provider: name,
        secret_ref: spec.secret_ref,
        note: "secret_ref merujuk secret yang belum terdaftar di store server-side",
        ts: now(),
      });
      return { status: 400, reason: "unknown_secret_ref", detail: { secret_ref: spec.secret_ref } };
    }
    secret_ref = spec.secret_ref;
  }

  db.query(
    "INSERT INTO providers (name, protocol, endpoint, capabilities, model_id, secret_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(name, protocol, endpoint, JSON.stringify(caps), model_id, secret_ref, now());
  insertEvent(null, "provider_registered", {
    provider: name,
    protocol,
    protocol_version: contract.version,
    endpoint,
    capabilities: caps,
    model_id,
    has_secret: !!secret_ref,
    ts: now(),
  });
  return rowToDetail(db.query("SELECT * FROM providers WHERE name = ?").get(name) as ProviderRow);
}

export function listProviders(): ProviderDetail[] {
  return (db.query("SELECT * FROM providers ORDER BY name").all() as ProviderRow[]).map(rowToDetail);
}

export function getProvider(name: string): ProviderDetail | null {
  const row = db.query("SELECT * FROM providers WHERE name = ?").get(name) as ProviderRow | undefined;
  return row ? rowToDetail(row) : null;
}

// ---------- connection test (payload sintetis, origin pinning) ----------
export interface TestResult {
  ok: boolean;
  provider: string;
  endpoint: string;
  capability: string;
  reason: string;
  status: number | null;
  latency_ms: number;
  redirects: { status: number; location: string }[];
  final_got_auth: boolean | null;
  payload_sha256: string;
}

export async function testProvider(
  name: string,
  spec: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const row = db.query("SELECT * FROM providers WHERE name = ?").get(name) as ProviderRow | undefined;
  if (!row) return { status: 404, body: { error: "provider_not_found" } };
  const contract = PROTOCOL_CONTRACTS[row.protocol];
  const deny = (status: number, reason: string, detail?: Record<string, unknown>) => {
    insertEvent(null, "provider_denied", { reason, provider: name, ...detail, ts: now() });
    return { status, body: { error: reason, ...(detail ?? {}) } };
  };

  const capability = typeof spec.capability === "string" ? spec.capability.trim() : "";
  if (!capability || !contract.capabilities.includes(capability)) {
    // AT-29: gagal eksplisit menyebut capability — bukan silent-ignore.
    return deny(400, "unknown_capability", { capability, protocol: row.protocol });
  }
  const approved = JSON.parse(row.capabilities) as string[];
  if (!approved.includes(capability)) {
    // capability ada di kontrak protokol tapi tidak di-approve utk provider ini.
    return deny(403, "capability_unsupported", { capability, provider: name });
  }
  for (const key of Object.keys(spec)) {
    if (!contract.request_fields.includes(key) && key !== "capability") {
      // AT-29: field di luar kontrak → gagal eksplisit menyebut field.
      return deny(400, "unsupported_field", { field: key, contract_fields: contract.request_fields });
    }
  }
  const payload = spec.payload;
  if (typeof payload !== "object" || payload === null) {
    return deny(400, "payload_wajib_object", {});
  }
  const payloadStr = JSON.stringify(payload);
  if (payloadStr.length > 4096) {
    return deny(400, "payload_too_large", { max: 4096 });
  }

  let credential: string | null = null;
  if (capability === "http.json.header_probe" && !row.secret_ref) {
    return deny(400, "header_probe_requires_secret", { capability, provider: name });
  }
  // P23 (run-33 Track 2): protokol openai-compatible & anthropic-messages MENUNTUT secret_ref
  // utk SEMUA capability (chat.completions / models.list / messages.create / messages.stream).
  if (contract.credential_required && !row.secret_ref) {
    return deny(400, "credential_required_for_protocol", {
      capability,
      provider: name,
      protocol: row.protocol,
      note: "protokol ini menuntut secret_ref utk semua capability (auth header wajib)",
    });
  }
  if (row.secret_ref) {
    const s = db.query("SELECT value FROM secrets WHERE name = ?").get(row.secret_ref) as { value: string } | undefined;
    if (!s) return deny(400, "secret_ref_missing", { secret_ref: row.secret_ref });
    credential = s.value;
  }

  const timeout_ms = spec.timeout_ms === undefined ? 5000 : spec.timeout_ms;
  if (typeof timeout_ms !== "number" || !Number.isInteger(timeout_ms) || timeout_ms < 100 || timeout_ms > 15000) {
    return deny(400, "timeout_ms_invalid", {});
  }

  const payloadSha = new Bun.CryptoHasher("sha256").update(payloadStr).digest("hex");
  const t0 = Date.now();
  const redirects: { status: number; location: string }[] = [];
  let currentUrl = row.endpoint;
  let resp: Response | null = null;
  try {
    for (;;) {
      // AT-30 origin pinning: credential header HANYA di hop pertama (host terkonfigurasi).
      // P23 (run-33 Track 2): utk openai-compatible, nilai = "Bearer <secret>"; utk
      // anthropic-messages, header "anthropic-version: 2023-06-01" juga dikirim (hanya hop-1).
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (redirects.length === 0 && credential) {
        const credValue = contract.credential_value_prefix
          ? `${contract.credential_value_prefix}${credential}`
          : credential;
        headers[contract.credential_header] = credValue;
        if (contract.extra_headers) {
          for (const [k, v] of Object.entries(contract.extra_headers)) {
            headers[k] = v;
          }
        }
      }
      const fetchOpts: RequestInit & { redirect: RequestRedirect } = {
        method: "POST",
        headers,
        body: payloadStr,
        redirect: "manual",
        signal: AbortSignal.timeout(timeout_ms),
      };
      // models.list pada openai-compatible = GET (kontrak publik OpenAI); body tidak dikirim.
      if (capability === "models.list") {
        delete (fetchOpts as { body?: string }).body;
        fetchOpts.method = "GET";
      }
      resp = await fetch(currentUrl, fetchOpts);
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const loc = resp.headers.get("location") ?? "";
        if (!loc) {
          return finish(false, "redirect_without_location", resp.status);
        }
        redirects.push({ status: resp.status, location: loc });
        if (redirects.length > 3) return finish(false, "redirect_loop", resp.status);
        currentUrl = new URL(loc, currentUrl).toString();
        continue; // re-fetch TANPA credential header
      }
      break;
    }
  } catch (e) {
    return finish(false, "fetch_error", null, String((e as Error)?.name ?? e));
  }

  if (!resp) return finish(false, "no_response", null);
  const status = resp.status;
  if (status < 200 || status >= 300) {
    return finish(false, `http_status_${status}`, status);
  }
  let raw: unknown = null;
  try {
    raw = await resp.json();
  } catch {
    return finish(false, "invalid_response_json", status);
  }
  const body = (raw ?? {}) as Record<string, unknown>;
  // P23 (run-33 Track 2): validasi respons per capability response_kind.
  //   echo             : body.echo === payload (mock http-json AT-47).
  //   openai-chat      : body.choices[0].message.content (string).
  //   openai-models    : body.data (array).
  //   anthropic-messages: body.content[0].text (string).
  const responseKind = CAPABILITY_RESPONSE_KINDS[capability] ?? "echo";
  let validResp = false;
  if (responseKind === "echo") {
    if (JSON.stringify(body.echo) === JSON.stringify(payload)) validResp = true;
  } else if (responseKind === "openai-chat") {
    const choices = body.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown> | undefined;
      const msg = first?.message as Record<string, unknown> | undefined;
      if (msg && typeof msg.content === "string") validResp = true;
    }
  } else if (responseKind === "openai-models") {
    if (Array.isArray(body.data)) validResp = true;
  } else if (responseKind === "anthropic-messages") {
    const content = body.content;
    if (Array.isArray(content) && content.length > 0) {
      const first = content[0] as Record<string, unknown> | undefined;
      if (first && typeof first.text === "string") validResp = true;
    }
  }
  if (!validResp) {
    return finish(false, "response_shape_invalid", status);
  }
  const gotAuth = typeof body.got_auth === "boolean" ? body.got_auth : null;
  if (capability === "http.json.header_probe" && gotAuth !== true) {
    return finish(false, "credential_header_not_received", status);
  }
  // P23 (run-33 Track 2): utk protokol dgn credential_required=true, header auth WAJIB
  // diterima host pertama. Bila ada redirect, credential SUDAH divalidasi mock-A (yg
  // menolak 401 tanpa header) sebelum 302 — maka cek gotAuth HANYA pada kasus no-redirect.
  if (redirects.length === 0 && contract.credential_required && gotAuth !== true) {
    return finish(false, "credential_header_not_received", status);
  }
  return finish(true, "ok", status, undefined, gotAuth);

  function finish(
    ok: boolean,
    reason: string,
    st: number | null,
    extraReason?: string,
    gotAuth: boolean | null = null
  ): { status: number; body: Record<string, unknown> } {
    const result: TestResult = {
      ok,
      provider: name,
      endpoint: row!.endpoint,
      capability,
      reason: extraReason ? `${reason}:${extraReason}` : reason,
      status: st,
      latency_ms: Date.now() - t0,
      redirects,
      final_got_auth: gotAuth,
      payload_sha256: payloadSha,
    };
    // event TANPA nilai secret; payload uji = sintetis dari pemanggil (bukan data sumber).
    insertEvent(null, "provider_test", { ...result, ts: now() });
    return { status: 200, body: { test: result } };
  }
}
