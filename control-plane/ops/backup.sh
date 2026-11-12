#!/usr/bin/env bash
# ops/backup.sh — Fase 10 (task 58-b) — AT-BK-01/02 (plan AT-22: Pemulihan backup terisolasi).
#
# Mode:
#   bash ops/backup.sh [dest_dir]              → snapshot data/dhaheros.db + artifacts/ + knowledge/
#                                                ke backups/<ts>/ (atau dest_dir). Snapshot db via
#                                                bun:sqlite "VACUUM INTO" (mtime-safe — TIDAK
#                                                menyentuh db live / wal / shm; aman saat service
#                                                jalan). Fallback: cp db+wal+shm bila VACUUM gagal.
#   bash ops/backup.sh restore <backup_dir> <scratch_root>
#                                              → restore TERISOLASI ke scratch_root (BUKAN
#                                                overwrite data/ live): scratch_root/{data,artifacts,
#                                                knowledge}. Instance control plane kedua (port lain,
#                                                env DHOS_DATA_DIR/…) menjalankan db hasil restore
#                                                (pola nested AT-OS-07).
#
# Output backup dir:
#   backups/<ts>/dhaheros.db      — snapshot konsisten (single file, WAL ikut terkompak)
#   backups/<ts>/artifacts/       — salinan artifacts/<task_id>/*
#   backups/<ts>/knowledge/       — salinan knowledge/proj-*
#   backups/<ts>/manifest.json    — ts, db_bytes, counts (tasks/events/knowledge/artifacts),
#                                   artifact_task_ids — dipakai AT-BK-02 utk assert relasional.
# Exit non-zero bila snapshot/restore gagal.
set -u

ROOT="/home/z/my-project/dhaheros"
DB="$ROOT/data/dhaheros.db"
BK_ROOT="$ROOT/backups"

mkdir -p "$BK_ROOT"

mode="${1:-backup}"

if [ "$mode" = "restore" ]; then
  BK_DIR="${2:-}"
  SCRATCH="${3:-}"
  if [ -z "$BK_DIR" ] || [ -z "$SCRATCH" ] || [ ! -d "$BK_DIR" ] || [ ! -f "$BK_DIR/dhaheros.db" ]; then
    echo "backup.sh restore: backup_dir tidak valid: '$BK_DIR' (butuh dhaheros.db di dalamnya)"
    exit 1
  fi
  if [ -e "$SCRATCH" ]; then
    echo "backup.sh restore: scratch_root sudah ada — tolak (restore terisolasi, jangan overwrite): $SCRATCH"
    exit 1
  fi
  mkdir -p "$SCRATCH/data" "$SCRATCH/artifacts" "$SCRATCH/knowledge"
  cp "$BK_DIR/dhaheros.db" "$SCRATCH/data/dhaheros.db"
  [ -d "$BK_DIR/artifacts" ] && cp -a "$BK_DIR/artifacts/." "$SCRATCH/artifacts/" || true
  [ -d "$BK_DIR/knowledge" ] && cp -a "$BK_DIR/knowledge/." "$SCRATCH/knowledge/" || true
  [ -f "$BK_DIR/manifest.json" ] && cp "$BK_DIR/manifest.json" "$SCRATCH/manifest.json" || true
  SIZE=$(stat -c %s "$SCRATCH/data/dhaheros.db" 2>/dev/null || echo 0)
  if [ "$SIZE" -le 0 ]; then
    echo "backup.sh restore: db hasil restore kosong/tidak ada — gagal"
    exit 1
  fi
  echo "backup.sh restore: OK — $BK_DIR → $SCRATCH (db=$SIZE bytes; live data/ TIDAK disentuh)"
  exit 0
fi

# ---------- mode backup ----------
TS=$(date -u +%Y%m%dT%H%M%SZ)
DEST="${1:-$BK_ROOT/$TS}"
mkdir -p "$DEST"

# 1) db snapshot mtime-safe via bun:sqlite VACUUM INTO (sqlite3 CLI mungkin tak ada).
DB_OUT="$DEST/dhaheros.db"
rm -f "$DB_OUT"
SNAP_METHOD="none"
if DHOS_DB_SRC="$DB" DHOS_DB_DST="$DB_OUT" bun -e '
const { Database } = require("bun:sqlite");
const s = new Database(process.env.DHOS_DB_SRC);
s.exec("VACUUM INTO ?1", [process.env.DHOS_DB_DST]);
s.close();
' >/dev/null 2>&1 && [ -f "$DB_OUT" ] && [ "$(stat -c %s "$DB_OUT")" -gt 0 ]; then
  SNAP_METHOD="vacuum_into"
else
  # fallback: copy mentah saat idle (db + wal + shm) — masih baca-saja thd live (tidak menulis).
  cp "$DB" "$DB_OUT"
  [ -f "$DB-wal" ] && cp "$DB-wal" "$DB_OUT-wal" || true
  [ -f "$DB-shm" ] && cp "$DB-shm" "$DB_OUT-shm" || true
  SNAP_METHOD="cp_raw"
fi

# 2) artifacts + knowledge (salinan penuh; deny jika sumber hilang → backup gagal).
if [ -d "$ROOT/artifacts" ]; then
  cp -a "$ROOT/artifacts/." "$DEST/artifacts/" || { echo "backup: gagal copy artifacts"; exit 1; }
else
  mkdir -p "$DEST/artifacts"
fi
if [ -d "$ROOT/knowledge" ]; then
  cp -a "$ROOT/knowledge/." "$DEST/knowledge/" || { echo "backup: gagal copy knowledge"; exit 1; }
else
  mkdir -p "$DEST/knowledge"
fi

# 3) manifest — hitungan relasional sumber (db live, read-only) utk assert restore (AT-BK-02).
DB="$DB" DEST="$DEST" SNAP_METHOD="$SNAP_METHOD" TS="$TS" python3 - <<'PY'
import sqlite3, os, json
db = os.environ["DB"]; dest = os.environ["DEST"]
c = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
counts = {
    "tasks": c.execute("SELECT COUNT(*) FROM tasks").fetchone()[0],
    "events": c.execute("SELECT COUNT(*) FROM events").fetchone()[0],
    "knowledge_sources": c.execute("SELECT COUNT(*) FROM knowledge_sources").fetchone()[0],
    "knowledge_chunks": c.execute("SELECT COUNT(*) FROM knowledge_chunks").fetchone()[0],
    "artifact_task_ids": sorted(r[0] for r in c.execute(
        "SELECT DISTINCT t.id FROM tasks t WHERE EXISTS (SELECT 1 FROM events e WHERE e.task_id = t.id AND e.type='artifacts_written')")),
}
manifest = {
    "ts": os.environ["TS"],
    "source_db": db,
    "snapshot_method": os.environ["SNAP_METHOD"],
    "counts": counts,
}
with open(os.path.join(dest, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=2)
print(json.dumps(manifest))
PY

DB_SIZE=$(stat -c %s "$DB_OUT" 2>/dev/null || echo 0)
if [ "$DB_SIZE" -le 0 ]; then
  echo "backup: snapshot db kosong — gagal"
  exit 1
fi
echo "backup: OK — $DEST (db=$DB_SIZE bytes, method=$SNAP_METHOD, artifacts=$(find "$DEST/artifacts" -type f 2>/dev/null | wc -l) files, knowledge=$(find "$DEST/knowledge" -type f 2>/dev/null | wc -l) files)"
