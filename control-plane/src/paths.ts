// DhaherOS control plane — path policy & konstanta (slice-2)
// Deny-by-default: command yang menunjuk path di luar workspace task ditolak (AT-05/AT-06).
import path from "node:path";

export const ROOT = "/home/z/my-project/dhaheros";
export const WS_ROOT = `${ROOT}/workspaces`;
// Fase 10 (task 58-b, AT-BK-02/AT-DE-01): root data/artifacts/knowledge bisa dioverride
// via env utk INSTANCE SCRATCH (restore backup / uji health degraded) yang berjalan di
// port lain — instance utama TETAP memakai default di bawah ROOT (perilaku lama utuh).
export const DATA_DIR = process.env.DHOS_DATA_DIR
  ? path.resolve(process.env.DHOS_DATA_DIR)
  : `${ROOT}/data`;
export const ARTIFACTS_ROOT = process.env.DHOS_ARTIFACTS_ROOT
  ? path.resolve(process.env.DHOS_ARTIFACTS_ROOT)
  : `${ROOT}/artifacts`;
// Fase 4 (AT-32): root knowledge — sumber yang boleh di-ingest HANYA file di bawah ini
// (deny-by-default, sama pola dgn WS_ROOT).
export const KNOWLEDGE_ROOT = process.env.DHOS_KNOWLEDGE_ROOT
  ? path.resolve(process.env.DHOS_KNOWLEDGE_ROOT)
  : `${ROOT}/knowledge`;
// Port default 3031 (hardcoded sesuai mandat slice-1); override DHOS_PORT hanya utk
// instance scratch ter-audit (AT-BK-02 restore, AT-DE-01 degraded) — tanpa env, nol perubahan.
const envPort = Number(process.env.DHOS_PORT);
export const PORT = Number.isFinite(envPort) && envPort > 0 && process.env.DHOS_PORT ? envPort : 3031;

export const DEFAULT_TIMEOUT = 60;
export const MAX_TIMEOUT = 600; // stop cap AT-12 (per attempt)
export const MAX_BUDGET_SEC = 86400; // cap budget runtime kumulatif per task (AT-12 penuh)
// Budget global (AT-12 penuh): total wall-clock semua task sejak db dibuat. Override via env
// DHOS_GLOBAL_BUDGET_SEC (dipakai verify utk kasus terukur); default 7200s.
const envG = Number(process.env.DHOS_GLOBAL_BUDGET_SEC);
export const GLOBAL_BUDGET_SEC = Number.isFinite(envG) && envG > 0 ? envG : 7200;

export function isInside(child: string, parent: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Deteksi pelanggaran path pada command string.
// 1) kandidat absolute path (substring "/...") harus berada di dalam workspace;
// 2) token yang mengandung ".." (traversal) harus resolve di dalam workspace;
// 3) token yang diawali "~" (home expansion) ditolak.
// Ini heuristic deny-by-default untuk slice-1; dokumentasi batas ada di ASSET_AUDIT/EVIDENCE.
export function commandPathViolations(command: string, workspace: string): string[] {
  const violations: string[] = [];
  const ws = path.resolve(workspace);
  const push = (raw: string) => {
    if (!violations.includes(raw)) violations.push(raw);
  };

  // 1) absolute path candidates di mana pun dalam string (menangkap "echo x>/tmp/y", "2>/dev/null", dsb.)
  const absRe = /\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*/g;
  for (const m of command.matchAll(absRe)) {
    const resolved = path.normalize(m[0]);
    if (!isInside(resolved, ws)) push(m[0]);
  }

  // 2) traversal ".."
  for (const tokRaw of command.split(/\s+/)) {
    const tok = tokRaw.replace(/^(?:\d*>|>>|>|<|2>>|&>)+/, "").replace(/^["']+|["']+$/g, "");
    if (!tok) continue;
    if (tok.startsWith("~")) {
      push(tokRaw);
      continue;
    }
    if (tok.includes("..")) {
      const resolved = path.normalize(path.join(ws, tok));
      if (!isInside(resolved, ws)) push(tokRaw);
    }
  }

  return violations;
}
