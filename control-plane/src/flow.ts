// DhaherOS — Fase 2: alur executor nyata (flow runner CLI)
// Usage: bun src/flow.ts <flow.json> <workspace> <outdir>
//   flow.json: { "name": string, "timeout_sec"?: number, "steps": [{ "name": string, "command": string }] }
// Semantik:
//   - step dieksekusi BERURUTAN di workspace (cwd=workspace); stdout/stderr tiap step
//     diarahkan ke artefak <outdir>/steps/<nn>-<name>/{stdout.txt,stderr.txt} (workaround
//     bug pipe Bun 1.3.14 — pola sama dengan control plane executor).
//   - step gagal (exit != 0 / timeout / spawn error) MENGHENTIKAN alur; sisa step = skipped;
//     tidak ada sukses palsu.
//   - snapshot workspace (manifest rel-path+sha256+size) sebelum & sesudah → diff akurat
//     (added/modified/deleted) hanya dari perubahan step.
//   - laporan <outdir>/report.json: status tiap step + diff + final_status + reason.
// Exit: 0 = semua step tereksekusi sukses; 1 = ada step gagal; 2 = flow.json/argumen invalid.
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";

interface Step { name: string; command: string }
interface FlowSpec { name: string; timeout_sec?: number; steps: Step[] }
interface Manifest { [rel: string]: { sha256: string; size: number } }
interface StepResult {
  name: string; index: number; status: "succeeded" | "failed" | "skipped";
  exit_code: number | null; timed_out: boolean; duration_ms: number; reason?: string;
}
interface Diff { added: string[]; modified: string[]; deleted: string[] }

const MAX_TIMEOUT = 600; // konsisten dgn stop cap AT-12

function die(msg: string): never {
  console.error(`[flow] INVALID: ${msg}`);
  process.exit(2);
}

// ---- argumen ----
const [, , flowPath, wsDir, outDir] = process.argv;
if (!flowPath || !wsDir || !outDir) die("usage: bun src/flow.ts <flow.json> <workspace> <outdir>");
if (!existsSync(flowPath) || !statSync(flowPath).isFile()) die(`flow.json tidak ada: ${flowPath}`);
if (!existsSync(wsDir) || !statSync(wsDir).isDirectory()) die(`workspace tidak ada: ${wsDir}`);

let spec: FlowSpec;
try {
  spec = JSON.parse(readFileSync(flowPath, "utf8")) as FlowSpec;
} catch (e) {
  die(`flow.json bukan JSON valid: ${e}`);
}
if (!spec.name || typeof spec.name !== "string") die("field 'name' wajib (string)");
if (!Array.isArray(spec.steps) || spec.steps.length === 0) die("field 'steps' wajib array tak-kosong");
const stepTimeout = spec.timeout_sec === undefined ? 60 : spec.timeout_sec;
if (!Number.isInteger(stepTimeout) || stepTimeout < 1 || stepTimeout > MAX_TIMEOUT) {
  die(`timeout_sec harus integer 1..${MAX_TIMEOUT}`);
}
const seen = new Set<string>();
for (const s of spec.steps) {
  if (!s || typeof s.name !== "string" || !s.name.trim()) die("tiap step butuh 'name' (string)");
  if (typeof s.command !== "string" || !s.command.trim()) die(`step '${s.name}' butuh 'command' (string)`);
  if (seen.has(s.name)) die(`nama step duplikat: ${s.name}`);
  seen.add(s.name);
}

// ---- manifest & diff ----
const OUT_ABS = path.resolve(outDir);
function walk(dir: string, base: string = dir, acc: Manifest = {}): Manifest {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path.resolve(full) === OUT_ABS) continue; // artefak laporan flow bukan konten workspace — exclude dari snapshot/diff
      walk(full, base, acc);
    }
    else if (entry.isFile()) {
      const buf = readFileSync(full);
      acc[path.relative(base, full)] = { sha256: createHash("sha256").update(buf).digest("hex"), size: buf.length };
    }
  }
  return acc;
}

function diffManifests(before: Manifest, after: Manifest): Diff {
  const d: Diff = { added: [], modified: [], deleted: [] };
  for (const k of Object.keys(after)) {
    if (!(k in before)) d.added.push(k);
    else if (before[k].sha256 !== after[k].sha256) d.modified.push(k);
  }
  for (const k of Object.keys(before)) if (!(k in after)) d.deleted.push(k);
  for (const arr of [d.added, d.modified, d.deleted]) arr.sort();
  return d;
}

