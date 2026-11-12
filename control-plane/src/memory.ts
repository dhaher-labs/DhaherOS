// Fase 4 RAG gap (run-33 Track 3) — Memory lifecycle layer.
//
// Plan §9 + AT-38 ("Memory user-authored/approved terpisah dari ringkasan agent-derived;
// sumber/waktu/versi/lifecycle bisa dilihat dan revoke/delete tidak meninggalkan memory
// turunan yang masih dapat diretrieval"). Backend minimal SQLite — fitur lengkap OPEN.
//
// Tabel memory_records:
//   id PK, scope, label (user-authored|agent-derived|approved), subject (pembuat),
//   content, source_ref (nullable — link ke knowledge_source_id bila derived),
//   created_at, updated_at, status (active|revoked), revoked_at (nullable).
//
// Pemisahan source-of-truth:
//   - user-authored / approved → memory MANUSIA; tidak butuh source_ref.
//   - agent-derived            → ringkasan turunan WAJIB menyandikan source_ref (provenance).
//                                tanpa source_ref → ditolak 400 + event memory_denied.
//
// Lifecycle:
//   - revokeMemory(id) → status=revoked + revoked_at=now; retrieval SEGERA denied.
//   - searchMemory/getMemory/listMemory tidak pernah mengembalikan record revoked
//     (AT-38: tidak meninggalkan memory turunan yang masih dapat diretrieval).
//
// Kebijakan konten (konsisten dgn knowledge.ts AT-36):
//   - hasil search dgn label=agent-derived ditandai untrusted:true (data turunan tak tepercaya).
//   - content_policy statis di response — tidak bisa diubah oleh isi content.
//
// Capability: tidak ada gate capability di route /api/memory/* (mengikuti pola
// /api/knowledge/* — server-side internal API, deny-by-default via validasi input +
// provenance). Pemilik dapat menambah gate capability memory.write/memory.read kemudian
// (OPEN — saat ini reuse knowledge.ingest/knowledge.search di org.ts CAPABILITIES sudah
// cukup untuk integrasi workflow; tidak menyentuh org.ts demi hindari konflik track paralel).
import { db, insertEvent } from "./db";

db.exec(`
CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_memory_scope ON memory_records(scope);
CREATE INDEX IF NOT EXISTS idx_memory_scope_label ON memory_records(scope, label);
CREATE INDEX IF NOT EXISTS idx_memory_status ON memory_records(status);
`);

const now = () => new Date().toISOString();

export const MEMORY_LABELS = ["user-authored", "agent-derived", "approved"] as const;
export type MemoryLabel = (typeof MEMORY_LABELS)[number];

export interface Denial {
  status: number;
  reason: string;
  detail?: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  scope: string;
  label: string;
  subject: string;
  content: string;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  revoked_at: string | null;
}

export interface MemoryHit {
  id: string;
  scope: string;
  label: string;
  subject: string;
  content: string;
  source_ref: string | null;
  created_at: string;
  untrusted: boolean; // true bila label=agent-derived (data turunan tak tepercaya)
}

export interface MemorySearchResult {
  found: boolean;
  results: MemoryHit[];
  content_policy: Record<string, boolean>;
}

// Kebijakan konten statis — konsisten dgn knowledge.ts (AT-36). Tidak bisa diubah
// dari isi content.
const CONTENT_POLICY: Record<string, boolean> = {
  retrieval_content_is_untrusted_data: true,
  content_cannot_change_policy: true,
  content_cannot_bypass_lifecycle: true,
  content_cannot_trigger_tools: true,
  citations_from_db_only: true,
  revoked_memory_never_retrievable: true, // AT-38
};

function isLabel(v: unknown): v is MemoryLabel {
  return typeof v === "string" && (MEMORY_LABELS as readonly string[]).includes(v);
}

// createMemory — label WAJIB salah satu dari 3 enum. agent-derived WAJIB source_ref
// (provenance). Record baru selalu status=active. Emits memory_created (atau
// memory_denied bila ditolak).
export function createMemory(
  scope: string,
  label: string,
  subject: string,
  content: string,
  sourceRef?: string | null
): MemoryRecord | Denial {
  if (typeof scope !== "string" || !scope.trim()) {
    return { status: 400, reason: "scope_wajib" };
  }
  if (!isLabel(label)) {
    insertEvent(null, "memory_denied", {
      reason: "invalid_label",
      scope,
      subject: typeof subject === "string" ? subject : "",
      allowed: [...MEMORY_LABELS],
      note: "label memory harus salah satu: user-authored | agent-derived | approved",
    });
    return { status: 400, reason: "invalid_label", detail: { allowed: [...MEMORY_LABELS] } };
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return { status: 400, reason: "subject_wajib" };
  }
  if (typeof content !== "string" || !content.trim()) {
    return { status: 400, reason: "content_wajib" };
  }
  // AT-38 / provenance: agent-derived WAJIB menyandikan source_ref (link ke
  // knowledge_source_id). Tanpa source_ref → ditolak + event memory_denied.
  const srcRef = typeof sourceRef === "string" && sourceRef.trim() ? sourceRef.trim() : null;
  if (label === "agent-derived" && !srcRef) {
    insertEvent(null, "memory_denied", {
      reason: "provenance_required",
      scope,
      subject,
      label,
      note: "agent-derived memory wajib source_ref (provenance); tanpa source_ref = ditolak (AT-38)",
    });
    return { status: 400, reason: "provenance_required", detail: { label } };
  }

  const id = crypto.randomUUID();
  const ts = now();
  db.run(
    `INSERT INTO memory_records (id, scope, label, subject, content, source_ref, created_at, updated_at, status, revoked_at)
     VALUES (?,?,?,?,?,?,?,?,'active',NULL)`,
    [id, scope.trim(), label, subject.trim(), content, srcRef, ts, ts]
  );
  insertEvent(null, "memory_created", {
    id,
    scope: scope.trim(),
    label,
    subject: subject.trim(),
    content_len: content.length,
    source_ref: srcRef,
    status: "active",
    note: "AT-38: memory lifecycle — record aktif; provenance/source_ref tersandi bila agent-derived",
  });
  return getMemory(id) as MemoryRecord;
}

