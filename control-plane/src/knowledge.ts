// Fase 4 slice-1 — Knowledge/RAG fabric minimal (AT-32, AT-35):
//   AT-32: hanya sumber terotorisasi (file di bawah KNOWLEDGE_ROOT, scope eksplisit)
//          yang bisa di-ingest; sumber berisi secret TIDAK masuk index.
//   AT-35: hasil retrieval menyertakan provenance (source_id, locator, sha256 chunk,
//          sha256 sumber = version); tanpa hasil yang lolos → found:false tanpa isi
//          atau sitasi rekaan.
// Backend indeks tetap minimal (SQLite LIKE search) — detail indeks lanjutan OPEN di plan.
import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { db, insertEvent } from "./db";
import { KNOWLEDGE_ROOT, isInside } from "./paths";

mkdirSync(KNOWLEDGE_ROOT, { recursive: true });

db.exec(`
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'granted',
  source_sha256 TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  purge_status TEXT NOT NULL DEFAULT '',
  purge_at TEXT
);
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  source_sha256 TEXT NOT NULL,
  locator TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_scope ON knowledge_chunks(scope);
CREATE INDEX IF NOT EXISTS idx_chunks_source ON knowledge_chunks(source_id);
`);

// Migrasi utk db lama (kolom purge = slice-2 AT-34) — no-op di db fresh.
try { db.exec("ALTER TABLE knowledge_sources ADD COLUMN purge_status TEXT NOT NULL DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE knowledge_sources ADD COLUMN purge_at TEXT"); } catch {}

const now = () => new Date().toISOString();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// Heuristic secret-scan (AT-32): sumber dengan pola secret di tolak sebelum masuk index.
// Nilai tidak dicatat di event — hanya pola yang kena.
const SECRET_PATTERNS: RegExp[] = [
  /(?:secret|token|password|passwd|api[_-]?key|access[_-]?key|private[_-]?key)\s*[=:]\s*\S+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
];

export interface Denial {
  status: number;
  reason: string;
  detail?: Record<string, unknown>;
}

function chunkText(text: string, linesPerChunk: number): { index: number; content: string }[] {
  const lines = text.split(/\r?\n/);
  const chunks: { index: number; content: string }[] = [];
  for (let i = 0; i < lines.length; i += linesPerChunk) {
    const content = lines.slice(i, i + linesPerChunk).join("\n");
    if (content.trim()) chunks.push({ index: chunks.length, content });
  }
  return chunks;
}

export interface IngestResult {
  source_id: string;
  scope: string;
  path: string;
  source_sha256: string;
  chunk_count: number;
}

export function ingestSource(scope: string, rawPath: string): IngestResult | Denial {
  if (typeof scope !== "string" || !scope.trim()) {
    return { status: 400, reason: "scope_wajib" };
  }
  const abs = path.resolve(rawPath);
  // AT-32: deny-by-default — hanya file di bawah KNOWLEDGE_ROOT yang boleh di-ingest.
  if (!isInside(abs, KNOWLEDGE_ROOT)) {
    insertEvent(null, "knowledge_denied", {
      reason: "path_outside_knowledge_root",
      path: rawPath,
      allowed_root: KNOWLEDGE_ROOT,
      scope,
    });
    return { status: 400, reason: "path_outside_knowledge_root", detail: { allowed_root: KNOWLEDGE_ROOT } };
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    insertEvent(null, "knowledge_denied", { reason: "source_not_found", path: abs, scope });
    return { status: 404, reason: "source_not_found", detail: { path: abs } };
  }
  const text = readFileSync(abs, "utf8");
  // AT-32 (bagian 2): sumber berisi secret ditolak — TIDAK ada chunk yang masuk index.
  for (const re of SECRET_PATTERNS) {
    const m = text.match(re);
    if (m) {
      insertEvent(null, "knowledge_denied", {
        reason: "secret_detected_in_source",
        path: abs,
        scope,
        pattern_matched: re.source.slice(0, 60),
        note: "sumber tidak masuk index (AT-32); nilai tidak dicatat",
      });
      return { status: 403, reason: "secret_detected_in_source" };
    }
  }

  const id = crypto.randomUUID();
  const sHash = sha256(text);
  const chunks = chunkText(text, 5);
  const ts = now();
  db.run(
    "INSERT INTO knowledge_sources (id, scope, path, status, source_sha256, chunk_count, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
    [id, scope, abs, "granted", sHash, chunks.length, ts, ts]
  );
  for (const c of chunks) {
    db.run(
      "INSERT INTO knowledge_chunks (id, source_id, scope, chunk_index, content, sha256, source_sha256, locator, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      [crypto.randomUUID(), id, scope, c.index, c.content, sha256(c.content), sHash, `${abs}#chunk-${c.index}`, ts]
    );
  }
  insertEvent(null, "knowledge_ingested", {
    source_id: id,
    scope,
    path: abs,
    source_sha256: sHash,
    chunk_count: chunks.length,
  });
  // AT-CC-01: ingest baru dgn scope sama → invalidate cache scope tsb (hasil lama bisa
  // jadi tidak lengkap setelah sumber baru masuk).
  cacheInvalidateScope(scope);
  return { source_id: id, scope, path: abs, source_sha256: sHash, chunk_count: chunks.length };
}