// ---- step runner (setsid + exec-redirect, group-kill saat timeout) ----
function childEnv(): Record<string, string> {
  // env bersih (AT-09): PATH/HOME saja — konsisten dgn control plane executor.
  return { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: wsDir };
}

function killGroup(pid: number, sig: "SIGTERM" | "SIGKILL"): void {
  try { process.kill(-pid, sig); } catch { /* sudah mati */ }
}

async function runStep(step: Step, idx: number): Promise<StepResult> {
  const stepDir = path.join(outDir, "steps", `${String(idx).padStart(2, "0")}-${step.name.replace(/[^A-Za-z0-9._-]/g, "_")}`);
  mkdirSync(stepDir, { recursive: true });
  const startedAt = Date.now();
  const scriptPath = path.join(stepDir, "step_command.sh");
  writeFileSync(
    scriptPath,
    `exec >'${stepDir}/stdout.txt' 2>'${stepDir}/stderr.txt'\ncd '${wsDir}'\n${step.command}\n`,
    { mode: 0o600 }
  );
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(["/usr/bin/setsid", "/bin/sh", scriptPath], {
      cwd: wsDir, env: childEnv(), stdout: "ignore", stderr: "ignore", stdin: "ignore",
    });
  } catch (e) {
    return { name: step.name, index: idx, status: "failed", exit_code: null, timed_out: false, duration_ms: Date.now() - startedAt, reason: `spawn_error: ${e}` };
  }
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; killGroup(proc.pid, "SIGKILL"); }, stepTimeout * 1000);
  const exitCode = await proc.exited;
  clearTimeout(timer);
  const duration_ms = Date.now() - startedAt;
  if (timedOut) return { name: step.name, index: idx, status: "failed", exit_code: exitCode, timed_out: true, duration_ms, reason: `timeout_exceeded (>${stepTimeout}s)` };
  if (exitCode === 0) return { name: step.name, index: idx, status: "succeeded", exit_code: 0, timed_out: false, duration_ms };
  return { name: step.name, index: idx, status: "failed", exit_code: exitCode, timed_out: false, duration_ms, reason: `exit_code=${exitCode}` };
}

// ---- eksekusi alur ----
mkdirSync(outDir, { recursive: true });
mkdirSync(path.join(outDir, "steps"), { recursive: true });
const startedIso = new Date().toISOString();
const before = walk(wsDir);

const results: StepResult[] = [];
let stopReason: string | null = null;
for (let i = 0; i < spec.steps.length; i++) {
  const r = await runStep(spec.steps[i], i);
  results.push(r);
  console.log(`[flow] step ${i + 1}/${spec.steps.length} '${r.name}' → ${r.status}${r.reason ? ` (${r.reason})` : ""} (${r.duration_ms}ms)`);
  if (r.status === "failed") {
    stopReason = `step ${i + 1} '${r.name}' gagal: ${r.reason} — sisa ${spec.steps.length - i - 1} step di-skip`;
    for (let j = i + 1; j < spec.steps.length; j++) {
      results.push({ name: spec.steps[j].name, index: j, status: "skipped", exit_code: null, timed_out: false, duration_ms: 0, reason: "flow dihentikan oleh step gagal sebelumnya" });
    }
    break;
  }
}

const after = walk(wsDir);
const diff = diffManifests(before, after);
const executed = results.filter((r) => r.status !== "skipped");
const finalStatus = stopReason === null ? "succeeded" : "failed";
const finishedIso = new Date().toISOString();

const report = {
  flow: spec.name,
  workspace: wsDir,
  started_at: startedIso,
  finished_at: finishedIso,
  final_status: finalStatus,
  reason: stopReason ?? "semua step sukses",
  steps_total: spec.steps.length,
  steps: results,
  diff,
  timeout_sec_per_step: stepTimeout,
};
const reportPath = path.join(outDir, "report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`[flow] ${spec.name} final=${finalStatus} steps=${executed.filter((r) => r.status === "succeeded").length}/${spec.steps.length} ok | diff +${diff.added.length} ~${diff.modified.length} -${diff.deleted.length} | report=${reportPath}`);
process.exit(stopReason === null ? 0 : 1);