// listMemory — by scope, optional label filter. NEVER returns revoked.
export function listMemory(
  scope: string,
  filter?: { label?: string }
): MemoryRecord[] | Denial {
  if (typeof scope !== "string" || !scope.trim()) {
    return { status: 400, reason: "scope_wajib" };
  }
  if (filter?.label !== undefined && !isLabel(filter.label)) {
    return { status: 400, reason: "invalid_label", detail: { allowed: [...MEMORY_LABELS] } };
  }
  const rows = filter?.label
    ? (db
        .query(
          `SELECT id, scope, label, subject, content, source_ref, created_at, updated_at, status, revoked_at
           FROM memory_records
           WHERE scope = ? AND label = ? AND status = 'active'
           ORDER BY created_at ASC`
        )
        .all(scope.trim(), filter.label) as MemoryRecord[])
    : (db
        .query(
          `SELECT id, scope, label, subject, content, source_ref, created_at, updated_at, status, revoked_at
           FROM memory_records
           WHERE scope = ? AND status = 'active'
           ORDER BY created_at ASC`
        )
        .all(scope.trim()) as MemoryRecord[]);
  return rows;
}

// getMemory — single record. Revoked → null (retrieval denied — AT-38).
export function getMemory(id: string): MemoryRecord | null {
  const row = db
    .query(
      `SELECT id, scope, label, subject, content, source_ref, created_at, updated_at, status, revoked_at
       FROM memory_records WHERE id = ?`
    )
    .get(id) as MemoryRecord | null;
  if (!row) return null;
  if (row.status === "revoked") return null; // AT-38: revoked tidak dapat diretrieval
  return row;
}

// revokeMemory — status=revoked + revoked_at=now. Emits memory_revoked.
// Setelah revoke: getMemory → null, listMemory → exclude, searchMemory → exclude
// (AT-38: tidak meninggalkan memory turunan yang masih dapat diretrieval).
export function revokeMemory(id: string): { revoked: boolean; id: string } | Denial {
  const row = db
    .query("SELECT id, status FROM memory_records WHERE id = ?")
    .get(id) as { id: string; status: string } | null;
  if (!row) return { status: 404, reason: "memory_not_found" };
  const ts = now();
  db.run(
    "UPDATE memory_records SET status = 'revoked', revoked_at = ?, updated_at = ? WHERE id = ?",
    [ts, ts, id]
  );
  insertEvent(null, "memory_revoked", {
    id,
    from: row.status,
    to: "revoked",
    revoked_at: ts,
    note: "AT-38: revoke → retrieval denied segera (getMemory/listMemory/searchMemory exclude); tidak meninggalkan memory turunan yang dapat diretrieval",
  });
  return { revoked: true, id };
}

// searchMemory — LIKE search, excludes revoked. agent-derived hits → untrusted:true.
// Konsisten dgn knowledge.ts CONTENT_POLICY (AT-36).
export function searchMemory(scope: string, query: string): MemorySearchResult | Denial {
  if (typeof scope !== "string" || !scope.trim()) return { status: 400, reason: "scope_wajib" };
  if (typeof query !== "string" || !query.trim()) return { status: 400, reason: "query_wajib" };
  // Filter scope + status=active (revoked NEVER terambil — AT-38 titik tunggal di SQL).
  const rows = db
    .query(
      `SELECT id, scope, label, subject, content, source_ref, created_at
       FROM memory_records
       WHERE scope = ? AND status = 'active'
         AND instr(lower(content), lower(?)) > 0
       ORDER BY created_at ASC LIMIT 20`
    )
    .all(scope.trim(), query) as (Omit<MemoryHit, "untrusted">)[];

  const hits: MemoryHit[] = rows.map((r) => ({
    ...r,
    untrusted: r.label === "agent-derived",
  }));

  insertEvent(null, "memory_query", {
    scope: scope.trim(),
    query_len: query.length,
    hit_count: hits.length,
    untrusted_count: hits.filter((h) => h.untrusted).length,
    note: "query tidak disimpan utuh (hanya panjang); revoked memory selalu dikecualikan",
  });

  if (hits.length === 0) {
    return { found: false, results: [], content_policy: CONTENT_POLICY };
  }
  return { found: true, results: hits, content_policy: CONTENT_POLICY };
}
