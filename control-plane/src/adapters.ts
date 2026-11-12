// Fase 3 (AT-41): runtime adapter berversi — task dieksekusi lewat runtime eksplisit.
// Versi runtime dideteksi langsung dari binari (`<bin> --version`) lalu tercatat:
//   (1) di event (task_running / task_started / meta) — bukti audit;
//   (2) di artefak — executor mengekspor DHOS_RUNTIME + DHOS_RUNTIME_VERSION
//       ke wrapper shell sehingga command task bisa menuliskannya ke stdout.
// Whitelist tertutup: runtime lain ditolak API (task_denied invalid_runtime).
//
// run-33 Track 1 (DL-37): runtime layer blackhornet — python3 ditambahkan ke
// whitelist agar mission.py (dan seat blackhornet lain) dapat dijalankan sebagai
// task control plane. Kontrak adapter tetap sama: resolveAdapter → `<bin> --version`.
export interface RuntimeAdapter {
  name: string; // "bun" | "node" | "python3"
  bin: string; // path absolut binari (env child bersih → path absolut wajib)
  version: string; // hasil `<bin> --version`
}

const BINS: Record<string, string> = {
  bun: "/usr/local/bin/bun",
  node: "/usr/bin/node",
  python3: "/usr/bin/python3",
};

export const RUNTIME_NAMES = Object.keys(BINS);

const cache = new Map<string, RuntimeAdapter>();

// resolveAdapter: null bila nama tidak ada di whitelist ATAU binari tidak bisa
// menjawab --version (runtime tidak dipakai diam-diam — kegagalan harus terlihat).
export function resolveAdapter(name: string): RuntimeAdapter | null {
  const hit = cache.get(name);
  if (hit) return hit;
  const bin = BINS[name];
  if (!bin) return null;
  try {
    const p = Bun.spawnSync([bin, "--version"], { stdout: "pipe", stderr: "pipe" });
    const version = p.stdout.toString().trim();
    if (!version || p.exitCode !== 0) return null;
    const a: RuntimeAdapter = { name, bin, version };
    cache.set(name, a);
    return a;
  } catch {
    return null;
  }
}

// Adapter utk satu task: field runtime milik task; default 'bun' (kompatibel slice-1/2).
export function adapterForTask(runtime: string | null | undefined): RuntimeAdapter {
  return resolveAdapter(runtime ?? "bun") ?? resolveAdapter("bun")!;
}