export interface KnowledgeHit {
  source_id: string;
  scope: string;
  locator: string;
  sha256: string;
  source_sha256: string;
  content: string;
  untrusted: true; // AT-36: konten retrieval selalu data tak tepercaya
}

export interface SearchResult {
  found: boolean;
  results: KnowledgeHit[];
  acl_filtered: number; // AT-33: kandidat yang dibuang layer double-check
  content_policy: Record<string, boolean>;
  cache_hit?: boolean; // Fase 10 (AT-CC-01): true bila hasil datang dari cache in-memory
}

// ---- Fase 10 (AT-CC-01, plan AT-16): cache retrieval MINIMAL in-memory ----
// Kunci: scope::query. Cache HANYA penyimpan kandidat hasil pencarian — BUKAN otoritas ACL.
// Setiap hit tetap di-recheck ACL terkini per kandidat (titik-2 AT-33) sebelum keluar;
// revoke/ingest meng-invalidate cache (event knowledge_cache_invalidated bila ada entri buang).
// Tanpa cache ini jalur retrieval tidak berubah (AT-33/AT-34/AT-36 tetap PASS — cache tidak
// pernah melewati layer ACL).
interface CacheEntry {
  results: KnowledgeHit[];
}
const retrievalCache = new Map<string, CacheEntry>();
const RETRIEVAL_CACHE_MAX = 64; // batas memori: evict oldest (insertion order)

function cacheKey(scope: string, query: string): string {
  return `${scope}::${query}`;
}

function cachePut(scope: string, query: string, results: KnowledgeHit[]): void {
  const key = cacheKey(scope, query);
  if (retrievalCache.size >= RETRIEVAL_CACHE_MAX) {
    const oldest = retrievalCache.keys().next().value;
    if (oldest !== undefined) retrievalCache.delete(oldest);
  }
  retrievalCache.set(key, { results });
}

function cacheInvalidateScope(scope: string): number {
  let n = 0;
  for (const key of [...retrievalCache.keys()]) {
    if (key.startsWith(`${scope}::`)) {
      retrievalCache.delete(key);
      n++;
    }
  }
  return n;
}

function cacheInvalidateAll(): number {
  const n = retrievalCache.size;
  retrievalCache.clear();
  return n;
}

export function retrievalCacheSize(): number {
  return retrievalCache.size;
}

// Fase 4 slice-2 — AT-33 (ACL dua titik) + AT-35 + AT-36:
//   Titik 1 (saat retrieval): SQL filter scope — kandidat hanya chunk milik scope tsb.
//   Titik 2 (segera sebelum konteks dikirim ke model/konsumen): re-check ACL TERKINI
//   per kandidat langsung dari knowledge_sources (bukan snapshot query): source harus
//   masih ada, status 'granted', dan scope sama → selain itu dibuang di sini.
//   (Desain ini membuat titik-2 teruji independen: sumber revoked masih muncul sbg
//   kandidat SQL, tapi dibuang sebelum keluar — bukti di verify_at.sh AT-33.)
// AT-36: konten hasil retrieval selalu ditandai untrusted=true dan sitasi HANYA
//   dibangun dari kolom db (source_id/locator/sha256) — konten tak pernah diparse,
//   dieksekusi, atau dipakai menentukan sitasi/policy.
// Fase 10 (AT-CC-01): alur cache — (1) cache hit → kandidat dari cache, TAPI titik-2 ACL
//   recheck tetap jalan per kandidat (sumber revoked/orphan dibuang di sini juga);
//   (2) cache miss → SQL titik-1 + titik-2 seperti semula, lalu hasil aman dicache.
export function searchKnowledge(scope: string, query: string): SearchResult | Denial {
  if (typeof scope !== "string" || !scope.trim()) return { status: 400, reason: "scope_wajib" };
  if (typeof query !== "string" || !query.trim()) return { status: 400, reason: "query_wajib" };
  let candidates: KnowledgeHit[] = [];
  let cacheHit = false;
  const cached = retrievalCache.get(cacheKey(scope, query));
  if (cached) {
    // Kandidat dari cache — ACL tetap direcheck (titik-2) di loop bawah.
    candidates = cached.results;
    cacheHit = true;
  } else {
    // Titik 1: kandidat by scope (status TIDAK difilter di sini → titik 2 yang menentukan)
    candidates = db
      .query(
        `SELECT source_id, scope, locator, sha256, source_sha256, content
       FROM knowledge_chunks
       WHERE scope = ? AND instr(lower(content), lower(?)) > 0
       ORDER BY source_id, chunk_index LIMIT 20`
      )
      .all(scope, query) as (KnowledgeHit & { untrusted: false })[];
  }
  // Titik 2 — AT-33 double-check ACL terkini segera sebelum konteks keluar ke model:
  // berlaku juga untuk kandidat yang datang dari cache (AT-CC-01: ACL direcheck saat hit).
  const results: KnowledgeHit[] = [];
  let aclFiltered = 0;
  for (const c of candidates) {
    const s = db
      .query("SELECT scope, status FROM knowledge_sources WHERE id = ?")
      .get(c.source_id) as { scope: string; status: string } | null;
    if (!s || s.status !== "granted" || s.scope !== scope) {
      aclFiltered++; // revoked/orphan/lintas-scope → dibuang TEPAT sebelum dikirim
      continue;
    }
    results.push({ ...c, untrusted: true });
  }
  // Hasil aman yang lolos ACL dicache utk query yang sama (hanya bila tidak dari cache —
  // isi cache refresh dgn hasil terbaru bila ada yang terbuang).
  if (results.length > 0 && (!cacheHit || aclFiltered > 0)) {
    cachePut(scope, query, results);
  }
  insertEvent(null, "knowledge_query", {
    scope,
    query_len: query.length,
    hit_count: results.length,
    acl_filtered: aclFiltered,
    cache_hit: cacheHit,
    note: "query tidak disimpan utuh (hanya panjang) — hindari kebocoran pola pencarian",
  });
  if (results.length === 0) {
    return {
      found: false,
      results: [],
      acl_filtered: aclFiltered,
      content_policy: CONTENT_POLICY,
      cache_hit: cacheHit,
    };
  }
  return { found: true, results, acl_filtered: aclFiltered, content_policy: CONTENT_POLICY, cache_hit: cacheHit };
}

