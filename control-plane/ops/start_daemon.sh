#!/usr/bin/env bash
# ops/start_daemon.sh — Fase 9 slice-1c (run-38): daemon supervisor control plane.
#
# Perilaku:
#   - default (tanpa arg): rm -f ops/.daemon.stop (start sah = kill-switch dicabut),
#     lalu mendetach diri sendiri (setsid nohup) → pid supervisor di ops/.daemon.pid;
#     control plane anak di-start via setsid (pid di logs/daemon-cp.pid, log
#     logs/daemon-cp.log). Tanpa --duration → jalan terus sampai kill-switch.
#   - health loop: SETIAP interval (default 30 dtk, env DHOS_DAEMON_INTERVAL) GET
#     http://127.0.0.1:3031/api/events?limit=1 → append ops/daemon_health.log
#     (ts + code). Health gagal 3x berturut → restart control plane (kill lama +
#     fuser fallback + setsid ulang) + baris RESTART di log.
#   - kill-switch kompatibel stop_safely: bila ops/.daemon.stop ADA saat loop
#     berjalan → supervisor exit BERSIH (rm pidfile), TIDAK resurrect :3031.
#     stop_safely.sh & verify_at.sh touch file tsb paling awal.
#   - idempotent: bila supervisor sudah jalan → no-op (stop file TIDAK di-rm);
#     bila :3031 sudah merespons (instance lain) → di-adopt (tidak spawn dobel).
#
# Pemakaian:
#   bash ops/start_daemon.sh                # start (detach) + health loop
#   bash ops/start_daemon.sh --foreground   # supervisor di foreground (debug)
#   bash ops/stop_daemon.sh                 # stop wajib (touch .daemon.stop + bunuh supervisor+CP)
#   kill "$(cat ops/.daemon.pid)"           # stop supervisor saja
set -u

ROOT="/home/z/my-project/dhaheros"
BASE="http://127.0.0.1:3031"
PIDFILE="$ROOT/ops/.daemon.pid"
CHILD_PID="$ROOT/logs/daemon-cp.pid"
LOG="$ROOT/ops/daemon_health.log"
CP_LOG="$ROOT/logs/daemon-cp.log"
STOP_FILE="$ROOT/ops/.daemon.stop"
HEALTH_URL="$BASE/api/events?limit=1"
INTERVAL="${DHOS_DAEMON_INTERVAL:-30}"   # detik antar health beat (env override)
MAX_FAIL=3                                # gagal berturut-turut sebelum restart

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
mkdir -p "$ROOT/ops" "$ROOT/logs"

health_code() { curl -s -o /dev/null -w '%{http_code}' -m 5 "$HEALTH_URL" 2>/dev/null; }
health_ok() { [ "$(health_code)" = "200" ]; }

start_cp() {
  # Pola pid-capture terbukti (sama dgn verify_at.sh): subshell background + exec —
  # $! = pid proses service (setsid dijalankan via exec: pid tidak berubah bila
  # proses bukan group leader — konten script bash tanpa job control).
  ( cd "$ROOT" && exec setsid bun src/index.ts >> "$CP_LOG" 2>&1 ) &
  echo $! > "$CHILD_PID"
  echo "$(ts) control plane start (pid $(cat "$CHILD_PID" 2>/dev/null || echo '?'))" >> "$LOG"
}

# ---------- mode foreground = loop supervisor; default = detach diri ----------
if [ "${1:-}" != "--foreground" ]; then
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo "daemon sudah jalan (pid $(cat "$PIDFILE")) — no-op (ops/.daemon.stop tidak diubah)"
    exit 0
  fi
  rm -f "$STOP_FILE"  # start sah → kill-switch dicabut (spesifik slice-1c: rm -f .daemon.stop)
  setsid nohup bash "$0" --foreground >> "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  echo "daemon start (pid $(cat "$PIDFILE"); interval=${INTERVAL}s; health log: $LOG)"
  exit 0
fi

# ---------- supervisor loop (foreground) ----------
echo "$(ts) daemon supervisor start (pid $$, interval=${INTERVAL}s)" >> "$LOG"
trap 'rm -f "$PIDFILE"; echo "$(ts) supervisor exit (pid $$)" >> "$LOG"' EXIT
fails=0

if health_ok; then
  echo "$(ts) control plane SUDAH merespons → adopt (tanpa spawn baru, anti dobel)" >> "$LOG"
else
  start_cp
  i=0
  while ! health_ok && [ "$i" -lt 20 ]; do i=$((i+1)); sleep 1; done
  if [ "$i" -lt 20 ]; then
    echo "$(ts) control plane siap (health OK, tunggu ${i}s)" >> "$LOG"
  else
    echo "$(ts) control plane belum siap setelah 20s (akan dinilai health loop)" >> "$LOG"
  fi
fi

while true; do
  # kill-switch dicek PALING AWAL tiap iterasi: stop file ada → exit BERSIH tanpa resurrect
  if [ -f "$STOP_FILE" ]; then
    echo "$(ts) kill-switch terdeteksi (ops/.daemon.stop) → supervisor exit TANPA resurrect" >> "$LOG"
    exit 0
  fi
  code="$(health_code)"
  echo "$(ts) beat code=$code ($HEALTH_URL)" >> "$LOG"
  if [ "$code" = "200" ]; then
    if [ "$fails" -gt 0 ]; then echo "$(ts) health pulih" >> "$LOG"; fi
    fails=0
  else
    fails=$((fails+1))
    echo "$(ts) health FAIL $fails/$MAX_FAIL" >> "$LOG"
    if [ "$fails" -ge "$MAX_FAIL" ]; then
      echo "$(ts) RESTART control plane (health gagal ${MAX_FAIL}x berturut)" >> "$LOG"
      OLD="$(cat "$CHILD_PID" 2>/dev/null || true)"
      [ -n "$OLD" ] && kill "$OLD" 2>/dev/null
      sleep 1
      [ -n "$OLD" ] && kill -9 "$OLD" 2>/dev/null
      fuser -k -9 3031/tcp >/dev/null 2>&1 || true   # fallback: pastikan :3031 bebas (termasuk instance adopt)
      sleep 1
      start_cp
      i=0
      while ! health_ok && [ "$i" -lt 20 ]; do i=$((i+1)); sleep 1; done
      echo "$(ts) RESTART selesai (health OK setelah ${i}s)" >> "$LOG"
      fails=0
    fi
  fi
  sleep "$INTERVAL"
done
