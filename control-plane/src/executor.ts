// DhaherOS control plane — executor (Bun.spawn, cwd=workspace, artifacts, timeout, cancel)
// AT-03: timeout → kill + failed (bukan sukses). AT-04: cancel → cancelled/uncertain.
// AT-09: child env BERSIH (PATH/HOME saja) — secret di env parent tidak diwarisi proses task.
// Slice-2 (AT-12 penuh): budget runtime kumulatif per task — timer budget menghentikan proses
// dgn alasan budget_exhausted; runtime tiap attempt diakumulasi (task + global).
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { ARTIFACTS_ROOT } from "./paths";
import { getTask, insertEvent, transitionTo, addRuntime, TaskRow } from "./db";
import { adapterForTask, RuntimeAdapter } from "./adapters";

interface RunHandle {
  proc: ReturnType<typeof Bun.spawn>;
  cancelRequested: boolean;
  timedOut: boolean;
}

const runs = new Map<string, RunHandle>();
const CANCEL_GRACE_MS = 3000;

export function artifactsDir(taskId: string): string {
  return path.join(ARTIFACTS_ROOT, taskId);
}

export function listArtifacts(taskId: string): string[] {
  const dir = artifactsDir(taskId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort();
}

function childEnv(workspace: string): Record<string, string> {
  // Sengaja minimal: TIDAK mewarisi env proses kontrol (mencegah kebocoran secret, AT-09).
  return { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: workspace };
}

// Kill seluruh process group (setsid menjadikan child session leader) —
// memastikan child/grandchild (mis. sleep) ikut berhenti, bukan hanya shell-nya.
function killProc(handle: RunHandle, sig: "SIGTERM" | "SIGKILL"): void {
  try {
    process.kill(-handle.proc.pid, sig);
  } catch {
    try {
      handle.proc.kill(sig);
    } catch {
      /* proses sudah mati */
    }
  }
}

export async function runTask(id: string): Promise<void> {
  const t: TaskRow | null = getTask(id);
  if (!t) return;
  const dir = artifactsDir(id);
  mkdirSync(dir, { recursive: true });
  const startedAt = Date.now();

  // Fase 3: adapter runtime berversi — versi dideteksi dari binari, bukan diklaim.
  const adapter: RuntimeAdapter = adapterForTask(t.runtime);

  if (!transitionTo(id, "running", "task_running", { executor: "bun.spawn", cwd: t.workspace, runtime: adapter.name, runtime_version: adapter.version })) {
    return; // transisi ditolak state machine — jangan paksa
  }

  let proc: ReturnType<typeof Bun.spawn>;
  try {
    // CATATAN runtime (Bun 1.3.14): membaca stdout/stderr "pipe" + kill() membuat proc.exited
    // menggantung (bug pipe Bun). Solusi: tangkap output via redirect shell ke file artefak
    // (exec >stdout.txt 2>stderr.txt) — bukti tetap lengkap, tanpa deadlock, tanpa sukses palsu.
    // Fase 3: wrapper mengekspor DHOS_RUNTIME + DHOS_RUNTIME_VERSION agar versi runtime
    // ikut tercatat di artefak (stdout task yang memakainya) — bukan hanya di event.
    const scriptPath = path.join(dir, "task_command.sh");
    writeFileSync(
      scriptPath,
      `exec >'${dir}/stdout.txt' 2>'${dir}/stderr.txt'\nexport DHOS_RUNTIME='${adapter.name}'\nexport DHOS_RUNTIME_VERSION='${adapter.version}'\n${t.command}\n`,
      { mode: 0o600 }
    );
    proc = Bun.spawn(["/usr/bin/setsid", "/bin/sh", scriptPath], {
      cwd: t.workspace,
      env: childEnv(t.workspace),
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });
  } catch (e) {
    transitionTo(id, "failed", "task_failed", { reason: "spawn_error", detail: String(e) });
    return;
  }

  const handle: RunHandle = { proc, cancelRequested: false, timedOut: false };
  runs.set(id, handle);
  insertEvent(id, "task_started", { pid: proc.pid, timeout_sec: t.timeout_sec, wrapper: "exec-redirect-to-artifacts", runtime: adapter.name, runtime_bin: adapter.bin, runtime_version: adapter.version });

  const timer = setTimeout(() => {
    handle.timedOut = true;
    killProc(handle, "SIGKILL");
  }, t.timeout_sec * 1000);

  // Budget per task (AT-12 penuh): sisa budget = budget_sec*1000 - runtime attempt sebelumnya.
  // Habis di tengah jalan → kill + failed (bukan sukses), alasan budget_exhausted.
  let budgetStopped = false;
  let budgetTimer: ReturnType<typeof setTimeout> | null = null;
  const budgetMs = (t.budget_sec ?? 0) * 1000;
  const usedBefore = t.runtime_used_ms ?? 0;
  if (budgetMs > 0) {
    const remainingMs = budgetMs - usedBefore;
    if (remainingMs <= 0) {
      // Guard: endpoint retry/reconcile seharusnya sudah menolak; jika lolos, hentikan segera.
      budgetStopped = true;
      killProc(handle, "SIGKILL");
    } else {
      budgetTimer = setTimeout(() => {
        budgetStopped = true;
        killProc(handle, "SIGKILL");
      }, remainingMs);
    }
  }

  const exitCode = await proc.exited;
  clearTimeout(timer);
  if (budgetTimer) clearTimeout(budgetTimer);
  runs.delete(id);
  addRuntime(id, Date.now() - startedAt); // akumulasi budget per task + global (append)

  const stdout = existsSync(path.join(dir, "stdout.txt"))
    ? readFileSync(path.join(dir, "stdout.txt"), "utf8")
    : "";
  const stderr = existsSync(path.join(dir, "stderr.txt"))
    ? readFileSync(path.join(dir, "stderr.txt"), "utf8")
    : "";
  const durationMs = Date.now() - startedAt;

  // Keputusan state: klaim selalu konsisten dengan bukti (AT-03/AT-07).
  let nextState: string;
  let evType: string;
  let reason: string;
  if (handle.timedOut) {
    nextState = "failed";
    evType = "task_failed";
    reason = `timeout_exceeded (>${t.timeout_sec}s) → proses di-kill`;
  } else if (budgetStopped) {
    nextState = "failed";
    evType = "task_failed";
    reason = `budget_exhausted: runtime kumulatif ${(usedBefore + durationMs) / 1000}s >= budget ${t.budget_sec}s (AT-12) → proses di-kill`;
  } else if (handle.cancelRequested) {
    nextState = "cancelled";
    evType = "task_cancelled";
    reason = "cancel dikonfirmasi: proses berakhir setelah sinyal cancel";
  } else if (exitCode === 0) {
    nextState = "succeeded";
    evType = "task_succeeded";
    reason = "exit_code=0";
  } else {
    nextState = "failed";
    evType = "task_failed";
    reason = `exit_code=${exitCode}`;
  }

  const meta = {
    task_id: id,
    command: t.command,
    workspace: t.workspace,
    runtime: adapter.name,
    runtime_version: adapter.version,
    exit_code: exitCode,
    timed_out: handle.timedOut,
    cancel_requested: handle.cancelRequested,
    duration_ms: durationMs,
    state: nextState,
    reason,
    finished_at: new Date().toISOString(),
  };
  writeFileSync(
    path.join(dir, "meta.json"),
    JSON.stringify({ ...meta, stdout_bytes: stdout.length, stderr_bytes: stderr.length }, null, 2)
  );

  const ok = transitionTo(id, nextState, evType, {
    reason,
    exit_code: exitCode,
    timed_out: handle.timedOut,
    budget_stopped: budgetStopped,
    duration_ms: durationMs,
    runtime: adapter.name,
    runtime_version: adapter.version,
  });
  insertEvent(id, "artifacts_written", {
    dir,
    files: ["task_command.sh", "stdout.txt", "stderr.txt", "meta.json"],
    state_after: nextState,
  });
  if (!ok) {
    // contoh: task sudah uncertain (cancel tak terkonfirmasi) lalu proses selesai —
    // state TIDAK diubah (transisi invalid ditolak); bukti tetap tersimpan.
    insertEvent(id, "artifacts_written_state_mismatch", {
      note: "proses berakhir setelah state terminal/uncertain; state tidak diubah",
      intended_state: nextState,
    });
  }
}

export function requestCancel(id: string): { status: number; body: Record<string, unknown> } {
  const t = getTask(id);
  if (!t) return { status: 404, body: { error: "task tidak ditemukan" } };

  if (t.state === "planned") {
    const ok = transitionTo(id, "cancelled", "task_cancelled", {
      reason: "cancel sebelum eksekusi dimulai",
    });
    return ok
      ? { status: 200, body: { task: getTask(id) } }
      : { status: 409, body: { error: "transisi ditolak state machine" } };
  }

  if (t.state === "running") {
    insertEvent(id, "task_cancel_requested", { state: "running" });
    const r = runs.get(id);
    if (!r) {
      // handle proses hilang (kasus luar biasa) → jangan klaim apa pun: uncertain (AT-04)
      transitionTo(id, "uncertain", "task_uncertain", {
        reason: "cancel diminta tetapi process handle tidak ada; butuh rekonsiliasi",
      });
      return { status: 202, body: { accepted: true, note: "uncertain (rekonsiliasi)" } };
    }
    r.cancelRequested = true;
    killProc(r, "SIGTERM");
    // Grace: jika tidak terkonfirmasi berhenti → uncertain (AT-04), bukan sukses palsu.
    setTimeout(() => {
      const r2 = runs.get(id);
      if (!r2) return; // runTask sudah mengonfirmasi exit → cancelled
      killProc(r2, "SIGKILL");
      setTimeout(() => {
        if (runs.has(id)) {
          transitionTo(id, "uncertain", "task_uncertain", {
            reason: "cancel tidak terkonfirmasi dalam grace period; butuh rekonsiliasi",
          });
        }
      }, CANCEL_GRACE_MS);
    }, CANCEL_GRACE_MS);
    return {
      status: 202,
      body: { accepted: true, note: "cancel dikirim; konfirmasi menunggu proses berakhir" },
    };
  }

  // State terminal/uncertain: cancel = transisi invalid → 409 + event transition_denied
  // (bukti audit bahwa percobaan transisi via API ditolak state machine).
  insertEvent(id, "transition_denied", {
    from: t.state,
    to: "cancelled",
    attempted_type: "task_cancelled",
    reason: `cancel ditolak: state=${t.state} tidak boleh dibatalkan (state machine)`,
  });
  return {
    status: 409,
    body: { error: `cancel ditolak: state=${t.state} tidak boleh dibatalkan (state machine)` },
  };
}