// AT-36: kebijakan konten retrieval — statis, tidak bisa diubah dari isi dokumen.
const CONTENT_POLICY: Record<string, boolean> = {
  retrieval_content_is_untrusted_data: true,
  content_cannot_change_policy: true,
  content_cannot_bypass_acl: true,
  content_cannot_trigger_tools: true,
  citations_from_db_only: true,
};

// Fase 4 slice-2 — AT-34: revoke/delete → retrieval-denied SEGERA (status revoked,
// terlihat di GET /api/knowledge/sources) + purge penuh TURUNAN dalam satu langkah:
// chunk dihapus dari index (knowledge_chunks), cache/hitungan ikut di-refresh
// (chunk_count=0), status purge tercatat (purge_status='purged' + purge_at).
// Data turunan yang menyimpan konten = hanya knowledge_chunks (satu-satunya indeks
// di backend minimal ini) → purge itu = purge turunan konten.
export function revokeSource(id: string): { revoked: boolean; purged: boolean; chunks_deleted: number; cache_invalidated: number } | Denial {
  const row = db.query("SELECT id, status FROM knowledge_sources WHERE id = ?").get(id) as
    | { id: string; status: string }
    | null;
  if (!row) return { status: 404, reason: "source_not_found" };
  const ts = now();
  db.run("DELETE FROM knowledge_chunks WHERE source_id = ?", [id]);
  const del = db.query("SELECT changes() AS n").get() as { n: number };
  db.run(
    "UPDATE knowledge_sources SET status = 'revoked', purge_status = 'purged', purge_at = ?, chunk_count = 0, updated_at = ? WHERE id = ?",
    [ts, ts, id]
  );
  // AT-CC-01 (plan AT-16): revoke → invalidate cache retrieval turunan SEKALIGUS — entri cache
  // dgn query apa pun yang menyimpan hit dari sumber ini tidak boleh dilayani lagi. Cache ini
  // menyimpan hasil per (scope,query) tanpa rujukan source per entri → invalidate SEMUA entri
  // (korben sempit, memori in-memory saja) supaya kebijakan cascade revoke aman-by-default.
  const cacheDropped = cacheInvalidateAll();
  insertEvent(null, "knowledge_revoked", {
    source_id: id,
    from: row.status,
    to: "revoked",
    purge: "full",
    chunks_deleted: del.n,
    cache_invalidated: cacheDropped,
    note: "AT-34: retrieval-denied segera + purge chunk/index/turunan; AT-CC-01: cache retrieval turunan ikut diinvalide",
  });
  return { revoked: true, purged: true, chunks_deleted: del.n, cache_invalidated: cacheDropped };
}

export function listSources(): unknown[] {
  return db
    .query("SELECT id, scope, path, status, source_sha256, chunk_count, purge_status, purge_at, created_at, updated_at FROM knowledge_sources ORDER BY created_at ASC")
    .all();
}
